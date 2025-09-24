// StreamingAgentService.js
// Encapsulates agent streaming, abort, and event processing logic

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
    }

    async startStreaming() {
        try {
            this.currentAbortController = new AbortController();
            const stream = await this.runner.run(
                this.agent,
                this.messages,
                {
                    ...this.options,
                    stream: true,
                    signal: this.currentAbortController.signal,
                }
            );
            this.currentStream = stream;
            for await (const event of stream) {
                if (event.type === 'raw_model_stream_event') {
                    const data = event.data;
                    if (data.type === 'model' && data.event?.type === 'response.output_item.added') {
                        this.onChunk(data.event.item);
                    } else if (data.type === 'output_text_delta') {
                        this.onChunk({ delta: data.delta });
                    }
                } else if (event.type === 'run_item_stream_event') {
                    if (event.item && event.item.rawItem) {
                        this.onToolEvent(event.item.rawItem);
                    }
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
