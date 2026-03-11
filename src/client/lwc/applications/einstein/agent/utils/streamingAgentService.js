// StreamingAgentService.js
// Encapsulates agent streaming, abort, and event processing logic.

const RAW_MODEL_STREAM = 'raw_model_stream_event';
const RUN_ITEM_STREAM = 'run_item_stream_event';

const MODEL_EVENT = {
    OUTPUT_ITEM_ADDED: 'response.output_item.added',
    OUTPUT_ITEM_DONE: 'response.output_item.done',
    REASONING_PART_ADDED: 'response.reasoning_summary_part.added',
    REASONING_PART_DONE: 'response.reasoning_summary_part.done',
    REASONING_TEXT_DELTA: 'response.reasoning_summary_text.delta',
    OUTPUT_PART_ADDED: 'response.content_part.added',
    OUTPUT_PART_DONE: 'response.content_part.done',
    OUTPUT_TEXT_DELTA: 'response.output_text.delta',
};

const DATA_TYPE = {
    MODEL: 'model',
    OUTPUT_TEXT_DELTA: 'output_text_delta',
};

function getEventType(data) {
    return data?.event?.type ?? data?.type ?? null;
}

function getDelta(data) {
    if (typeof data?.event?.delta === 'string') return data.event.delta;
    if (typeof data?.delta === 'string') return data.delta;
    return '';
}

export default class StreamingAgentService {
    constructor(runner, agent, messages, options = {}) {
        this.runner = runner;
        this.agent = agent;
        this.messages = messages;
        this.options = options;
        this.currentAbortController = null;
        this.currentStream = null;
        this.onChunk = options.onChunk || (() => {});
        this.onStreamEnd = options.onStreamEnd || (() => {});
        this.onError = options.onError || (() => {});
        this.onToolEvent = options.onToolEvent || (() => {});
        this.onRawEvent = options.onRawEvent || (() => {});
        this._reasoningActive = false;
        this._reasoningStartedAt = null;
        this._reasoningText = '';
        this._reasoningItemId = null;
    }

    _startReasoning(partAddedEventData) {
        const itemId =
            partAddedEventData?.event?.item_id ??
            partAddedEventData?.item_id ??
            partAddedEventData?.event?.part?.id ??
            null;
        const summaryIndex =
            partAddedEventData?.event?.summary_index ?? partAddedEventData?.summary_index ?? 0;
        const part = partAddedEventData?.event?.part ?? partAddedEventData?.part ?? { type: 'summary_text', text: '' };
        this.onChunk({
            type: 'reasoning',
            partStart: true,
            item_id: itemId,
            summary_index: summaryIndex,
            part: { type: part?.type || 'summary_text', text: part?.text ?? '' },
        });
    }

    _stopReasoning(partDoneEventData) {
        const itemId =
            partDoneEventData?.event?.item_id ??
            partDoneEventData?.item_id ??
            partDoneEventData?.event?.part?.id ??
            null;
        this.onChunk({
            type: 'reasoning',
            partEnd: true,
            item_id: itemId,
            content: this._reasoningText || '',
        });
    }

    _startBlock(data) {
        const item = data?.event?.item;
        // Exceptions for function calls
        if(!item || item.type === 'function_call') {
            return;
        }

        this.onChunk({
            item_id: item.id,
            itemType: item.type,
            type: 'message',
            start: true,
        });
    }

    _stopBlock(data) {
        const item = data?.event?.item;
        // Exceptions for function calls
        if(!item || item.type === 'function_call') {
            return;
        }
        this.onChunk({
            item_id: item.id,
            type: 'message',
            end: true,
        });
    }

    _startText(data) {
        const itemId =
            data?.event?.item_id ?? data?.item_id ?? data?.event?.part?.id ?? null;
        const part = data?.event?.part ?? data?.part ?? null;
        if (!part) return;
        this.onChunk({
            type: 'output_text',
            partStart: true,
            item_id: itemId,
            part,
        });
    }

    _stopText(data) {
        const itemId =
            data?.event?.item_id ?? data?.item_id ?? data?.event?.part?.id ?? null;
        const partId = data?.event?.part?.id ?? data?.part?.id ?? null;
        this.onChunk({
            type: 'output_text',
            partEnd: true,
            item_id: itemId,
            part_id: partId,
        });
    }

    _deltaReasoning(data) {
        const delta = getDelta(data);
        if (!delta) return;
        const summaryIndex = data?.event?.summary_index ?? data?.summary_index ?? 0;
        this.onChunk({
            type: 'reasoning',
            delta,
            summary_index: summaryIndex,
        });
    }

    _deltaText(data) {
        const delta = getDelta(data);
        if (!delta) return;
        this.onChunk({ 
            type:'output_text',
            delta,
         });
    }

    _handleRawModelEvent(event) {
        const data = event.data;
        const eventType = getEventType(data);
        const dataType = data?.type;

        if (dataType === DATA_TYPE.MODEL && eventType === MODEL_EVENT.OUTPUT_ITEM_ADDED) {
            this._startBlock(data);
            return;
        }

        if (dataType === DATA_TYPE.MODEL && eventType === MODEL_EVENT.OUTPUT_ITEM_DONE) {
            this._stopBlock(data);
            return;
        }

        if (dataType === DATA_TYPE.MODEL && eventType === MODEL_EVENT.OUTPUT_PART_ADDED) {
            this._startText(data);
            return;
        }

        if (dataType === DATA_TYPE.MODEL && eventType === MODEL_EVENT.OUTPUT_PART_DONE) {
            this._stopText(data);
            return;
        }

        if (dataType === DATA_TYPE.MODEL && eventType === MODEL_EVENT.REASONING_PART_ADDED) {
            this._startReasoning(data);
            return;
        }

        if (dataType === DATA_TYPE.MODEL && eventType === MODEL_EVENT.REASONING_PART_DONE) {
            this._stopReasoning(data);
            return;
        }

        if (eventType === MODEL_EVENT.REASONING_TEXT_DELTA) {
            this._deltaReasoning(data);
            return;
        }

        if (dataType !== DATA_TYPE.MODEL && (eventType === MODEL_EVENT.OUTPUT_TEXT_DELTA || dataType === DATA_TYPE.OUTPUT_TEXT_DELTA)) {
            this._deltaText(data);
            return;
        }
    }

    _handleRunItemEvent(event) {
        const rawItem = event?.item?.rawItem;
        if (rawItem) {
            this.onToolEvent(rawItem);
        }
    }

    async startStreaming() {
        try {
            this.currentAbortController = new AbortController();
            const runOptions = {
                ...this.options,
                stream: true,
                signal: this.currentAbortController.signal,
            };
            if (this.options.reasoning != null) {
                runOptions.reasoning = this.options.reasoning;
            }

            const stream = await this.runner.run(this.agent, this.messages, runOptions);
            this.currentStream = stream;

            for await (const event of stream) {
                this.onRawEvent(event);

                if (event.type === RAW_MODEL_STREAM) {
                    this._handleRawModelEvent(event);
                } else if (event.type === RUN_ITEM_STREAM) {
                    this._handleRunItemEvent(event);
                }
            }
            await stream.completed;
            this.onStreamEnd(stream);
        } catch (e) {
            this.onError(e);
        } finally {
            this.currentAbortController = null;
        }
    }

    abort() {
        if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = null;
        }
    }
}
