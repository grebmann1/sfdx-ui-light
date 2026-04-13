import {
    IFRAME_JSFORCE_BRIDGE_PORT_MESSAGE_TYPES,
    IFRAME_JSFORCE_BRIDGE_WINDOW_MESSAGE_TYPES,
    IFRAME_JSFORCE_BRIDGE_PROTOCOL,
    IFRAME_JSFORCE_BRIDGE_VERSION,
    isIframeJsforceBridgeEnvelope,
    isIframeJsforceBridgeMethod,
    toIframeJsforceBridgeError,
    type IframeJsforceBridgeError,
} from './iframeJsforceBridgeContract';
import { createIframeJsforceBridgeRuntime } from './iframeJsforceBridgeRuntime';

const DEFAULT_HANDSHAKE_TIMEOUT_MS = 15000;

type IframeJsforceBridgeHostOptions = {
    iframe: HTMLIFrameElement;
    targetOrigin: string;
    runtime: ReturnType<typeof createIframeJsforceBridgeRuntime>;
    handshakeTimeoutMs?: number;
    onError?: (error: IframeJsforceBridgeError) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

class IframeJsforceBridgeHost {
    private iframe: HTMLIFrameElement;
    private targetOrigin: string;
    private runtime: ReturnType<typeof createIframeJsforceBridgeRuntime>;
    private handshakeTimeoutMs: number;
    private onError?: (error: IframeJsforceBridgeError) => void;
    private started = false;
    private disposed = false;
    private ready = false;
    private handshakeTimer: number | null = null;
    private port: MessagePort | null = null;

    private readonly boundHandleWindowMessage = this.handleWindowMessage.bind(this);
    private readonly boundHandlePortMessage = this.handlePortMessage.bind(this);

    constructor(options: IframeJsforceBridgeHostOptions) {
        this.iframe = options.iframe;
        this.targetOrigin = options.targetOrigin;
        this.runtime = options.runtime;
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
                message: 'Iframe JSForce bridge handshake timed out.',
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
    }

    isReady() {
        return this.ready;
    }

    private reportError(error: IframeJsforceBridgeError) {
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
        if (!isIframeJsforceBridgeEnvelope(event.data)) {
            return;
        }

        if (event.data.type === IFRAME_JSFORCE_BRIDGE_WINDOW_MESSAGE_TYPES.HELLO) {
            this.openPort();
            return;
        }

        if (event.data.type === IFRAME_JSFORCE_BRIDGE_WINDOW_MESSAGE_TYPES.ERROR) {
            this.reportError(
                toIframeJsforceBridgeError(
                    event.data.error,
                    'ECLIENT',
                    'Iframe JSForce bridge reported an error.'
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
                protocol: IFRAME_JSFORCE_BRIDGE_PROTOCOL,
                version: IFRAME_JSFORCE_BRIDGE_VERSION,
                type: IFRAME_JSFORCE_BRIDGE_WINDOW_MESSAGE_TYPES.PORT,
            },
            this.targetOrigin,
            [channel.port2]
        );
    }

    private async handlePortMessage(event: MessageEvent) {
        if (this.disposed) {
            return;
        }
        if (!isIframeJsforceBridgeEnvelope(event.data)) {
            return;
        }

        if (event.data.type === IFRAME_JSFORCE_BRIDGE_PORT_MESSAGE_TYPES.READY) {
            this.ready = true;
            if (this.handshakeTimer) {
                window.clearTimeout(this.handshakeTimer);
                this.handshakeTimer = null;
            }
            return;
        }

        if (event.data.type === IFRAME_JSFORCE_BRIDGE_PORT_MESSAGE_TYPES.REQUEST) {
            await this.handleJsforceRequest(event.data);
            return;
        }

        if (event.data.type === IFRAME_JSFORCE_BRIDGE_PORT_MESSAGE_TYPES.ERROR) {
            this.reportError(
                toIframeJsforceBridgeError(
                    event.data.error,
                    'ECLIENT',
                    'Iframe JSForce bridge request pipeline failed.'
                )
            );
        }
    }

    private async handleJsforceRequest(message: Record<string, unknown>) {
        const id = typeof message.id === 'string' ? message.id : null;
        if (!id) {
            return;
        }
        try {
            const method = message.method;
            if (!isIframeJsforceBridgeMethod(method)) {
                throw {
                    code: 'EMETHOD',
                    message: 'Unsupported JSForce bridge method.',
                };
            }
            const args = isRecord(message.args) ? message.args : {};
            const result = await this.runtime.execute(method, args);
            this.port?.postMessage({
                protocol: IFRAME_JSFORCE_BRIDGE_PROTOCOL,
                version: IFRAME_JSFORCE_BRIDGE_VERSION,
                type: IFRAME_JSFORCE_BRIDGE_PORT_MESSAGE_TYPES.RESPONSE,
                id,
                ok: true,
                result,
            });
        } catch (error) {
            this.port?.postMessage({
                protocol: IFRAME_JSFORCE_BRIDGE_PROTOCOL,
                version: IFRAME_JSFORCE_BRIDGE_VERSION,
                type: IFRAME_JSFORCE_BRIDGE_PORT_MESSAGE_TYPES.RESPONSE,
                id,
                ok: false,
                error: toIframeJsforceBridgeError(
                    error,
                    'EJSFORCE',
                    'JSForce bridge request failed.'
                ),
            });
        }
    }
}

export function createIframeJsforceBridgeHost(options: IframeJsforceBridgeHostOptions) {
    return new IframeJsforceBridgeHost(options);
}
