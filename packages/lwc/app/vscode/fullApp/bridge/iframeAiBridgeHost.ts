import {
    IFRAME_AI_BRIDGE_PORT_MESSAGE_TYPES,
    IFRAME_AI_BRIDGE_WINDOW_MESSAGE_TYPES,
    IFRAME_AI_BRIDGE_PROTOCOL,
    IFRAME_AI_BRIDGE_VERSION,
    isIframeAiBridgeEnvelope,
    isIframeAiBridgeMethod,
    toIframeAiBridgeError,
    type IframeAiBridgeChunk,
    type IframeAiBridgeError,
    type IframeAiBridgeMessage,
    type IframeAiBridgeModelConfig,
} from './iframeAiBridgeContract';

const DEFAULT_HANDSHAKE_TIMEOUT_MS = 15000;

export type AiBridgeRuntime = {
    streamComplete(args: {
        messages: IframeAiBridgeMessage[];
        modelConfig: IframeAiBridgeModelConfig;
    }): AsyncGenerator<IframeAiBridgeChunk>;
    getConfig?(): AsyncGenerator<IframeAiBridgeChunk>;
};

type IframeAiBridgeHostOptions = {
    iframe: HTMLIFrameElement;
    targetOrigin: string;
    runtime: AiBridgeRuntime;
    handshakeTimeoutMs?: number;
    onReady?: () => void;
    onError?: (error: IframeAiBridgeError) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

class IframeAiBridgeHost {
    private iframe: HTMLIFrameElement;
    private targetOrigin: string;
    private runtime: AiBridgeRuntime;
    private handshakeTimeoutMs: number;
    private onReady?: () => void;
    private onError?: (error: IframeAiBridgeError) => void;
    private started = false;
    private disposed = false;
    private ready = false;
    private handshakeTimer: number | null = null;
    private port: MessagePort | null = null;
    private activeRequests = new Map<string, AbortController>();

    private readonly boundHandleWindowMessage = this.handleWindowMessage.bind(this);
    private readonly boundHandlePortMessage = this.handlePortMessage.bind(this);

    constructor(options: IframeAiBridgeHostOptions) {
        this.iframe = options.iframe;
        this.targetOrigin = options.targetOrigin;
        this.runtime = options.runtime;
        this.onReady = options.onReady;
        this.onError = options.onError;
        this.handshakeTimeoutMs = Math.max(
            1000,
            Number(options.handshakeTimeoutMs || DEFAULT_HANDSHAKE_TIMEOUT_MS)
        );
    }

    start() {
        if (this.started || this.disposed) {
            return;
        }
        this.started = true;
        window.addEventListener('message', this.boundHandleWindowMessage);
        this.handshakeTimer = window.setTimeout(() => {
            if (this.ready || this.disposed) {
                return;
            }
            this.reportError({
                code: 'ETIMEOUT',
                message: 'Iframe AI bridge handshake timed out.',
            });
        }, this.handshakeTimeoutMs);
    }

    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.ready = false;
        if (this.handshakeTimer) {
            window.clearTimeout(this.handshakeTimer);
            this.handshakeTimer = null;
        }
        window.removeEventListener('message', this.boundHandleWindowMessage);
        try {
            this.port?.removeEventListener?.('message', this.boundHandlePortMessage);
        } catch {
            // ignore
        }
        try {
            this.port?.close?.();
        } catch {
            // ignore
        }
        this.port = null;
        for (const controller of this.activeRequests.values()) {
            try {
                controller.abort();
            } catch {
                // ignore
            }
        }
        this.activeRequests.clear();
    }

    isReady() {
        return this.ready;
    }

    private reportError(error: IframeAiBridgeError) {
        this.onError?.(error);
    }

    private handleWindowMessage(event: MessageEvent) {
        if (this.disposed) {
            return;
        }
        if (event.source !== this.iframe.contentWindow) {
            return;
        }
        if (event.origin !== this.targetOrigin) {
            return;
        }
        if (!isIframeAiBridgeEnvelope(event.data)) {
            return;
        }

        if (event.data.type === IFRAME_AI_BRIDGE_WINDOW_MESSAGE_TYPES.HELLO) {
            this.openPort();
            return;
        }

        if (event.data.type === IFRAME_AI_BRIDGE_WINDOW_MESSAGE_TYPES.ERROR) {
            this.reportError(
                toIframeAiBridgeError(
                    event.data.error,
                    'ECLIENT',
                    'Iframe AI bridge reported an error.'
                )
            );
        }
    }

    private openPort() {
        if (this.disposed || this.port || !this.iframe.contentWindow) {
            return;
        }

        const channel = new MessageChannel();
        this.port = channel.port1;
        this.port.addEventListener('message', this.boundHandlePortMessage);
        this.port.start?.();

        this.iframe.contentWindow.postMessage(
            {
                protocol: IFRAME_AI_BRIDGE_PROTOCOL,
                version: IFRAME_AI_BRIDGE_VERSION,
                type: IFRAME_AI_BRIDGE_WINDOW_MESSAGE_TYPES.PORT,
            },
            this.targetOrigin,
            [channel.port2]
        );
    }

    private async handlePortMessage(event: MessageEvent) {
        if (this.disposed) {
            return;
        }
        if (!isIframeAiBridgeEnvelope(event.data)) {
            return;
        }

        if (event.data.type === IFRAME_AI_BRIDGE_PORT_MESSAGE_TYPES.READY) {
            this.ready = true;
            if (this.handshakeTimer) {
                window.clearTimeout(this.handshakeTimer);
                this.handshakeTimer = null;
            }
            this.onReady?.();
            return;
        }

        if (event.data.type === IFRAME_AI_BRIDGE_PORT_MESSAGE_TYPES.REQUEST) {
            void this.handleAiRequest(event.data);
            return;
        }

        if (event.data.type === IFRAME_AI_BRIDGE_PORT_MESSAGE_TYPES.CANCEL) {
            const id = typeof event.data.id === 'string' ? event.data.id : null;
            if (id) {
                this.activeRequests.get(id)?.abort();
                this.activeRequests.delete(id);
            }
            return;
        }

        if (event.data.type === IFRAME_AI_BRIDGE_PORT_MESSAGE_TYPES.ERROR) {
            this.reportError(
                toIframeAiBridgeError(
                    event.data.error,
                    'ECLIENT',
                    'Iframe AI bridge request pipeline failed.'
                )
            );
        }
    }

    private sendChunk(id: string, chunk: IframeAiBridgeChunk) {
        if (this.disposed || !this.port) {
            return;
        }
        this.port.postMessage({
            protocol: IFRAME_AI_BRIDGE_PROTOCOL,
            version: IFRAME_AI_BRIDGE_VERSION,
            type: IFRAME_AI_BRIDGE_PORT_MESSAGE_TYPES.CHUNK,
            id,
            chunkType: chunk.type,
            payload: chunk,
        });
    }

    private async handleAiRequest(message: Record<string, unknown>) {
        const id = typeof message.id === 'string' ? message.id : null;
        if (!id) {
            return;
        }

        try {
            const method = message.method;
            if (!isIframeAiBridgeMethod(method)) {
                throw { code: 'EMETHOD', message: 'Unsupported AI bridge method.' };
            }
            const args = isRecord(message.args) ? message.args : {};
            const messages = Array.isArray(args.messages)
                ? (args.messages as IframeAiBridgeMessage[])
                : [];
            const modelConfig = isRecord(args.modelConfig)
                ? (args.modelConfig as IframeAiBridgeModelConfig)
                : {};

            const abortController = new AbortController();
            this.activeRequests.set(id, abortController);

            try {
                const stream = method === 'ai.getConfig'
                    ? this.runtime.getConfig?.() ?? (async function* () { yield { type: 'done' as const }; })()
                    : this.runtime.streamComplete({ messages, modelConfig });
                for await (const chunk of stream) {
                    if (abortController.signal.aborted || this.disposed) {
                        break;
                    }
                    this.sendChunk(id, chunk);
                    if (chunk.type === 'done') {
                        break;
                    }
                }
            } finally {
                this.activeRequests.delete(id);
            }
        } catch (error) {
            const bridgeError = toIframeAiBridgeError(error, 'EAI', 'AI bridge request failed.');
            this.sendChunk(id, { type: 'error', code: bridgeError.code, message: bridgeError.message });
            this.sendChunk(id, { type: 'done' });
        }
    }
}

export function createIframeAiBridgeHost(options: IframeAiBridgeHostOptions) {
    return new IframeAiBridgeHost(options);
}
