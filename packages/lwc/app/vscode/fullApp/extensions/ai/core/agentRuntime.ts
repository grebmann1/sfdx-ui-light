/* eslint-disable import/no-unresolved */
import {
    createProviderInstance,
    getReasoningConfigFromSelection,
    resolveProviderModelInstance,
    resolveProviderOptions,
} from 'agent/utils';
import { jsonSchema, stepCountIs, streamText, tool as createAiSdkTool } from 'ai';
import { guid } from 'shared/utils';
import { z } from 'zod';

const MAX_STORED_MESSAGES = 24;

import { isAbortLikeError, resolveWorkbenchAgentSettings } from './agentConfig';

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
        conversationId: guid(),
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

function normalizeToolInputSchema(schema) {
    if (schema == null) {
        return z.object({});
    }
    if (typeof schema?.safeParse === 'function' || typeof schema?._def === 'object') {
        return schema;
    }
    return jsonSchema(schema);
}

function toAiSdkTools(tools, extraContext = {}) {
    const result = {};
    (Array.isArray(tools) ? tools : []).forEach(rawTool => {
        if (
            !rawTool ||
            typeof rawTool !== 'object' ||
            typeof rawTool.name !== 'string' ||
            typeof rawTool.execute !== 'function'
        ) {
            return;
        }
        result[rawTool.name] = createAiSdkTool({
            description: rawTool.description || '',
            inputSchema: normalizeToolInputSchema(rawTool.parameters),
            execute: async input => rawTool.execute({ ...(input || {}), ...extraContext }),
        });
    });
    return result;
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

function toToolCall(part) {
    return {
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        input: part.input ?? part.args ?? {},
    };
}

function toToolResult(output) {
    if (output && typeof output === 'object' && 'type' in output) {
        return output;
    }
    if (typeof output === 'string') {
        return { type: 'text', value: output };
    }
    if (output == null) {
        return { type: 'text', value: '' };
    }
    return { type: 'json', value: output };
}

export async function createWorkbenchAgentRequest({
    conversationKey,
    resetConversation = false,
    modelId,
    promptText,
    tools = [],
}) {
    const settings = await resolveWorkbenchAgentSettings({ modelId });
    if (!settings.openaiKey) {
        throw new Error(
            'Workbench AI is not configured. Add an OpenAI key before using the workbench agent.'
        );
    }

    const conversation = getOrCreateConversationState(conversationKey, resetConversation);
    const conversationId = conversation.conversationId;
    const previousMessages = conversation.messages || [];
    const userMessage = buildModelMessage('user', promptText);
    const messages = [...previousMessages, userMessage];
    const abortController = new AbortController();
    const reasoningConfig = getReasoningConfigFromSelection(settings.selectedReasoning);
    const providerInstance = createProviderInstance({
        provider: 'openai',
        apiKey: settings.openaiKey,
        baseUrl: settings.openaiUrl,
    });

    return {
        conversationId,
        abort() {
            abortController.abort();
        },
        async *stream() {
            let assistantText = '';
            const result = streamText({
                model: resolveProviderModelInstance(providerInstance, {
                    provider: 'openai',
                    modelId: settings.selectedModel,
                    isInternal: settings.isInternal,
                }),
                system: buildSystemPrompt(settings.systemPrompt, conversationId),
                messages,
                tools: toAiSdkTools(tools, { conversationId }),
                stopWhen: stepCountIs(settings.maxToolRounds),
                maxRetries: 0,
                abortSignal: abortController.signal,
                providerOptions: resolveProviderOptions({
                    provider: 'openai',
                    reasoningConfig,
                    isInternal: settings.isInternal,
                }),
            });

            try {
                for await (const part of result.fullStream) {
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
                            yield { type: 'tool_calls', toolCalls: [toToolCall(part)] };
                            break;
                        case 'tool-result': {
                            const toolCall = {
                                toolCallId: part.toolCallId,
                                toolName: part.toolName,
                                input: part.input ?? {},
                            };
                            yield {
                                type: 'tool_result',
                                toolCall,
                                toolResult: toToolResult(part.output),
                            };
                            break;
                        }
                        case 'error':
                            yield { type: 'error', content: String(part.error || 'Unknown error') };
                            break;
                        case 'abort':
                            yield { type: 'content', content: '\n\n[Cancelled]' };
                            yield { type: 'done' };
                            return;
                        default:
                            break;
                    }
                }

                await result.response;
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
