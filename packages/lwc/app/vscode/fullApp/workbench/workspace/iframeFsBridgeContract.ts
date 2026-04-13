export const IFRAME_FS_BRIDGE_PROTOCOL = 'sf-toolkit.iframeFsBridge';
export const IFRAME_FS_BRIDGE_VERSION = 1;

export const IFRAME_FS_BRIDGE_WINDOW_MESSAGE_TYPES = {
    HELLO: 'bridgeHello',
    PORT: 'bridgePort',
    ERROR: 'bridgeError',
} as const;

export const IFRAME_FS_BRIDGE_PORT_MESSAGE_TYPES = {
    READY: 'bridgeReady',
    REQUEST: 'fsRequest',
    RESPONSE: 'fsResponse',
    EVENT: 'fsEvent',
    ERROR: 'bridgeError',
} as const;

export const IFRAME_FS_BRIDGE_METHODS = [
    'stat',
    'readdir',
    'readFileBuffer',
    'writeFile',
    'mkdir',
    'rm',
    'mv',
    'exists',
] as const;

export type IframeFsBridgeMethod = (typeof IFRAME_FS_BRIDGE_METHODS)[number];
export type IframeFsBridgeChangeType = 'added' | 'updated' | 'deleted';

export type IframeFsBridgeError = {
    code: string;
    message: string;
};

export type IframeFsBridgeChange = {
    path: string;
    type: IframeFsBridgeChangeType;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isIframeFsBridgeEnvelope(value: unknown): value is Record<string, unknown> {
    if (!isRecord(value)) {
        return false;
    }
    return (
        value.protocol === IFRAME_FS_BRIDGE_PROTOCOL &&
        Number(value.version) === IFRAME_FS_BRIDGE_VERSION &&
        typeof value.type === 'string'
    );
}

export function isIframeFsBridgeMethod(value: unknown): value is IframeFsBridgeMethod {
    return (
        typeof value === 'string' && (IFRAME_FS_BRIDGE_METHODS as readonly string[]).includes(value)
    );
}

export function toIframeFsBridgeError(
    error: unknown,
    fallbackCode = 'EUNKNOWN',
    fallbackMessage = 'Bridge operation failed.'
): IframeFsBridgeError {
    if (isRecord(error)) {
        const code =
            typeof error.code === 'string' && error.code.trim() ? error.code : fallbackCode;
        const message =
            typeof error.message === 'string' && error.message.trim()
                ? error.message
                : fallbackMessage;
        return { code, message };
    }
    if (error instanceof Error) {
        return {
            code: fallbackCode,
            message: error.message || fallbackMessage,
        };
    }
    return {
        code: fallbackCode,
        message: typeof error === 'string' ? error : fallbackMessage,
    };
}
