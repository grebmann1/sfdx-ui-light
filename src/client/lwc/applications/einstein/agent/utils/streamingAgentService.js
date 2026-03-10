// StreamingAgentService.js
// Encapsulates agent streaming, abort, and event processing logic.

const RAW_MODEL_STREAM = 'raw_model_stream_event';
const RUN_ITEM_STREAM = 'run_item_stream_event';

const MODEL_EVENT = {
    OUTPUT_ITEM_ADDED: 'response.output_item.added',
    REASONING_PART_ADDED: 'response.reasoning_summary_part.added',
    REASONING_TEXT_DELTA: 'response.reasoning_summary_text.delta',
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
        this.onReasoningStart = options.onReasoningStart || (() => {});
        this.onReasoningChunk = options.onReasoningChunk || (() => {});
        this.onReasoningEnd = options.onReasoningEnd || (() => {});
        this._reasoningActive = false;
        this._reasoningStartedAt = null;
        this._reasoningText = '';
    }

    _startReasoning() {
        if (!this._reasoningActive) {
            this._reasoningActive = true;
            this._reasoningStartedAt = Date.now();
            this._reasoningText = '';
            this.onReasoningStart();
        }
    }

    _endReasoningIfActive() {
        if (!this._reasoningActive) return;
        this._reasoningActive = false;
        const endedAt = Date.now();
        const durationSeconds =
            this._reasoningStartedAt != null
                ? Math.round((endedAt - this._reasoningStartedAt) / 1000)
                : 0;
        this.onReasoningEnd({
            durationSeconds,
            reasoningText: this._reasoningText || '',
        });
        this._reasoningStartedAt = null;
        this._reasoningText = '';
    }

    _handleOutputItemAdded(data) {
        const item = data?.event?.item;
        if (!item) return;

        const itemType = (item?.type || '').toLowerCase().trim();

        if (itemType === 'reasoning') {
            this._startReasoning();
            return;
        }

        const textContent = typeof item?.text === 'string' ? item.text : '';
        const isTextItem =
            textContent && (item?.type === 'text' || item?.type === 'input_text');

        if (isTextItem) {
            this._endReasoningIfActive();
            // Assistant text is delivered via output_text.delta; skip here to avoid double text.
        } else {
            this.onChunk(item);
        }
    }

    _handleReasoningPartAdded(data) {
        if (this._reasoningActive && this._reasoningText.length > 0) {
            this._reasoningText += '\n\n';
            this.onReasoningChunk('\n\n');
        }
        this._startReasoning();
    }

    _handleReasoningTextDelta(data) {
        const delta = getDelta(data);
        if (!delta) return;
        this._startReasoning();
        this._reasoningText += delta;
        this.onReasoningChunk(delta);
    }

    _handleOutputTextDelta(data) {
        const delta = getDelta(data);
        if (!delta) return;
        this._endReasoningIfActive();
        this.onChunk({ delta });
    }

    _handleRawModelEvent(event) {
        const data = event.data;
        const eventType = getEventType(data);
        const dataType = data?.type;

        if (dataType === DATA_TYPE.MODEL && eventType === MODEL_EVENT.OUTPUT_ITEM_ADDED) {
            this._handleOutputItemAdded(data);
            return;
        }

        if (dataType === DATA_TYPE.MODEL && eventType === MODEL_EVENT.REASONING_PART_ADDED) {
            this._handleReasoningPartAdded(data);
            return;
        }

        if (dataType !== DATA_TYPE.MODEL && eventType === MODEL_EVENT.REASONING_TEXT_DELTA) {
            this._handleReasoningTextDelta(data);
            return;
        }

        if (dataType !== DATA_TYPE.MODEL && (eventType === MODEL_EVENT.OUTPUT_TEXT_DELTA || dataType === DATA_TYPE.OUTPUT_TEXT_DELTA)) {
            this._handleOutputTextDelta(data);
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
                console.log('### event', {event:JSON.parse(JSON.stringify(event))});

                if (event.type === RAW_MODEL_STREAM) {
                    this._handleRawModelEvent(event);
                } else if (event.type === RUN_ITEM_STREAM) {
                    this._handleRunItemEvent(event);
                }
            }

            this._endReasoningIfActive();
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
