import { stepCountIs, streamText, tool as createAiSdkTool } from 'ai';
import type { ModelMessage, ToolModelMessage, ToolResultPart, ToolSet } from 'ai';
import type { ToolCall as AiToolCall, ToolResultOutput } from '@ai-sdk/provider-utils';
import { createBashTools, filterToolsByModel } from 'agent/tools';
import { DEFAULT_LLM_PROVIDER, normalizeLlmProvider } from 'shared/llm';
import { getIndexedDbFileSystem } from 'core/fs';
import { guid } from 'shared/utils';
import { z } from 'zod';
import { store, AGENT } from 'core/store';
import LOGGER from 'shared/logger';
import {
    type CompactionSettings,
    createCompactionSummaryMessage,
    DEFAULT_KEEP_RECENT_TOKENS,
    DEFAULT_RESERVE_TOKENS,
    estimateConversationTokens,
    generateCompactionSummary,
    prepareCompaction,
    relaxCompactionSettings,
    shouldCompactContext,
} from 'agent/compaction';
import {
    clearCdpHandlerForConversation,
    ensureCdpHandlerInitialized,
    getCdpHandlerForConversation,
} from 'agent/cdpHandler';
import {
    cleanupBashInstanceForConversation,
    getOrCreateBashInstanceForConversation,
} from 'agent/runtimeDeps';
import {
    DEFAULT_MODEL,
    DEFAULT_REASONING,
    createProviderInstance,
    getSummaryModelForAgentProvider,
    getReasoningConfigFromSelection,
    isAbortLikeError,
    isContextOverflowError,
    normalizeToolInputSchema,
    cloneMessageForStreaming,
    discoverSkills,
    formatSkillsForPrompt,
    resolveProviderModelInstance,
    resolveProviderOptions,
    type ProviderInstance,
} from 'agent/utils';
import { createStreamMessageBuilder } from 'agent/streamBuilder';
import type { Store } from '@reduxjs/toolkit';

const MAX_TOOL_ROUNDS = 400;

export type ProcessMessageFinishReason =
    | 'stop'
    | 'length'
    | 'content-filter'
    | 'tool-calls'
    | 'error'
    | 'other';

export interface ProcessMessageUsage {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
}

export interface ProcessMessageStepStart {
    stepNumber: number;
    timestamp: number;
}

export interface ProcessMessageStepFinish {
    stepNumber: number;
    timestamp: number;
    finishReason: ProcessMessageFinishReason;
    usage: ProcessMessageUsage;
}

export type ToolCall = AiToolCall<string, unknown>;
export type ToolResult = ToolResultOutput;

export interface ProcessMessageToolStart {
    toolCall: ToolCall;
    timestamp: number;
}

export interface ProcessMessageToolFinish {
    toolCall: ToolCall;
    toolResult: ToolResult;
    timestamp: number;
}

export interface ProcessMessageError {
    message: string;
    timestamp: number;
}

export interface ProcessMessageObserver {
    onStepStart?(info: ProcessMessageStepStart): void;
    onStepFinish?(info: ProcessMessageStepFinish): void;
    onToolStart?(info: ProcessMessageToolStart): void;
    onToolFinish?(info: ProcessMessageToolFinish): void;
    onError?(info: ProcessMessageError): void;
}

export type StreamChunk =
    | { type: 'content'; content: string }
    | { type: 'reasoning'; content: string }
    | { type: 'tool_calls'; toolCalls: ToolCall[] }
    | { type: 'tool_call_delta'; toolCallId: string; toolName?: string; delta: string }
    | { type: 'tool_result'; toolCall: ToolCall; toolResult: ToolResult }
    | { type: 'error'; content: string }
    | { type: 'done' };

type AgentSettings = {
    provider?: string;
    apiKey?: string;
    baseUrl?: string;
    selectedModel?: string;
    selectedReasoning?: string;
    modelContextWindow?: number;
    systemPrompt?: string;
    maxToolRounds?: number;
    isStoreEnabled?: boolean;
    isInternal?: boolean;
    extraTools?: Array<{
        name: string;
        description?: string;
        parameters?: unknown;
        execute: (input: Record<string, unknown>) => Promise<unknown> | unknown;
    }>;
    store: Store;
};

type SubagentStatus = {
    agent: string;
    description: string;
    detail?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return value != null && typeof value === 'object';
}

function extractNestedErrorMessage(errorLike: unknown): string {
    const queue: unknown[] = [errorLike];
    const seen = new Set<unknown>();
    let fallback: string | null = null;

    while (queue.length > 0) {
        const current = queue.shift();
        if (current == null || seen.has(current)) continue;
        if (typeof current === 'object' || typeof current === 'function') {
            seen.add(current);
        }

        if (typeof current === 'string') {
            const text = current.trim();
            if (!text) continue;
            try {
                queue.unshift(JSON.parse(text));
                continue;
            } catch {
                if (!fallback) fallback = text;
                if (text !== 'Bad Request') return text;
                continue;
            }
        }

        if (current instanceof Error) {
            const errorWithExtras = current as Error & {
                cause?: unknown;
                responseBody?: unknown;
                data?: unknown;
            };
            if (errorWithExtras.cause) queue.unshift(errorWithExtras.cause);
            queue.unshift(errorWithExtras.responseBody);
            queue.unshift(errorWithExtras.data);
            if (typeof current.message === 'string' && current.message.trim()) {
                if (!fallback) fallback = current.message.trim();
                if (current.message.trim() !== 'Bad Request') return current.message.trim();
            }
            continue;
        }

        if (isRecord(current)) {
            queue.unshift(current.responseBody);
            queue.unshift(current.data);
            queue.unshift(current.body);
            queue.unshift(current.response);
            queue.unshift(current.cause);
            queue.unshift(current.error);
            const message =
                typeof current.message === 'string'
                    ? current.message.trim()
                    : typeof current.error === 'string'
                      ? current.error.trim()
                      : '';
            if (message) {
                if (!fallback) fallback = message;
                if (message !== 'Bad Request') return message;
            }
        }
    }

    if (fallback) return fallback;
    return errorLike instanceof Error ? errorLike.message : String(errorLike);
}

let cachedSkillsSection: Promise<string> | null = null;

async function resolveSkillsSection() {
    if (!cachedSkillsSection) {
        cachedSkillsSection = (async () => {
            const skills = await discoverSkills();
            const skillsText = formatSkillsForPrompt(skills);
            return skillsText ? `\n\n${skillsText}\n` : '';
        })();
    }
    return cachedSkillsSection;
}

function refreshSkillsCache() {
    cachedSkillsSection = null;
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
            ...rawTool,
            description: rawTool.description || '',
            inputSchema: normalizeToolInputSchema(rawTool.parameters, z),
            execute: async (input: Object) => {
                return rawTool.execute({ ...input, ...extraContext });
            },
        });
    });
    return result;
}

function finalizeMessageForDisplay(message: ModelMessage): ModelMessage {
    if (!message || typeof message !== 'object') return message;
    if (!Array.isArray((message as any).content)) return message;
    const content = (message as any).content;
    const finalizedContent = content.map(part => {
        if (!part || typeof part !== 'object') return part;
        if (part.type === 'reasoning') {
            if (part.state !== 'done') {
                return { ...part, state: 'done' };
            }
            return part;
        }
        if (part.type === 'tool-call') {
            const { state, ...rest } = part;
            return rest;
        }
        if (part.type === 'tool-result') {
            /* if (!part.state) {
                const isError = part.result?.success === false || part.output?.success === false;
                return { ...part, state: isError ? 'output-error' : 'output-available' };
            } */
            return part;
        }
        return part;
    });
    return { ...message, content: finalizedContent };
}

export class Agent {
    private static streamingMessageListenersByConversation = new Map(); // conversationId -> Set<callback>
    private static agentMap = new Map<string, Agent>(); // conversationId -> Agent

    public conversationId: string;
    public systemPrompt: string;

    private providerInstance: ProviderInstance;
    private provider: string;
    private isStoreEnabled: boolean;
    private store: Store;
    private model: string;
    private summaryModel: string;
    private tools: ToolSet;
    private reasoningConfig?: { reasoningEffort: string; reasoningSummary: string };
    private modelContextWindow: number;
    private maxToolRounds: number;
    private abortController: AbortController | null = null;
    private messages: ModelMessage[] = [];
    private planContext: string | null = null;
    private isInternal: boolean;
    private subagentStatusListeners = new Set<(status: SubagentStatus | null) => void>();
    private _lastContextStats: {
        contextWindow: number;
        usedTokens: number;
        remainingTokens: number;
        ratioUsed: number;
        ratioRemaining: number;
        preCompactionTokens: number;
    } | null = null;

    private constructor({
        conversationId,
        providerInstance,
        provider,
        model,
        summaryModel,
        messages,
        tools,
        reasoningConfig,
        modelContextWindow,
        systemPrompt,
        maxToolRounds,
        isStoreEnabled,
        isInternal,
        store,
    }: {
        conversationId: string;
        providerInstance: ProviderInstance;
        provider: string;
        model: string;
        summaryModel: string;
        messages: ModelMessage[];
        tools: ToolSet;
        reasoningConfig?: { reasoningEffort: string; reasoningSummary: string };
        modelContextWindow: number;
        systemPrompt: string;
        maxToolRounds: number;
        isStoreEnabled: boolean;
        isInternal?: boolean;
        store: Store;
    }) {
        this.conversationId = conversationId;
        this.messages = [...messages];
        this.providerInstance = providerInstance;
        this.provider = provider;
        this.model = model;
        this.summaryModel = summaryModel;
        this.tools = tools;
        this.reasoningConfig = reasoningConfig;
        this.modelContextWindow = modelContextWindow;
        this.systemPrompt = systemPrompt;
        this.maxToolRounds = maxToolRounds;
        this.isStoreEnabled = isStoreEnabled;
        this.isInternal = !!isInternal;
        this.store = store;
    }

    static async create({
        messages = [],
        conversationId,
        settings,
    }: {
        messages?: ModelMessage[];
        conversationId?: string;
        settings: AgentSettings;
    }) {
        const id = conversationId || guid();
        const shell = getOrCreateBashInstanceForConversation(id);
        if (!getCdpHandlerForConversation(id)) {
            await ensureCdpHandlerInitialized(id, {
                getBashInstance: () => shell,
            });
        }
        const cdpHandler = getCdpHandlerForConversation(id);
        const fs = getIndexedDbFileSystem();

        const bashTools = createBashTools(shell, fs, {
            execInSandbox: (code, timeoutMs) => cdpHandler.execInSandbox(code, timeoutMs),
        });
        const currentModel = settings.selectedModel || DEFAULT_MODEL;
        const availableTools = [
            ...bashTools,
            ...(Array.isArray(settings.extraTools) ? settings.extraTools : []),
        ];
        const filteredTools = filterToolsByModel(availableTools, currentModel);
        const aiTools = toAiSdkTools(filteredTools, { conversationId: id });
        const reasoningConfig = getReasoningConfigFromSelection(
            settings.selectedReasoning || DEFAULT_REASONING
        );
        const provider = normalizeLlmProvider(settings.provider || DEFAULT_LLM_PROVIDER);
        const providerInstance = createProviderInstance({
            provider,
            apiKey: settings.apiKey,
            baseUrl: settings.baseUrl,
        });
        const summaryModel = getSummaryModelForAgentProvider(
            provider,
            currentModel,
            !!settings.isInternal
        );

        return new Agent({
            messages,
            conversationId: id,
            providerInstance,
            provider,
            model: currentModel,
            summaryModel,
            tools: aiTools,
            reasoningConfig,
            modelContextWindow: settings.modelContextWindow || 128000,
            systemPrompt: settings.systemPrompt || '',
            maxToolRounds: settings.maxToolRounds || MAX_TOOL_ROUNDS,
            isStoreEnabled: settings.isStoreEnabled || false,
            isInternal: settings.isInternal,
            store: store,
        });
    }

    abort(): void {
        this.abortController?.abort();
        this.emitSubagentStatus(null);
        clearCdpHandlerForConversation(this.conversationId);
    }

    get contextStats() {
        return this._lastContextStats;
    }

    get modelInfo() {
        return {
            id: this.model,
            contextWindow: this.modelContextWindow,
            supportsMaxOutputTokens: true,
        };
    }

    get messageCount() {
        return this.messages.length;
    }

    getMessages() {
        return [...this.messages];
    }

    get lastMessageRole() {
        return this.messages[this.messages.length - 1]?.role ?? null;
    }

    setPlanContext(ctx: string | null): void {
        this.planContext = ctx;
    }

    static refreshSkills(): void {
        refreshSkillsCache();
    }

    static emitStreamingMessage(conversationId: string, message: ModelMessage | null): void {
        if (!conversationId) return;
        const listeners = Agent.streamingMessageListenersByConversation.get(conversationId);
        if (!listeners || listeners.size === 0) return;
        const next = message ? cloneMessageForStreaming(message) : null;
        listeners.forEach(listener => {
            try {
                listener(next);
            } catch (_) {
                // Ignore listener errors to avoid breaking stream fan-out.
            }
        });
    }

    static subscribeStreamingMessage(
        conversationId: string,
        listener: (message: ModelMessage | null) => void
    ): () => void {
        if (!conversationId || typeof listener !== 'function') {
            return () => {};
        }
        const listeners =
            Agent.streamingMessageListenersByConversation.get(conversationId) || new Set();
        listeners.add(listener);
        Agent.streamingMessageListenersByConversation.set(conversationId, listeners);
        return () => {
            const current = Agent.streamingMessageListenersByConversation.get(conversationId);
            if (!current) return;
            current.delete(listener);
            if (current.size === 0) {
                Agent.streamingMessageListenersByConversation.delete(conversationId);
            }
        };
    }

    static clearStreamingMessageForConversation(conversationId: string): void {
        Agent.emitStreamingMessage(conversationId, null);
    }

    static clearStreamingMessageListenersForConversation(conversationId: string): void {
        Agent.streamingMessageListenersByConversation.delete(conversationId);
    }

    static registerAgent(conversationId: string, agent: Agent): void {
        if (!conversationId || !agent) return;
        Agent.agentMap.set(conversationId, agent);
    }

    static unregisterAgent(conversationId: string): void {
        if (!conversationId) return;
        Agent.agentMap.delete(conversationId);
    }

    static stopAgent(conversationId: string): void {
        if (!conversationId) return;
        const agent = Agent.agentMap.get(conversationId);
        if (agent) {
            try {
                agent.abort();
            } catch (_) {
                // Best effort: stop agent without throwing.
            }
            Agent.unregisterAgent(conversationId);
        }
        Agent.clearStreamingMessageForConversation(conversationId);
    }

    static cleanupConversationResources(conversationId: string): void {
        Agent.stopAgent(conversationId);
        Agent.clearStreamingMessageListenersForConversation(conversationId);
        cleanupBashInstanceForConversation(conversationId);
        clearCdpHandlerForConversation(conversationId);
        Agent.unregisterAgent(conversationId);
    }

    onSubagentStatus(listener: (status: SubagentStatus | null) => void): () => void {
        this.subagentStatusListeners.add(listener);
        return () => {
            this.subagentStatusListeners.delete(listener);
        };
    }

    private getCompactionSettings(): CompactionSettings {
        return {
            reserveTokens: DEFAULT_RESERVE_TOKENS,
            keepRecentTokens: Math.min(
                DEFAULT_KEEP_RECENT_TOKENS,
                Math.floor(this.modelContextWindow * 0.25)
            ),
        };
    }

    private async compactForContext(
        system: string,
        contextWindow: number,
        signal: AbortSignal,
        settings = this.getCompactionSettings(),
        force = false
    ): Promise<boolean> {
        const preparation = prepareCompaction(this.messages, system, settings);
        if (!preparation) return false;
        if (!force && !shouldCompactContext(preparation.tokensBefore, contextWindow, settings)) {
            return false;
        }

        if (this.isStoreEnabled && this.store) {
            this.store.dispatch(
                AGENT.reduxSlice.actions.startSummarizing({ id: this.conversationId })
            );
        }
        let summary: string | null = null;
        try {
            summary = await generateCompactionSummary(
                this.providerInstance,
                this.provider,
                this.summaryModel,
                preparation,
                undefined,
                signal,
                this.isInternal
            );
        } finally {
            if (this.isStoreEnabled && this.store) {
                this.store.dispatch(
                    AGENT.reduxSlice.actions.stopSummarizing({ id: this.conversationId })
                );
            }
        }
        if (!summary) {
            this.messages = preparation.keptMessages;
            return true;
        }

        this.messages = [createCompactionSummaryMessage(summary), ...preparation.keptMessages];
        return true;
    }

    async *processMessage(
        userMessages: ModelMessage[],
        observer?: ProcessMessageObserver
    ): AsyncGenerator<StreamChunk, void, unknown> {
        Agent.registerAgent(this.conversationId, this);
        this.abortController = new AbortController();
        const signal = this.abortController.signal;
        const streamBuilder = createStreamMessageBuilder(message =>
            Agent.emitStreamingMessage(this.conversationId, message)
        );
        const completedStepMessages: ModelMessage[] = [];

        this.messages = sanitizeIncompleteToolExchanges(this.messages);
        this.messages.push(...userMessages);
        const systemText = await buildSystemPrompt(
            this.systemPrompt,
            this.planContext,
            this.conversationId
        );
        let attemptedOverflowRecovery = false;
        this.planContext = null;

        try {
            while (true) {
                try {
                    const compactionSettings = attemptedOverflowRecovery
                        ? relaxCompactionSettings(this.getCompactionSettings())
                        : this.getCompactionSettings();

                    const preCompactionTokens = estimateConversationTokens(
                        systemText,
                        this.messages
                    );
                    const didCompact = await this.compactForContext(
                        systemText,
                        this.modelContextWindow,
                        signal,
                        compactionSettings,
                        attemptedOverflowRecovery
                    );
                    const tokensAfter = estimateConversationTokens(systemText, this.messages);

                    this._lastContextStats = {
                        contextWindow: this.modelContextWindow,
                        usedTokens: tokensAfter,
                        remainingTokens: Math.max(0, this.modelContextWindow - tokensAfter),
                        ratioUsed: tokensAfter / this.modelContextWindow,
                        ratioRemaining: 1 - tokensAfter / this.modelContextWindow,
                        preCompactionTokens,
                    };

                    LOGGER.debug('[agent] processMessage', {
                        messages: this.messages,
                        systemText,
                        compactionSettings,
                        preCompactionTokens,
                        didCompact,
                    });

                    const result = streamText({
                        model: resolveProviderModelInstance(this.providerInstance, {
                            provider: this.provider,
                            modelId: this.model,
                            isInternal: this.isInternal,
                        }),
                        system: systemText,
                        messages: this.messages,
                        tools: this.tools,
                        stopWhen: stepCountIs(this.maxToolRounds),
                        maxRetries: 0,
                        abortSignal: signal,
                        providerOptions: resolveProviderOptions({
                            provider: this.provider,
                            reasoningConfig: this.reasoningConfig,
                            isInternal: this.isInternal,
                        }),
                        experimental_onStepStart: (event: unknown) => {
                            notifyObserver(observer?.onStepStart, {
                                stepNumber: getStepNumber(event, 0),
                                timestamp: Date.now(),
                            });
                        },
                        onStepFinish: (event: unknown) => {
                            notifyObserver(observer?.onStepFinish, {
                                stepNumber: getStepNumber(event, 0),
                                timestamp: Date.now(),
                                finishReason: getFinishReason(event),
                                usage: getUsage(event),
                            });
                            const stepMessages = Array.isArray((event as any)?.response?.messages)
                                ? (event as any).response.messages
                                : [];
                            if (stepMessages.length > 0) {
                                completedStepMessages.push(
                                    ...stepMessages.map(finalizeMessageForDisplay)
                                );
                            }
                        },
                        onError: (event: unknown) => {
                            console.error('### onError gui', { event });
                            const message = extractNestedErrorMessage(
                                (event as { error?: unknown })?.error ?? event
                            );
                            notifyObserver(observer?.onError, {
                                message: String(message),
                                timestamp: Date.now(),
                            });
                            throw new Error(message);
                        },
                    });

                    for await (const part of result.fullStream) {
                        const partType = (part as { type?: string })?.type;
                        if (signal.aborted) {
                            const cancelledChunk = {
                                type: 'content',
                                content: '\n\n[Cancelled]',
                            } as StreamChunk;
                            streamBuilder.handleChunk(cancelledChunk);
                            yield cancelledChunk;
                            break;
                        }

                        switch (partType) {
                            case 'reasoning-start':
                                streamBuilder.startReasoning();
                                break;
                            case 'reasoning-end':
                                streamBuilder.finalizeReasoning(true);
                                break;
                            case 'text-delta':
                                {
                                    const chunk = {
                                        type: 'content',
                                        content: part.text,
                                    } as StreamChunk;
                                    streamBuilder.handleChunk(chunk);
                                    yield chunk;
                                }
                                break;
                            case 'reasoning-delta':
                                {
                                    const chunk = {
                                        type: 'reasoning',
                                        content: part.text,
                                    } as StreamChunk;
                                    streamBuilder.handleChunk(chunk);
                                    yield chunk;
                                }
                                break;
                            case 'tool-call': {
                                const tc = toToolCall(part);
                                notifyObserver(observer?.onToolStart, {
                                    toolCall: tc,
                                    timestamp: Date.now(),
                                });
                                {
                                    const chunk = {
                                        type: 'tool_calls',
                                        toolCalls: [tc],
                                    } as StreamChunk;
                                    streamBuilder.handleChunk(chunk);
                                    yield chunk;
                                }
                                break;
                            }
                            case 'tool-call-delta':
                            case 'tool-input-delta': {
                                const toolCallId = normalizeToolCallId(part);
                                const toolName = normalizeToolName(part);
                                const delta = extractToolCallDelta(part);
                                if (toolCallId) {
                                    const chunk = {
                                        type: 'tool_call_delta',
                                        toolCallId,
                                        toolName,
                                        delta,
                                    } as StreamChunk;
                                    streamBuilder.handleChunk(chunk);
                                    yield chunk;
                                }
                                break;
                            }
                            case 'tool-call-streaming-start':
                            case 'tool-input-start': {
                                const toolCallId = normalizeToolCallId(part);
                                const toolName = normalizeToolName(part);
                                if (toolCallId) {
                                    const chunk = {
                                        type: 'tool_call_delta',
                                        toolCallId,
                                        toolName,
                                        delta: '',
                                    } as StreamChunk;
                                    streamBuilder.handleChunk(chunk);
                                    yield chunk;
                                }
                                break;
                            }
                            case 'tool-input-end':
                                break;
                            case 'tool-result': {
                                const toolResultPart = part as any;
                                const tc: ToolCall = {
                                    toolCallId: toolResultPart.toolCallId,
                                    toolName: toolResultPart.toolName,
                                    input: toolResultPart.input ?? {},
                                };
                                LOGGER.debug('[agent] processMessage tool-result', { part });
                                const tr = toToolResult(
                                    toolResultPart.output?.text ||
                                        toolResultPart.output?.output ||
                                        toolResultPart.output?.content ||
                                        ''
                                );
                                notifyObserver(observer?.onToolFinish, {
                                    toolCall: tc,
                                    toolResult: tr,
                                    timestamp: Date.now(),
                                });
                                {
                                    const chunk = {
                                        type: 'tool_result',
                                        toolCall: tc,
                                        toolResult: tr,
                                    } as StreamChunk;
                                    streamBuilder.handleChunk(chunk);
                                    yield chunk;
                                }
                                break;
                            }
                            case 'error': {
                                const message = String(part.error);
                                notifyObserver(observer?.onError, {
                                    message,
                                    timestamp: Date.now(),
                                });
                                {
                                    const chunk = {
                                        type: 'error',
                                        content: message,
                                    } as StreamChunk;
                                    streamBuilder.handleChunk(chunk);
                                    yield chunk;
                                }
                                break;
                            }
                            case 'abort':
                                {
                                    const chunk = {
                                        type: 'content',
                                        content: '\n\n[Cancelled]',
                                    } as StreamChunk;
                                    streamBuilder.handleChunk(chunk);
                                    yield chunk;
                                }
                                break;
                        }
                    }

                    if (signal.aborted) {
                        if (completedStepMessages.length > 0) {
                            this.appendCompletedTurn(completedStepMessages);
                        } else {
                            this.discardAbortedTurn(userMessages);
                        }
                        const doneChunk = { type: 'done' } as StreamChunk;
                        streamBuilder.handleChunk(doneChunk);
                        yield doneChunk;
                        return;
                    }

                    try {
                        const response = await result.response;
                        if (!signal.aborted) {
                            LOGGER.debug('[agent] processMessage response', { response });
                            this.appendCompletedTurn(response.messages);
                        }
                    } catch (responseError: unknown) {
                        LOGGER.error('[agent] processMessage responseError', {
                            responseError,
                            isContextOverflowError: isContextOverflowError(responseError),
                        });
                        if (!attemptedOverflowRecovery && isContextOverflowError(responseError)) {
                            attemptedOverflowRecovery = true;
                            continue;
                        }
                        throw responseError;
                    }

                    if (signal.aborted) {
                        this.discardAbortedTurn(userMessages);
                        const doneChunk = { type: 'done' } as StreamChunk;
                        streamBuilder.handleChunk(doneChunk);
                        yield doneChunk;
                        return;
                    }
                    {
                        const doneChunk = { type: 'done' } as StreamChunk;
                        streamBuilder.handleChunk(doneChunk);
                        yield doneChunk;
                    }
                    return;
                } catch (err: unknown) {
                    if (signal.aborted) {
                        this.discardAbortedTurn(userMessages);
                        const cancelledChunk = {
                            type: 'content',
                            content: '\n\n[Cancelled]',
                        } as StreamChunk;
                        streamBuilder.handleChunk(cancelledChunk);
                        yield cancelledChunk;
                        const doneChunk = { type: 'done' } as StreamChunk;
                        streamBuilder.handleChunk(doneChunk);
                        yield doneChunk;
                        return;
                    }
                    if (!attemptedOverflowRecovery && isContextOverflowError(err)) {
                        attemptedOverflowRecovery = true;
                        continue;
                    }

                    const msg = extractNestedErrorMessage(err);
                    notifyObserver(observer?.onError, {
                        message: `Error: ${msg}`,
                        timestamp: Date.now(),
                    });
                    {
                        const errorChunk = {
                            type: 'error',
                            content: `Error: ${msg}`,
                        } as StreamChunk;
                        streamBuilder.handleChunk(errorChunk);
                        yield errorChunk;
                    }
                    {
                        const doneChunk = { type: 'done' } as StreamChunk;
                        streamBuilder.handleChunk(doneChunk);
                        yield doneChunk;
                    }
                    return;
                }
            }
        } catch (error) {
            LOGGER.error('[agent] processMessage error', error);
            throw error;
        } finally {
            LOGGER.error('[agent] processMessage finally', {
                messages: this.messages,
                systemText,
            });
            if (this.abortController?.signal === signal) {
                this.abortController = null;
            }
            Agent.unregisterAgent(this.conversationId);
            clearCdpHandlerForConversation(this.conversationId);
        }
    }

    private discardAbortedTurn(userMessages: ModelMessage[]): void {
        for (const userMessage of userMessages) {
            const idx = this.messages.lastIndexOf(userMessage);
            if (idx >= 0) {
                this.messages.splice(idx, 1);
            }
        }
    }

    private appendCompletedTurn(newMessages: ModelMessage[]): void {
        if (newMessages.length === 0) return;
        const finalizedMessages = newMessages.map(finalizeMessageForDisplay);

        if (!this.isStoreEnabled || !this.store) {
            this.messages.push(...finalizedMessages);
            return;
        }

        this.store.dispatch(
            AGENT.reduxSlice.actions.addMessages({
                id: this.conversationId,
                messages: [...finalizedMessages],
            })
        );
        this.messages.push(...finalizedMessages);
    }

    private emitSubagentStatus(status: SubagentStatus | null): void {
        for (const listener of this.subagentStatusListeners) {
            listener(status);
        }
    }
}

function toToolCall(part: {
    toolCallId: string;
    toolName: string;
    args?: unknown;
    input?: unknown;
}): ToolCall {
    return {
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        input: part.input ?? part.args ?? {},
    };
}

function normalizeToolCallId(part: any): string {
    return part?.toolCallId || part?.callId || part?.call_id || part?.id || '';
}

function normalizeToolName(part: any): string {
    return part?.toolName || part?.name || part?.function?.name || part?.tool?.name || '';
}

function extractToolCallDelta(part: any): string {
    const candidates = [
        part?.argsTextDelta,
        part?.argsText,
        part?.inputTextDelta,
        part?.inputText,
        part?.inputDelta,
        part?.arguments,
        part?.input,
        part?.args,
        part?.delta,
    ];
    for (const value of candidates) {
        if (typeof value === 'string') return value;
        if (value && typeof value === 'object') {
            try {
                return JSON.stringify(value);
            } catch (_) {
                return String(value);
            }
        }
    }
    return '';
}

function notifyObserver<T>(listener: ((payload: T) => void) | undefined, payload: T): void {
    if (!listener) {
        return;
    }
    try {
        listener(payload);
    } catch {
        // Observer failures should never break generation.
    }
}

function getStepNumber(event: unknown, fallback: number): number {
    if (
        event &&
        typeof event === 'object' &&
        'stepNumber' in event &&
        typeof event.stepNumber === 'number'
    ) {
        return event.stepNumber;
    }
    return fallback;
}

function getFinishReason(event: unknown): ProcessMessageFinishReason {
    if (event && typeof event === 'object' && 'finishReason' in event) {
        switch (event.finishReason) {
            case 'stop':
            case 'length':
            case 'content-filter':
            case 'tool-calls':
            case 'error':
            case 'other':
                return event.finishReason;
        }
    }
    return 'other';
}

function getUsage(event: unknown): ProcessMessageUsage {
    if (!(event && typeof event === 'object' && 'usage' in event)) {
        return {};
    }
    const usage = event.usage;
    if (!usage || typeof usage !== 'object') {
        return {};
    }
    const u = usage as Record<string, unknown>;
    return {
        inputTokens: typeof u.inputTokens === 'number' ? u.inputTokens : undefined,
        outputTokens: typeof u.outputTokens === 'number' ? u.outputTokens : undefined,
        totalTokens: typeof u.totalTokens === 'number' ? u.totalTokens : undefined,
    };
}

function toToolResult(output: unknown): ToolResult {
    if (output && typeof output === 'object' && 'type' in output) {
        return output as ToolResult;
    }
    if (typeof output === 'string') {
        return { type: 'text', value: output };
    }
    if (output == null) {
        return { type: 'text', value: '' };
    }
    return { type: 'json', value: output as any };
}

/**
 * Removes trailing incomplete tool exchanges from the message list before sending to an LLM.
 *
 * When execution is stopped mid-way, the history may end with:
 *   [assistant:{only-tool-calls}, tool:{results}]
 * without a subsequent model text response. Sending this to Gemini causes a
 * "function call turn must come after a user turn or function response turn" error
 * because the tool-result maps to a Gemini user turn, making two consecutive user
 * turns when the next real user message is appended.
 *
 * This function iteratively strips such dangling blocks from the tail.
 */
function sanitizeIncompleteToolExchanges(messages: ModelMessage[]): ModelMessage[] {
    if (messages.length === 0) return messages;

    let end = messages.length;

    while (end > 0) {
        // Walk backwards over trailing tool-result messages
        let toolEnd = end;
        while (toolEnd > 0 && (messages[toolEnd - 1] as any).role === 'tool') {
            toolEnd--;
        }

        if (toolEnd < end) {
            // There are trailing tool messages — check if preceded by assistant with only tool-calls
            if (toolEnd > 0) {
                const preceding = messages[toolEnd - 1] as any;
                if (preceding.role === 'assistant') {
                    const content = Array.isArray(preceding.content) ? preceding.content : [];
                    const hasText = content.some(
                        (p: any) =>
                            p.type === 'text' && typeof p.text === 'string' && p.text.trim()
                    );
                    if (!hasText) {
                        // Incomplete exchange: assistant issued tool calls but never gave a text response
                        end = toolEnd - 1;
                        continue;
                    }
                }
            }
            break;
        }

        // No trailing tool messages — check for an orphaned assistant with only tool-calls
        const last = messages[end - 1] as any;
        if (last.role === 'assistant') {
            const content = Array.isArray(last.content) ? last.content : [];
            const hasText = content.some(
                (p: any) => p.type === 'text' && typeof p.text === 'string' && p.text.trim()
            );
            const hasToolCalls = content.some((p: any) => p.type === 'tool-call');
            if (hasToolCalls && !hasText) {
                end--;
                continue;
            }
        }

        break;
    }

    return end === messages.length ? messages : messages.slice(0, end);
}

async function buildSystemPrompt(
    systemPrompt: string,
    planContext: string | null,
    conversationId: string
): Promise<string> {
    const base = systemPrompt || '';
    const skillsSection = await resolveSkillsSection();
    const planSection = planContext
        ? `\n\nAPPROVED PLAN:\nThe following plan has been approved by the user. Execute it now.\n${planContext}\n`
        : '';
    const conversationHeader = `### Conversation ID: ${conversationId}\n\n`;
    return `${conversationHeader}${base}${skillsSection}${planSection}`;
}
