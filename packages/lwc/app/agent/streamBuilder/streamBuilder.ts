import type { AssistantModelMessage, ModelMessage } from 'ai';
import type { StreamChunk } from '../Agent/Agent';

export function createStreamMessageBuilder(
    onStreamMessage?: (message: ModelMessage | null) => void
) {
    let streamingMessage: AssistantModelMessage | null = null;
    let streamingParts: any[] = [];
    const normalizeToolCallId = (part: any, fallback?: string) =>
        part?.toolCallId || part?.callId || part?.call_id || part?.id || fallback || `tool-${Date.now()}`;


    const ensureMessage = () => {
        if (!streamingMessage) {
            streamingParts = [];
            streamingMessage = { role: 'assistant', content: streamingParts };
        }
        return streamingMessage;
    };

    const emit = () => {
        if (onStreamMessage) onStreamMessage(streamingMessage);
    };

    const updateParts = (updater: (parts: any[]) => void, shouldEmit = true) => {
        ensureMessage();
        const nextParts = Array.isArray(streamingParts) ? [...streamingParts] : [];
        updater(nextParts);
        streamingParts = nextParts;
        streamingMessage = { ...streamingMessage, content: nextParts };
        if (shouldEmit) emit();
    };

    const finalizeReasoning = (shouldEmit = true) => {
        updateParts(parts => {
            if (parts.length === 0) return;
            const last = parts[parts.length - 1];
            if (last?.type === 'reasoning' && last.state === 'streaming') {
                parts[parts.length - 1] = { ...last, state: 'done' };
            }
        }, shouldEmit);
    };

    const startReasoning = () => {
        finalizeReasoning(false);
        updateParts(parts => {
            parts.push({ type: 'reasoning', text: '', state: 'streaming' });
        });
    };

    const appendOrUpdateTextPart = (text: string, type: 'text' | 'reasoning') => {
        if (!text) return;
        if (type === 'reasoning') {
            updateParts(parts => {
                const last = parts.length > 0 ? parts[parts.length - 1] : null;
                if (last && last.type === 'reasoning' && last.state !== 'done') {
                    parts[parts.length - 1] = {
                        ...last,
                        text: `${last.text || ''}${text}`,
                    };
                    return;
                }
                parts.push({ type, text, state: 'streaming' });
            });
            return;
        }

        finalizeReasoning(false);
        updateParts(parts => {
            const last = parts.length > 0 ? parts[parts.length - 1] : null;
            if (last && last.type === 'text') {
                parts[parts.length - 1] = {
                    ...last,
                    text: `${last.text || ''}${text}`,
                };
                return;
            }
            parts.push({ type, text });
        });
    };

    const upsertToolCallPart = (
        parts: any[],
        {
            toolCallId,
            toolName,
            input,
            state,
        }: { toolCallId: string; toolName?: string; input?: unknown; state: string }
    ) => {
        const idx = parts.findIndex(part => {
            if (!part || typeof part !== 'object') return false;
            if (part.type !== 'tool-call') return false;
            const existingId = normalizeToolCallId(part);
            return existingId === toolCallId;
        });
        const next = {
            type: 'tool-call',
            toolCallId,
            ...(toolName ? { toolName } : {}),
            input,
            arguments: typeof input === 'string' ? input : undefined,
            state,
        };
        if (idx === -1) {
            parts.push(next);
            return;
        }
        parts[idx] = {
            ...parts[idx],
            ...next,
        };
    };

    const handleChunk = (chunk: StreamChunk) => {
        switch (chunk.type) {
            case 'content':
                appendOrUpdateTextPart(chunk.content, 'text');
                break;
            case 'reasoning':
                appendOrUpdateTextPart(chunk.content, 'reasoning');
                break;
            case 'tool_calls': {
                if (!Array.isArray(chunk.toolCalls)) break;
                finalizeReasoning(false);
                updateParts(parts => {
                    chunk.toolCalls.forEach((tc, index) => {
                        const toolCallId = normalizeToolCallId(tc, `tool-${Date.now()}-${index}`);
                        upsertToolCallPart(parts, {
                            toolCallId,
                            toolName: tc?.toolName,
                            input: tc?.input,
                            state: 'input-available',
                        });
                    });
                });
                break;
            }
            case 'tool_call_delta': {
                finalizeReasoning(false);
                updateParts(parts => {
                    const toolCallId = normalizeToolCallId(
                        { toolCallId: chunk.toolCallId },
                        chunk.toolCallId
                    );
                    const existing = parts.find(part => {
                        if (!part || typeof part !== 'object') return false;
                        if (part.type !== 'tool-call') return false;
                        return normalizeToolCallId(part) === toolCallId;
                    });
                    const existingText =
                        typeof existing?.input === 'string'
                            ? existing.input
                            : typeof existing?.arguments === 'string'
                              ? existing.arguments
                              : '';
                    const nextText = `${existingText || ''}${chunk.delta || ''}`;
                    upsertToolCallPart(parts, {
                        toolCallId,
                        toolName: chunk.toolName || existing?.toolName,
                        input: nextText,
                        state: 'input-streaming',
                    });
                });
                break;
            }
            case 'tool_result': {
                finalizeReasoning(false);
                updateParts(parts => {
                    const toolOutput =
                        chunk.toolResult && typeof chunk.toolResult === 'object' && 'output' in chunk.toolResult
                            ? chunk.toolResult.output
                            : chunk.toolResult;
                    parts.push({
                        type: 'tool-result',
                        toolCallId: chunk.toolCall?.toolCallId,
                        toolName: chunk.toolCall?.toolName,
                        result: chunk.toolResult,
                        output: toolOutput,
                        //state: chunk.toolResult?.success ? 'output-available' : 'output-error',
                    });
                });
                break;
            }
            case 'done': {
                finalizeReasoning(false);
                if (Array.isArray(streamingParts) && streamingParts.length > 0) emit();
                if (onStreamMessage) onStreamMessage(null);
                break;
            }
            case 'error':
                break;
        }
    };

    return { handleChunk, startReasoning, finalizeReasoning };
}
