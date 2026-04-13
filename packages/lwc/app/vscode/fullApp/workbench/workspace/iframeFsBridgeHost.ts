import {
    IFRAME_FS_BRIDGE_PORT_MESSAGE_TYPES,
    IFRAME_FS_BRIDGE_WINDOW_MESSAGE_TYPES,
    IFRAME_FS_BRIDGE_PROTOCOL,
    IFRAME_FS_BRIDGE_VERSION,
    isIframeFsBridgeEnvelope,
    isIframeFsBridgeMethod,
    toIframeFsBridgeError,
    type IframeFsBridgeChange,
    type IframeFsBridgeError,
} from './iframeFsBridgeContract';

const DEFAULT_HANDSHAKE_TIMEOUT_MS = 15000;

type BridgeHostOptions = {
    iframe: HTMLIFrameElement;
    targetOrigin: string;
    getWorkspaceRoot: () => string;
    getFileSystem: () => Promise<any> | any;
    onError?: (error: IframeFsBridgeError) => void;
    handshakeTimeoutMs?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeAbsolutePath(path: unknown) {
    const raw = String(path || '')
        .trim()
        .replace(/\\/g, '/');
    if (!raw || raw === '/') {
        return '/';
    }
    const parts = raw.split('/').filter(Boolean);
    return `/${parts.join('/')}`;
}

function isWithinWorkspaceRoot(path: string, workspaceRoot: string) {
    const normalizedPath = normalizeAbsolutePath(path);
    const normalizedRoot = normalizeAbsolutePath(workspaceRoot);
    return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

function toArrayBuffer(value: unknown) {
    if (value instanceof ArrayBuffer) {
        return value;
    }
    if (value instanceof Uint8Array) {
        return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
    }
    if (ArrayBuffer.isView(value)) {
        const view = value as ArrayBufferView;
        return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
    }
    throw {
        code: 'EINVAL',
        message: 'Expected binary payload as ArrayBuffer or TypedArray.',
    };
}

function toUint8Array(value: unknown) {
    if (value instanceof Uint8Array) {
        return value;
    }
    if (value instanceof ArrayBuffer) {
        return new Uint8Array(value);
    }
    if (ArrayBuffer.isView(value)) {
        const view = value as ArrayBufferView;
        return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    }
    throw {
        code: 'EINVAL',
        message: 'Expected binary payload as ArrayBuffer or TypedArray.',
    };
}

function toStatPayload(stat: any = {}) {
    const mtime =
        stat?.mtime instanceof Date
            ? stat.mtime.getTime()
            : Number(stat?.mtimeMs || stat?.mtime || Date.now());
    return {
        isFile: Boolean(stat?.isFile),
        isDirectory: Boolean(stat?.isDirectory),
        isSymbolicLink: Boolean(stat?.isSymbolicLink),
        size: Number(stat?.size || 0),
        mode: Number(stat?.mode || 0),
        mtimeMs: Number.isFinite(mtime) ? mtime : Date.now(),
    };
}

class IframeFsBridgeHost {
    private iframe: HTMLIFrameElement;
    private targetOrigin: string;
    private getWorkspaceRoot: () => string;
    private getFileSystem: () => Promise<any> | any;
    private onError?: (error: IframeFsBridgeError) => void;
    private handshakeTimeoutMs: number;
    private started = false;
    private disposed = false;
    private ready = false;
    private handshakeTimer: number | null = null;
    private port: MessagePort | null = null;

    private readonly boundHandleWindowMessage = this.handleWindowMessage.bind(this);
    private readonly boundHandlePortMessage = this.handlePortMessage.bind(this);

    constructor(options: BridgeHostOptions) {
        this.iframe = options.iframe;
        this.targetOrigin = options.targetOrigin;
        this.getWorkspaceRoot = options.getWorkspaceRoot;
        this.getFileSystem = options.getFileSystem;
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
                message: 'Iframe bridge handshake timed out.',
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

    private reportError(error: IframeFsBridgeError) {
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
        if (!isIframeFsBridgeEnvelope(event.data)) {
            return;
        }

        if (event.data.type === IFRAME_FS_BRIDGE_WINDOW_MESSAGE_TYPES.HELLO) {
            this.openPort();
            return;
        }

        if (event.data.type === IFRAME_FS_BRIDGE_WINDOW_MESSAGE_TYPES.ERROR) {
            this.reportError(
                toIframeFsBridgeError(
                    event.data.error,
                    'ECLIENT',
                    'Iframe bridge reported an error.'
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

        const payload = {
            protocol: IFRAME_FS_BRIDGE_PROTOCOL,
            version: IFRAME_FS_BRIDGE_VERSION,
            type: IFRAME_FS_BRIDGE_WINDOW_MESSAGE_TYPES.PORT,
            workspaceRoot: normalizeAbsolutePath(this.getWorkspaceRoot()),
        };
        this.iframe.contentWindow.postMessage(payload, this.targetOrigin, [channel.port2]);
    }

    private async handlePortMessage(event: MessageEvent) {
        if (this.disposed) {
            return;
        }
        if (!isIframeFsBridgeEnvelope(event.data)) {
            return;
        }

        if (event.data.type === IFRAME_FS_BRIDGE_PORT_MESSAGE_TYPES.READY) {
            this.ready = true;
            if (this.handshakeTimer) {
                window.clearTimeout(this.handshakeTimer);
                this.handshakeTimer = null;
            }
            return;
        }

        if (event.data.type === IFRAME_FS_BRIDGE_PORT_MESSAGE_TYPES.REQUEST) {
            await this.handleFsRequest(event.data);
            return;
        }

        if (event.data.type === IFRAME_FS_BRIDGE_PORT_MESSAGE_TYPES.ERROR) {
            this.reportError(
                toIframeFsBridgeError(
                    event.data.error,
                    'ECLIENT',
                    'Iframe bridge request pipeline failed.'
                )
            );
        }
    }

    private async handleFsRequest(message: Record<string, unknown>) {
        const id = typeof message.id === 'string' ? message.id : null;
        if (!id) {
            return;
        }
        try {
            const method = message.method;
            if (!isIframeFsBridgeMethod(method)) {
                throw {
                    code: 'EMETHOD',
                    message: 'Unsupported filesystem bridge method.',
                };
            }
            const args = isRecord(message.args) ? message.args : {};
            const { result, changes } = await this.executeFsMethod(method, args);

            const response = {
                protocol: IFRAME_FS_BRIDGE_PROTOCOL,
                version: IFRAME_FS_BRIDGE_VERSION,
                type: IFRAME_FS_BRIDGE_PORT_MESSAGE_TYPES.RESPONSE,
                id,
                ok: true,
                result,
            };
            const transferables = result instanceof ArrayBuffer ? [result] : [];
            this.port?.postMessage(response, transferables);

            if (Array.isArray(changes) && changes.length > 0) {
                this.port?.postMessage({
                    protocol: IFRAME_FS_BRIDGE_PROTOCOL,
                    version: IFRAME_FS_BRIDGE_VERSION,
                    type: IFRAME_FS_BRIDGE_PORT_MESSAGE_TYPES.EVENT,
                    changes,
                });
            }
        } catch (error) {
            const bridgeError = toIframeFsBridgeError(
                error,
                'EFS',
                'Filesystem bridge request failed.'
            );
            this.port?.postMessage({
                protocol: IFRAME_FS_BRIDGE_PROTOCOL,
                version: IFRAME_FS_BRIDGE_VERSION,
                type: IFRAME_FS_BRIDGE_PORT_MESSAGE_TYPES.RESPONSE,
                id,
                ok: false,
                error: bridgeError,
            });
        }
    }

    private assertWorkspacePath(pathValue: unknown, workspaceRoot = this.getWorkspaceRoot()) {
        const workspacePath = normalizeAbsolutePath(pathValue);
        const normalizedRoot = normalizeAbsolutePath(workspaceRoot);
        if (!isWithinWorkspaceRoot(workspacePath, normalizedRoot)) {
            throw {
                code: 'EACCESS',
                message: `${workspacePath} is outside the workspace root ${normalizedRoot}.`,
            };
        }
        return workspacePath;
    }

    private async executeFsMethod(method: string, args: Record<string, unknown>) {
        const fs = await this.getFileSystem?.();
        if (!fs) {
            throw {
                code: 'EFS',
                message: 'Workspace filesystem is unavailable.',
            };
        }
        const workspaceRoot = this.getWorkspaceRoot();
        let changes: IframeFsBridgeChange[] = [];
        let result: unknown = null;

        switch (method) {
            case 'stat': {
                const path = this.assertWorkspacePath(args.path, workspaceRoot);
                const stat = await fs.stat(path);
                result = toStatPayload(stat);
                break;
            }
            case 'readdir': {
                const path = this.assertWorkspacePath(args.path, workspaceRoot);
                const entries = await fs.readdirWithFileTypes(path);
                result = Array.isArray(entries)
                    ? entries.map((entry: any) => ({
                          name: String(entry?.name || ''),
                          isFile: Boolean(entry?.isFile),
                          isDirectory: Boolean(entry?.isDirectory),
                          isSymbolicLink: Boolean(entry?.isSymbolicLink),
                      }))
                    : [];
                break;
            }
            case 'readFileBuffer': {
                const path = this.assertWorkspacePath(args.path, workspaceRoot);
                const bytes = await fs.readFileBuffer(path);
                result = toArrayBuffer(bytes);
                break;
            }
            case 'writeFile': {
                const path = this.assertWorkspacePath(args.path, workspaceRoot);
                const content = toUint8Array(args.content);
                await fs.writeFile(path, content, 'binary');
                result = { path };
                changes = [{ path, type: 'updated' }];
                break;
            }
            case 'mkdir': {
                const path = this.assertWorkspacePath(args.path, workspaceRoot);
                const options = isRecord(args.options) ? args.options : {};
                await fs.mkdir(path, { recursive: options.recursive !== false });
                result = { path };
                changes = [{ path, type: 'added' }];
                break;
            }
            case 'rm': {
                const path = this.assertWorkspacePath(args.path, workspaceRoot);
                const options = isRecord(args.options) ? args.options : {};
                await fs.rm(path, {
                    recursive: Boolean(options.recursive),
                    force: Boolean(options.force),
                });
                result = { path };
                changes = [{ path, type: 'deleted' }];
                break;
            }
            case 'mv': {
                const fromPath = this.assertWorkspacePath(args.fromPath, workspaceRoot);
                const toPath = this.assertWorkspacePath(args.toPath, workspaceRoot);
                await fs.mv(fromPath, toPath);
                result = { fromPath, toPath };
                changes = [
                    { path: fromPath, type: 'deleted' },
                    { path: toPath, type: 'added' },
                ];
                break;
            }
            case 'exists': {
                const path = this.assertWorkspacePath(args.path, workspaceRoot);
                result = Boolean(await fs.exists(path));
                break;
            }
            default:
                throw {
                    code: 'EMETHOD',
                    message: 'Unsupported filesystem bridge method.',
                };
        }

        return { result, changes };
    }
}

export function createIframeFsBridgeHost(options: BridgeHostOptions) {
    return new IframeFsBridgeHost(options);
}
