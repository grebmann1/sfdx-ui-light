import type { ModelMessage, ToolModelMessage, ToolResultPart } from 'ai';
import { isNotUndefinedOrNull } from 'shared/utils';
export function buildUserMessageParts({ text, filesData }) {
    const parts = [];
    if (typeof text === 'string' && text.trim()) {
        parts.push({ type: 'text', text });
    }
    const files = Array.isArray(filesData) ? filesData : [];
    files.forEach(file => {
        if (!file || typeof file !== 'object') return;
        const url = typeof file.content === 'string' ? file.content : '';
        const mediaType = typeof file.type === 'string' ? file.type : '';
        if (!url || !mediaType) return;
        parts.push({
            type: 'file',
            url,
            mediaType,
            filename: typeof file.name === 'string' ? file.name : undefined,
        });
    });
    return parts;
}

export function createUserModelMessage({ text, filesData }): ModelMessage {
    return {
        role: 'user',
        content: buildUserMessageParts({ text, filesData }),
    };
}

export function isUiMessage(message: unknown): boolean {
    if (message == null || typeof message !== 'object') return false;
    const candidate = message as { id?: unknown; role?: unknown; parts?: unknown };
    return (
        typeof candidate.id === 'string' &&
        typeof candidate.role === 'string' &&
        Array.isArray(candidate.parts)
    );
}

// Helper method to process toolResult and transform it to message(s)
export function processToolResultToMessage(toolResult: any, toolCall: any): ToolModelMessage {
    const toolResultPart = {
        type: 'tool-result',
        toolName: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output: { 
            type: 'content',
            value: [
                {
                    type: 'text',
                    text: toolResult.text || toolResult.output || toolResult.content || ''
                },
                ...(toolResult.images && Array.isArray(toolResult.images) && toolResult.images.length > 0 ? toolResult.images.map(image => ({
                    type: 'image-data',
                    data: image.dataUrl,
                    mediaType: image.mediaType,
                })) : [])
            ]
        },
    } as unknown as ToolResultPart;

    return {
        role: 'tool',
        content: [toolResultPart],
    } as ToolModelMessage;
};

export function areMessagesEqual(msg1, msg2) {
    return (
        msg1 &&
        msg2 &&
        ((msg1.id === msg2.id && isNotUndefinedOrNull(msg1.id)) ||
            (msg1._key === msg2._key && isNotUndefinedOrNull(msg1._key)))
    );
}

export function appendMessageIfNotExists(messages, newMsg) {
    console.log('[appendMessageIfNotExists] appendMessageIfNotExists', {messages, newMsg});
    if (!messages.some(m => areMessagesEqual(m, newMsg))) {
        return [...messages, newMsg];
    }
    return messages || [];
}

export const Message = {
    areMessagesEqual,
    appendMessageIfNotExists,
    isUiMessage,
    createUserModelMessage,
    processToolResultToMessage,
}