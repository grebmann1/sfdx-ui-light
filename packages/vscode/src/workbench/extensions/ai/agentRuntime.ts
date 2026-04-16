import { isAbortLikeError, resolveWorkbenchAgentSettings } from './agentConfig';

const MAX_STORED_MESSAGES = 24;

const conversationsByKey = new Map();

export function formatWorkbenchRuntimeError(error) {
    const rawMessage = error instanceof Error ? error.message : String(error ?? 'Unknown error');
    const compactMessage = rawMessage.replace(/\s+/g, ' ').trim();

    if (
        compactMessage.includes('No tool call found for function call output with call_id') ||
        compactMessage.includes('function call output with call_id')
    ) {
        return {
            message:
                'The model lost sync with a tool call while processing the request. Please retry the action.',
            details: rawMessage,
            code: 'tool-call-sync',
        };
    }

    if (
        compactMessage.startsWith('AI_TypeValidationError:') ||
        compactMessage.includes('Type validation failed:')
    ) {
        return {
            message: 'The model returned an invalid streaming payload. Please retry the action.',
            details: rawMessage,
            code: 'invalid-stream-payload',
        };
    }

    return {
        message: rawMessage || 'Unknown error',
        details: rawMessage,
        code: 'runtime-error',
    };
}

function createConversationState() {
    return {
        conversationId: crypto.randomUUID(),
        messages: [],
    };
}

function getOrCreateConversationState(key, shouldReset = false) {
    if (!key) {
        return createConversationState();
    }
    if (shouldReset || !conversationsByKey.has(key)) {
        conversationsByKey.set(key, createConversationState());
    }
    return conversationsByKey.get(key);
}

function clearConversationState(key) {
    if (key) {
        conversationsByKey.delete(key);
    }
}

function buildModelMessage(role, text) {
    return {
        role,
        content: [{ type: 'text', text: typeof text === 'string' ? text : String(text ?? '') }],
    };
}

function finalizeMessageForStorage(message) {
    if (!message || typeof message !== 'object') {
        return message;
    }
    if (!Array.isArray(message.content)) {
        return message;
    }
    const content = message.content.filter(part => {
        if (!part || typeof part !== 'object') {
            return false;
        }
        return part.type === 'text' && typeof part.text === 'string' && part.text.trim().length > 0;
    });
    if (content.length === 0) {
        return null;
    }
    return {
        ...message,
        content,
    };
}

function appendConversationMessages(conversation, newMessages) {
    const finalized = (Array.isArray(newMessages) ? newMessages : [])
        .map(finalizeMessageForStorage)
        .filter(Boolean);
    conversation.messages = [...(conversation?.messages || []), ...finalized].slice(
        -MAX_STORED_MESSAGES
    );
}

function buildSystemPrompt(systemPrompt, conversationId) {
    return `### Conversation ID: ${conversationId}\n\n${systemPrompt || ''}`;
}

// AI SDK v6 ToolResultOutput must be: { type: 'text' | 'json' | 'error-text' | 'execution-denied', ... }
const TOOL_RESULT_OUTPUT_TYPES = new Set(['text', 'json', 'error-text', 'execution-denied']);

function toToolResult(output) {
    if (typeof output === 'string') {
        return { type: 'text', value: output };
    }
    if (output == null) {
        return { type: 'text', value: '' };
    }
    if (
        output &&
        typeof output === 'object' &&
        typeof output.type === 'string' &&
        TOOL_RESULT_OUTPUT_TYPES.has(output.type)
    ) {
        return output;
    }
    return { type: 'json', value: output };
}

function buildBridgeToolSchemas(toolsByName) {
    return (Object.values(toolsByName) as Array<Record<string, unknown>>)
        .filter(t => !!t && typeof t['name'] === 'string')
        .map(t => ({
            name: t['name'] as string,
            description: typeof t['description'] === 'string' ? (t['description'] as string) : '',
            parameters:
                t['parameters'] && typeof t['parameters'] === 'object'
                    ? (t['parameters'] as Record<string, unknown>)
                    : { type: 'object', properties: {}, additionalProperties: false },
        }));
}

async function* streamViaBridge(bridgeClient, options) {
    const { messages, toolsByName, maxToolRounds, systemPrompt, modelConfig, conversationId, abortSignal } = options;
    let currentMessages = [...messages];
    let roundCount = 0;

    const toolSchemas = buildBridgeToolSchemas(toolsByName);

    while (roundCount < maxToolRounds) {
        if (abortSignal.aborted) {
            return;
        }
        roundCount++;
        const collectedToolCalls = [];
        // complete_messages carries the full AI SDK response messages from the LWC runtime,
        // including any provider-specific metadata (e.g. Gemini thought_signature on reasoning
        // parts). When present, these are used verbatim for the next round so the provider can
        // correctly reconstruct signed thinking content in the next API call.
        let completeResponseMessages: unknown[] | null = null;

        for await (const chunk of bridgeClient.complete(currentMessages, {
            systemPrompt,
            ...modelConfig,
            tools: toolSchemas,
        })) {
            if (abortSignal.aborted) {
                return;
            }
            switch (chunk.type) {
                case 'text_delta':
                    yield { type: 'text-delta', text: chunk.text };
                    break;
                case 'reasoning_delta':
                    yield { type: 'reasoning-delta', text: chunk.text };
                    break;
                case 'tool_call':
                    collectedToolCalls.push(chunk);
                    yield { type: 'tool-call', toolCallId: chunk.toolCallId, toolName: chunk.toolName, input: chunk.args ?? {} };
                    break;
                case 'complete_messages':
                    completeResponseMessages = Array.isArray(chunk.messages) ? chunk.messages : null;
                    break;
                case 'error':
                    yield { type: 'error', error: { message: chunk.message, code: chunk.code } };
                    return;
                case 'done':
                    break;
                default:
                    break;
            }
        }

        if (collectedToolCalls.length === 0) {
            break;
        }

        if (completeResponseMessages) {
            // Use the AI SDK response messages verbatim — they carry thought_signature and other
            // provider metadata that would be lost if we reconstructed the message manually.
            currentMessages = [...currentMessages, ...completeResponseMessages];
        } else {
            // Fallback for runtimes that don't send complete_messages: build the assistant
            // message from the individual tool-call chunks (no provider metadata).
            const assistantContent = collectedToolCalls.map(tc => ({
                type: 'tool-call',
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                input: tc.args ?? {},
            }));
            currentMessages = [...currentMessages, { role: 'assistant', content: assistantContent }];
        }

        // Execute tools locally and build tool result messages
        for (const tc of collectedToolCalls) {
            const toolImpl = toolsByName[tc.toolName];
            let rawResult;
            try {
                if (toolImpl && typeof toolImpl.execute === 'function') {
                    rawResult = await toolImpl.execute({ ...(tc.args && typeof tc.args === 'object' ? tc.args : {}), conversationId });
                } else {
                    rawResult = { error: `Tool "${tc.toolName}" is not available.` };
                }
            } catch (execError) {
                rawResult = { error: execError instanceof Error ? execError.message : String(execError) };
            }

            currentMessages = [...currentMessages, {
                role: 'tool',
                content: [{
                    type: 'tool-result',
                    toolCallId: tc.toolCallId,
                    toolName: tc.toolName,
                    output: toToolResult(rawResult),
                }],
            }];

            yield { type: 'tool-result', toolCallId: tc.toolCallId, toolName: tc.toolName, output: toToolResult(rawResult) };
        }
    }
}

export async function createWorkbenchAgentRequest({
    conversationKey,
    resetConversation = false,
    modelId,
    promptText,
    tools = [],
    aiBridgeClient = null,
}) {
    if (!aiBridgeClient) {
        throw new Error(
            'Workbench AI bridge is not available. Please reload the extension.'
        );
    }

    const settings = resolveWorkbenchAgentSettings({ modelId });

    const conversation = getOrCreateConversationState(conversationKey, resetConversation);
    const conversationId = conversation.conversationId;
    const previousMessages = conversation.messages || [];
    const userMessage = buildModelMessage('user', promptText);
    const messages = [...previousMessages, userMessage];
    const abortController = new AbortController();

    return {
        conversationId,
        abort() {
            abortController.abort();
        },
        async *stream() {
            let assistantText = '';
            const toolsByName = {};
            (Array.isArray(tools) ? tools : []).forEach(t => {
                if (t?.name) {
                    toolsByName[t.name] = t;
                }
            });

            try {
                console.log('[agentRuntime] streamViaBridge', {settings})
                const bridgeStream = streamViaBridge(aiBridgeClient, {
                    messages,
                    toolsByName,
                    maxToolRounds: settings.maxToolRounds,
                    systemPrompt: buildSystemPrompt(settings.systemPrompt, conversationId),
                    modelConfig: {
                        modelId: settings.selectedModel,
                        provider: settings.provider,
                        reasoning: settings.selectedReasoning,
                    },
                    conversationId,
                    abortSignal: abortController.signal,
                });

                for await (const part of bridgeStream) {
                    if (abortController.signal.aborted) {
                        yield { type: 'content', content: '\n\n[Cancelled]' };
                        yield { type: 'done' };
                        return;
                    }

                    switch (part?.type) {
                        case 'text-delta':
                            assistantText += part.text || '';
                            yield { type: 'content', content: part.text };
                            break;
                        case 'reasoning-delta':
                            yield { type: 'reasoning', content: part.text };
                            break;
                        case 'tool-call':
                            yield { type: 'tool_calls', toolCalls: [{ toolCallId: part.toolCallId, toolName: part.toolName, input: part.input ?? {} }] };
                            break;
                        case 'tool-result': {
                            const toolCallInfo = { toolCallId: part.toolCallId, toolName: part.toolName, input: {} };
                            yield { type: 'tool_result', toolCall: toolCallInfo, toolResult: toToolResult(part.output) };
                            break;
                        }
                        case 'error':
                            yield { type: 'error', content: `Error: ${part.error?.message || 'Unknown error'}`, errorCode: part.error?.code };
                            yield { type: 'done' };
                            return;
                        default:
                            break;
                    }
                }

                if (!abortController.signal.aborted) {
                    const storedMessages = [userMessage];
                    if (assistantText.trim().length > 0) {
                        storedMessages.push(buildModelMessage('assistant', assistantText));
                    }
                    appendConversationMessages(conversation, storedMessages);
                }
                yield { type: 'done' };
            } catch (error) {
                if (isAbortLikeError(error) || abortController.signal.aborted) {
                    yield { type: 'content', content: '\n\n[Cancelled]' };
                    yield { type: 'done' };
                    return;
                }
                const formattedError = formatWorkbenchRuntimeError(error);
                if (
                    formattedError.code === 'tool-call-sync' ||
                    formattedError.code === 'invalid-stream-payload'
                ) {
                    clearConversationState(conversationKey);
                }
                yield {
                    type: 'error',
                    content: `Error: ${formattedError.message}`,
                    details: formattedError.details,
                    errorCode: formattedError.code,
                };
                yield { type: 'done' };
            }
        },
    };
}
