import { bootstrapIframeBridge } from './bootstrapIframeBridge';
import {
    IFRAME_FS_BRIDGE_PORT_MESSAGE_TYPES,
    IFRAME_FS_BRIDGE_PROTOCOL,
    IFRAME_FS_BRIDGE_VERSION,
    isIframeFsBridgeEnvelope,
    isIframeFsBridgeMethod,
    toIframeFsBridgeError,
    type IframeFsBridgeChange,
    type IframeFsBridgeMethod,
    type IframeFsBridgeStat,
} from './iframeFsBridgeContract';

const DEFAULT_REQUEST_TIMEOUT_MS = 12000;

type PendingRequest = {
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
    timer: number;
};

type ClientOptions = {
    requestTimeoutMs?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toTransferableArrayBuffer(content: unknown) {
    if (content instanceof ArrayBuffer) {
        return content;
    }
    if (content instanceof Uint8Array) {
        return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
    }
    if (ArrayBuffer.isView(content)) {
        const view = content as ArrayBufferView;
        return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
    }
    throw new Error('Expected binary payload as ArrayBuffer or TypedArray.');
}

function createRequestId() {
    return `fs_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export class IframeFsBridgeClient {
    private port: MessagePort;
    private requestTimeoutMs: number;
    private pending = new Map<string, PendingRequest>();
    private fsEventListeners = new Set<(changes: IframeFsBridgeChange[]) => void>();

    private readonly boundHandlePortMessage = this.handlePortMessage.bind(this);

    constructor(port: MessagePort, options: ClientOptions = {}) {
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
        this.fsEventListeners.clear();
    }

    onFsEvent(listener: (changes: IframeFsBridgeChange[]) => void) {
        if (typeof listener !== 'function') {
            return { dispose() {} };
        }
        this.fsEventListeners.add(listener);
        return {
            dispose: () => {
                this.fsEventListeners.delete(listener);
            },
        };
    }

    async stat(path: string) {
        return (await this.request('stat', { path })) as IframeFsBridgeStat;
    }

    async readdir(path: string) {
        return (await this.request('readdir', { path })) as Array<{
            name: string;
            isFile: boolean;
            isDirectory: boolean;
            isSymbolicLink: boolean;
        }>;
    }

    async readFileBuffer(path: string) {
        return (await this.request('readFileBuffer', { path })) as ArrayBuffer;
    }

    async writeFile(path: string, content: ArrayBuffer | Uint8Array | ArrayBufferView) {
        const binaryPayload = toTransferableArrayBuffer(content);
        return await this.request(
            'writeFile',
            {
                path,
                content: binaryPayload,
            },
            [binaryPayload]
        );
    }

    async mkdir(path: string, options: { recursive?: boolean } = {}) {
        return await this.request('mkdir', { path, options });
    }

    async rm(path: string, options: { recursive?: boolean; force?: boolean } = {}) {
        return await this.request('rm', { path, options });
    }

    async mv(fromPath: string, toPath: string) {
        return await this.request('mv', { fromPath, toPath });
    }

    async exists(path: string) {
        return Boolean(await this.request('exists', { path }));
    }

    private async request(
        method: IframeFsBridgeMethod,
        args: Record<string, unknown>,
        transferables: Transferable[] = []
    ) {
        if (!isIframeFsBridgeMethod(method)) {
            throw new Error(`Unsupported bridge method: ${String(method)}`);
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
            this.port.postMessage(
                {
                    protocol: IFRAME_FS_BRIDGE_PROTOCOL,
                    version: IFRAME_FS_BRIDGE_VERSION,
                    type: IFRAME_FS_BRIDGE_PORT_MESSAGE_TYPES.REQUEST,
                    id,
                    method,
                    args,
                },
                transferables
            );
        });
    }

    private handlePortMessage(event: MessageEvent) {
        if (!isIframeFsBridgeEnvelope(event.data)) {
            return;
        }

        if (event.data.type === IFRAME_FS_BRIDGE_PORT_MESSAGE_TYPES.RESPONSE) {
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
                toIframeFsBridgeError(
                    event.data.error,
                    'EFS',
                    'Filesystem bridge request failed in the parent host.'
                )
            );
            return;
        }

        if (event.data.type === IFRAME_FS_BRIDGE_PORT_MESSAGE_TYPES.EVENT) {
            const changes = Array.isArray(event.data.changes)
                ? event.data.changes.filter(
                      change =>
                          isRecord(change) &&
                          typeof change.path === 'string' &&
                          typeof change.type === 'string'
                  )
                : [];
            if (!changes.length) {
                return;
            }
            for (const listener of Array.from(this.fsEventListeners)) {
                try {
                    listener(changes as IframeFsBridgeChange[]);
                } catch {
                    // ignore listener errors
                }
            }
            return;
        }

        if (event.data.type === IFRAME_FS_BRIDGE_PORT_MESSAGE_TYPES.ERROR) {
            const error = toIframeFsBridgeError(
                event.data.error,
                'EHOST',
                'Parent host reported an iframe bridge error.'
            );
            for (const pending of this.pending.values()) {
                window.clearTimeout(pending.timer);
                pending.reject(error);
            }
            this.pending.clear();
        }
    }
}

export async function connectIframeFsBridgeClient(options: ClientOptions = {}) {
    const port = await bootstrapIframeBridge();
    return new IframeFsBridgeClient(port, options);
}
