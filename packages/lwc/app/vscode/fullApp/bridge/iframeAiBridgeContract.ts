export const IFRAME_AI_BRIDGE_PROTOCOL = 'sf-toolkit.iframeAiBridge';
export const IFRAME_AI_BRIDGE_VERSION = 1;

export const IFRAME_AI_BRIDGE_QUERY_FLAG = 'aiBridge';
export const IFRAME_AI_BRIDGE_QUERY_VERSION_PARAM = 'aiBridgeProtocolVersion';
export const IFRAME_AI_BRIDGE_QUERY_PARENT_ORIGIN_PARAM = 'bridgeParentOrigin';

export const IFRAME_AI_BRIDGE_WINDOW_MESSAGE_TYPES = {
    HELLO: 'bridgeHello',
    PORT: 'bridgePort',
    ERROR: 'bridgeError',
} as const;

export const IFRAME_AI_BRIDGE_PORT_MESSAGE_TYPES = {
    READY: 'bridgeReady',
    REQUEST: 'aiRequest',
    CHUNK: 'aiChunk',
    CANCEL: 'aiCancel',
    ERROR: 'bridgeError',
} as const;

export const IFRAME_AI_BRIDGE_METHODS = ['ai.complete', 'ai.getConfig'] as const;

export const IFRAME_AI_BRIDGE_CHUNK_TYPES = {
    TEXT_DELTA: 'text_delta',
    REASONING_DELTA: 'reasoning_delta',
    TOOL_CALL: 'tool_call',
    AI_CONFIG: 'ai_config',
    DONE: 'done',
    ERROR: 'error',
} as const;

export type IframeAiBridgeMethod = (typeof IFRAME_AI_BRIDGE_METHODS)[number];

export type IframeAiBridgeError = {
    code: string;
    message: string;
};

export type IframeAiBridgeModelInfo = {
    id: string;
    label: string;
    provider: string;
    isDefault: boolean;
};

export type IframeAiBridgeConfigData = {
    provider: string;
    models: IframeAiBridgeModelInfo[];
    isConfigured: boolean;
};

export type IframeAiBridgeToolSchema = {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
};

export type IframeAiBridgeModelConfig = {
    modelId?: string;
    systemPrompt?: string;
    tools?: IframeAiBridgeToolSchema[];
    [key: string]: unknown;
};

export type IframeAiBridgeMessage = {
    role: string;
    content: unknown;
};

export type IframeAiBridgeChunk =
    | { type: 'text_delta'; text: string }
    | { type: 'reasoning_delta'; text: string }
    | { type: 'tool_call'; toolCallId: string; toolName: string; args: unknown }
    | { type: 'ai_config'; provider: string; models: IframeAiBridgeModelInfo[]; isConfigured: boolean }
    | { type: 'done'; finishReason?: string }
    | { type: 'error'; code: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isIframeAiBridgeEnvelope(value: unknown): value is Record<string, unknown> {
    if (!isRecord(value)) {
        return false;
    }
    return (
        value.protocol === IFRAME_AI_BRIDGE_PROTOCOL &&
        Number(value.version) === IFRAME_AI_BRIDGE_VERSION &&
        typeof value.type === 'string'
    );
}

export function isIframeAiBridgeMethod(value: unknown): value is IframeAiBridgeMethod {
    return (
        typeof value === 'string' &&
        (IFRAME_AI_BRIDGE_METHODS as readonly string[]).includes(value)
    );
}

export function toIframeAiBridgeError(
    error: unknown,
    fallbackCode = 'EUNKNOWN',
    fallbackMessage = 'Bridge operation failed.'
): IframeAiBridgeError {
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
