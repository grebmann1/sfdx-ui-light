import { bootstrapIframeAiBridge } from './bootstrapIframeAiBridge';
import {
    IFRAME_AI_BRIDGE_PORT_MESSAGE_TYPES,
    IFRAME_AI_BRIDGE_PROTOCOL,
    IFRAME_AI_BRIDGE_VERSION,
    isIframeAiBridgeEnvelope,
    type IframeAiBridgeChunk,
    type IframeAiBridgeConfigData,
    type IframeAiBridgeMessage,
    type IframeAiBridgeModelConfig,
} from './iframeAiBridgeContract';

function createRequestId() {
    return `ai_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

type ChunkPush = (chunk: IframeAiBridgeChunk | null) => void;

export class IframeAiBridgeClient {
    private port: MessagePort;
    private pendingStreams = new Map<string, ChunkPush>();

    private readonly boundHandlePortMessage = this.handlePortMessage.bind(this);

    constructor(port: MessagePort) {
        this.port = port;
        this.port.addEventListener('message', this.boundHandlePortMessage);
        this.port.start?.();
    }

    dispose() {
        this.port.removeEventListener('message', this.boundHandlePortMessage);
        try {
            this.port.close();
        } catch {
            // ignore
        }
        for (const push of this.pendingStreams.values()) {
            try {
                push(null);
            } catch {
                // ignore
            }
        }
        this.pendingStreams.clear();
    }

    abort(requestId: string) {
        const push = this.pendingStreams.get(requestId);
        if (!push) {
            return;
        }
        try {
            this.port.postMessage({
                protocol: IFRAME_AI_BRIDGE_PROTOCOL,
                version: IFRAME_AI_BRIDGE_VERSION,
                type: IFRAME_AI_BRIDGE_PORT_MESSAGE_TYPES.CANCEL,
                id: requestId,
            });
        } catch {
            // ignore — port may be closed
        }
        push(null);
    }

    async fetchConfig(): Promise<IframeAiBridgeConfigData | null> {
        const id = createRequestId();
        const buffer: Array<IframeAiBridgeChunk | null> = [];
        let notify: (() => void) | null = null;

        const push = (chunk: IframeAiBridgeChunk | null) => {
            buffer.push(chunk);
            if (notify) {
                const fn = notify;
                notify = null;
                fn();
            }
        };

        this.pendingStreams.set(id, push);

        try {
            this.port.postMessage({
                protocol: IFRAME_AI_BRIDGE_PROTOCOL,
                version: IFRAME_AI_BRIDGE_VERSION,
                type: IFRAME_AI_BRIDGE_PORT_MESSAGE_TYPES.REQUEST,
                id,
                method: 'ai.getConfig',
                args: {},
            });
        } catch (error) {
            this.pendingStreams.delete(id);
            return null;
        }

        try {
            while (true) {
                while (buffer.length > 0) {
                    const item = buffer.shift()!;
                    if (item === null || item.type === 'done') {
                        return null;
                    }
                    if (item.type === 'ai_config') {
                        return { provider: item.provider, models: item.models, isConfigured: item.isConfigured };
                    }
                }
                await new Promise<void>(resolve => {
                    notify = resolve;
                });
            }
        } finally {
            this.pendingStreams.delete(id);
        }
    }

    async *complete(
        messages: IframeAiBridgeMessage[],
        modelConfig?: IframeAiBridgeModelConfig
    ): AsyncGenerator<IframeAiBridgeChunk> {
        const id = createRequestId();
        const buffer: Array<IframeAiBridgeChunk | null> = [];
        let notify: (() => void) | null = null;

        const push: ChunkPush = chunk => {
            buffer.push(chunk);
            if (notify) {
                const fn = notify;
                notify = null;
                fn();
            }
        };

        this.pendingStreams.set(id, push);

        try {
            this.port.postMessage({
                protocol: IFRAME_AI_BRIDGE_PROTOCOL,
                version: IFRAME_AI_BRIDGE_VERSION,
                type: IFRAME_AI_BRIDGE_PORT_MESSAGE_TYPES.REQUEST,
                id,
                method: 'ai.complete',
                args: { messages, modelConfig: modelConfig ?? {} },
            });
        } catch (error) {
            this.pendingStreams.delete(id);
            throw error;
        }

        let completedNormally = false;
        try {
            while (true) {
                // Drain all buffered items before waiting
                while (buffer.length > 0) {
                    const item = buffer.shift()!;
                    if (item === null || item.type === 'done') {
                        completedNormally = true;
                        return;
                    }
                    yield item;
                }

                // Wait for the next push
                await new Promise<void>(resolve => {
                    notify = resolve;
                });
            }
        } finally {
            this.pendingStreams.delete(id);
            if (!completedNormally) {
                try {
                    this.port.postMessage({
                        protocol: IFRAME_AI_BRIDGE_PROTOCOL,
                        version: IFRAME_AI_BRIDGE_VERSION,
                        type: IFRAME_AI_BRIDGE_PORT_MESSAGE_TYPES.CANCEL,
                        id,
                    });
                } catch {
                    // ignore — port may be closed
                }
            }
        }
    }

    private handlePortMessage(event: MessageEvent) {
        if (!isIframeAiBridgeEnvelope(event.data)) {
            return;
        }

        if (event.data.type === IFRAME_AI_BRIDGE_PORT_MESSAGE_TYPES.CHUNK) {
            const id = typeof event.data.id === 'string' ? event.data.id : null;
            if (!id) {
                return;
            }
            const push = this.pendingStreams.get(id);
            if (!push) {
                return;
            }
            const payload = event.data.payload;
            if (!payload || typeof payload !== 'object') {
                return;
            }
            const chunk = payload as IframeAiBridgeChunk;
            push(chunk);
            if (chunk.type === 'done') {
                this.pendingStreams.delete(id);
            }
            return;
        }

        if (event.data.type === IFRAME_AI_BRIDGE_PORT_MESSAGE_TYPES.ERROR) {
            for (const push of Array.from(this.pendingStreams.values())) {
                try {
                    push(null);
                } catch {
                    // ignore
                }
            }
            this.pendingStreams.clear();
        }
    }
}

export async function connectIframeAiBridgeClient(
    options: { handshakeTimeoutMs?: number } = {}
) {
    const port = await bootstrapIframeAiBridge({ timeoutMs: options.handshakeTimeoutMs });
    return new IframeAiBridgeClient(port);
}
