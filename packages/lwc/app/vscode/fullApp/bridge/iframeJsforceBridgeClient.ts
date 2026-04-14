import { bootstrapIframeJsforceBridge } from './bootstrapIframeJsforceBridge';
import {
    IFRAME_JSFORCE_BRIDGE_PORT_MESSAGE_TYPES,
    IFRAME_JSFORCE_BRIDGE_PROTOCOL,
    IFRAME_JSFORCE_BRIDGE_VERSION,
    isIframeJsforceBridgeEnvelope,
    isIframeJsforceBridgeMethod,
    toIframeJsforceBridgeError,
    type IframeJsforceBridgeHostEvent,
    type IframeJsforceBridgeMethod,
} from './iframeJsforceBridgeContract';

const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

type PendingRequest = {
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
    timer: number;
};

type IframeJsforceBridgeClientOptions = {
    requestTimeoutMs?: number;
    handshakeTimeoutMs?: number;
};

function createRequestId() {
    return `jsforce_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export class IframeJsforceBridgeClient {
    private port: MessagePort;
    private requestTimeoutMs: number;
    private pending = new Map<string, PendingRequest>();
    private hostEventListeners = new Set<(event: IframeJsforceBridgeHostEvent) => void>();

    private readonly boundHandlePortMessage = this.handlePortMessage.bind(this);

    constructor(port: MessagePort, options: IframeJsforceBridgeClientOptions = {}) {
        this.port = port;
        this.requestTimeoutMs = Math.max(
            1000,
            Number(options.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS)
        );
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
        for (const [id, pending] of this.pending) {
            window.clearTimeout(pending.timer);
            pending.reject(new Error(`Bridge request ${id} was cancelled.`));
            this.pending.delete(id);
        }
        this.hostEventListeners.clear();
    }

    onHostEvent(listener: (event: IframeJsforceBridgeHostEvent) => void) {
        if (typeof listener !== 'function') {
            return {
                dispose() {},
            };
        }
        this.hostEventListeners.add(listener);
        return {
            dispose: () => {
                this.hostEventListeners.delete(listener);
            },
        };
    }

    async getConnectionStatus() {
        return (await this.request('connection.getStatus')) as {
            connected: boolean;
            instanceUrl: string;
            apiVersion: string;
            workspaceRoot: string;
            sessionHasExpired: boolean;
            hasError: boolean;
            errorMessage: string | null;
        };
    }

    async executeSoql({
        query,
        mode = 'standard',
    }: {
        query: string;
        mode?: 'standard' | 'tooling' | 'queryAll';
    }) {
        return await this.request('soql.execute', { query, mode });
    }

    async executeAnonymous(apexCode: string) {
        return await this.request('apex.executeAnonymous', { apexCode });
    }

    async executeApi({
        endpoint,
        method = 'GET',
        body,
        headers,
    }: {
        endpoint: string;
        method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
        body?: unknown;
        headers?: Record<string, string>;
    }) {
        return await this.request('api.execute', {
            endpoint,
            method,
            body,
            headers,
        });
    }

    async runApexTests({
        classIds,
        classNames,
        pollIntervalMs,
        timeoutMs,
    }: {
        classIds?: string[];
        classNames?: string[];
        pollIntervalMs?: number;
        timeoutMs?: number;
    }) {
        return await this.request('apexTests.run', {
            classIds,
            classNames,
            pollIntervalMs,
            timeoutMs,
        });
    }

    async listMetadataTypes() {
        return await this.request('metadata.listTypes');
    }

    async listMetadata({ type, folder }: { type: string; folder?: string }) {
        return await this.request('metadata.list', {
            type,
            folder,
        });
    }

    async retrieveViaMetadataApi({
        types,
        timeoutMs,
        pollIntervalMs,
        includeZip = true,
    }: {
        types: Record<string, string[]>;
        timeoutMs?: number;
        pollIntervalMs?: number;
        includeZip?: boolean;
    }) {
        return await this.request('metadata.retrieveViaMetadataApi', {
            types,
            timeoutMs,
            pollIntervalMs,
            includeZip,
        });
    }

    async retrieveToolingTypes({ types }: { types: Record<string, string[]> }) {
        return await this.request('metadata.retrieveToolingTypes', {
            types,
        });
    }

    async describeCustomObject(objectName: string) {
        return await this.request('schema.describeCustomObject', {
            objectName,
        });
    }

    private async request(method: IframeJsforceBridgeMethod, args: Record<string, unknown> = {}) {
        if (!isIframeJsforceBridgeMethod(method)) {
            throw new Error(`Unsupported JSForce bridge method: ${String(method)}`);
        }
        const id = createRequestId();

        return await new Promise((resolve, reject) => {
            const timer = window.setTimeout(() => {
                if (!this.pending.has(id)) {
                    return;
                }
                this.pending.delete(id);
                reject(
                    new Error(
                        `Bridge request timed out for method "${method}" after ${this.requestTimeoutMs}ms.`
                    )
                );
            }, this.requestTimeoutMs);

            this.pending.set(id, { resolve, reject, timer });
            this.port.postMessage({
                protocol: IFRAME_JSFORCE_BRIDGE_PROTOCOL,
                version: IFRAME_JSFORCE_BRIDGE_VERSION,
                type: IFRAME_JSFORCE_BRIDGE_PORT_MESSAGE_TYPES.REQUEST,
                id,
                method,
                args,
            });
        });
    }

    private handlePortMessage(event: MessageEvent) {
        if (!isIframeJsforceBridgeEnvelope(event.data)) {
            return;
        }

        if (event.data.type === IFRAME_JSFORCE_BRIDGE_PORT_MESSAGE_TYPES.RESPONSE) {
            const id = typeof event.data.id === 'string' ? event.data.id : null;
            if (!id) {
                return;
            }
            const pending = this.pending.get(id);
            if (!pending) {
                return;
            }
            this.pending.delete(id);
            window.clearTimeout(pending.timer);

            if (event.data.ok) {
                pending.resolve(event.data.result);
                return;
            }
            pending.reject(
                toIframeJsforceBridgeError(
                    event.data.error,
                    'EJSFORCE',
                    'JSForce bridge request failed in the parent host.'
                )
            );
            return;
        }

        if (event.data.type === IFRAME_JSFORCE_BRIDGE_PORT_MESSAGE_TYPES.ERROR) {
            const error = toIframeJsforceBridgeError(
                event.data.error,
                'EHOST',
                'Parent host reported an iframe JSForce bridge error.'
            );
            for (const pending of this.pending.values()) {
                window.clearTimeout(pending.timer);
                pending.reject(error);
            }
            this.pending.clear();
            return;
        }

        if (event.data.type === IFRAME_JSFORCE_BRIDGE_PORT_MESSAGE_TYPES.EVENT) {
            const eventName = String(event.data.eventName || '').trim();
            if (!eventName) {
                return;
            }
            const payload =
                event.data.payload && typeof event.data.payload === 'object'
                    ? event.data.payload
                    : null;
            const hostEvent: IframeJsforceBridgeHostEvent = {
                eventName,
                payload,
            };
            for (const listener of Array.from(this.hostEventListeners)) {
                try {
                    listener(hostEvent);
                } catch {
                    // ignore listener errors
                }
            }
        }
    }
}

export async function connectIframeJsforceBridgeClient(
    options: IframeJsforceBridgeClientOptions = {}
) {
    const port = await bootstrapIframeJsforceBridge({
        timeoutMs: options.handshakeTimeoutMs,
    });
    return new IframeJsforceBridgeClient(port, options);
}
