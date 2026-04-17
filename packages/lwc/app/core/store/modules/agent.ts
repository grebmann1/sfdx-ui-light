import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { ModelMessage } from 'ai';
import {
    Constants,
    DEFAULT_MODEL,
    DEFAULT_REASONING,
    MODELS,
    REASONING_OPTIONS,
} from 'agent/utils';
import {
    CACHE_CONFIG,
    loadExtensionConfigFromCache,
    loadSingleExtensionConfigFromCache,
    saveSingleExtensionConfigToCache,
    saveExtensionConfigToCache,
} from 'shared/cacheManager';
import LOGGER from 'shared/logger';
import { guid, isNotUndefinedOrNull } from 'shared/utils';
import * as ERROR from './error';
import {
    type ProcessMessageStepStart,
    type ProcessMessageToolStart,
    type ProcessMessageError,
    type ProcessMessageStepFinish,
    type ProcessMessageToolFinish,
} from 'agent/Agent';

export interface Conversation {
    id: string;
    title: string;
    streamHistory: ModelMessage[];
    compactionSummary: ModelMessage[];
}

export interface AgentState {
    conversations: Conversation[];
    activeConversationId: string;
    selectedModel: string;
    selectedReasoning: string;
    errorById: Record<string, { title: string; message: string | null }>;
    loadingById: Record<string, boolean>;
    streamingById: Record<string, boolean>;
    summarizingById: Record<string, boolean>;
    messagesById: Record<string, ModelMessage[]>;
    debugMode: boolean;
    lastRunDebugByConversationId: Record<string, unknown>;
}

const DEFAULT_CONVERSATION = {
    id: 'default',
    title: 'Conversation 1',
    streamHistory: [],
    compactionSummary: [],
};
function normalizeModel(model) {
    if (typeof model !== 'string') {
        return DEFAULT_MODEL;
    }
    const normalized = model.trim();
    if (!normalized) {
        return DEFAULT_MODEL;
    }
    const lowered = normalized.toLowerCase();
    const exactValueMatch = MODELS.find(option => option.value === normalized);
    if (exactValueMatch) {
        return exactValueMatch.value;
    }
    const valueCaseInsensitiveMatch = MODELS.find(
        option => String(option.value || '').toLowerCase() === lowered
    );
    if (valueCaseInsensitiveMatch) {
        return valueCaseInsensitiveMatch.value;
    }
    const labelMatch = MODELS.find(option => String(option.label || '').toLowerCase() === lowered);
    if (labelMatch) {
        return labelMatch.value;
    }
    // Backward compatibility for model aliases without dated suffixes, e.g. "gpt-5-mini".
    const aliasMatch = MODELS.find(option =>
        String(option.value || '')
            .toLowerCase()
            .startsWith(`${lowered}-`)
    );
    if (aliasMatch) {
        return aliasMatch.value;
    }
    return normalized;
}

function normalizeReasoning(reasoning) {
    if (typeof reasoning !== 'string') {
        return DEFAULT_REASONING;
    }
    const normalized = reasoning.trim();
    if (!normalized) {
        return DEFAULT_REASONING;
    }
    const lowered = normalized.toLowerCase();
    const exactValueMatch = REASONING_OPTIONS.find(option => option.value === normalized);
    if (exactValueMatch) {
        return exactValueMatch.value;
    }
    const valueCaseInsensitiveMatch = REASONING_OPTIONS.find(
        option => String(option.value || '').toLowerCase() === lowered
    );
    if (valueCaseInsensitiveMatch) {
        return valueCaseInsensitiveMatch.value;
    }
    const labelMatch = REASONING_OPTIONS.find(
        option => String(option.label || '').toLowerCase() === lowered
    );
    if (labelMatch) {
        return labelMatch.value;
    }
    return DEFAULT_REASONING;
}

function normalizeConversation(conversation: unknown): Conversation {
    if (!conversation || typeof conversation !== 'object') {
        return { ...DEFAULT_CONVERSATION };
    }
    const c = conversation as Record<string, unknown>;
    return {
        id: typeof c.id === 'string' && c.id ? c.id : `conv_${Date.now()}`,
        title: typeof c.title === 'string' && c.title ? c.title : 'Conversation',
        streamHistory: Array.isArray(c.streamHistory) ? (c.streamHistory as ModelMessage[]) : [],
        compactionSummary: Array.isArray(c.compactionSummary)
            ? (c.compactionSummary as ModelMessage[])
            : [],
    };
}

function normalizeConversations(conversations) {
    const list = Array.isArray(conversations) ? conversations.map(normalizeConversation) : [];
    return list.length > 0 ? list : [{ ...DEFAULT_CONVERSATION }];
}

function normalizeAgentConversationData(rawData) {
    const safeData = rawData && typeof rawData === 'object' ? rawData : {};
    const conversations = normalizeConversations(safeData.conversations);
    const activeConversationId =
        safeData.activeConversationId &&
        conversations.some(c => c.id === safeData.activeConversationId)
            ? safeData.activeConversationId
            : conversations[0].id;
    return {
        conversations,
        activeConversationId,
        selectedModel: normalizeModel(safeData.selectedModel),
        selectedReasoning: normalizeReasoning(safeData.selectedReasoning),
    };
}

function buildConversationDataFromState(state) {
    return {
        conversations: normalizeConversations(state.conversations),
        activeConversationId: state.activeConversationId,
        selectedModel: normalizeModel(state.selectedModel),
        selectedReasoning: normalizeReasoning(state.selectedReasoning),
    };
}

function buildLegacyConversationData(legacyConfig) {
    const safeLegacy = legacyConfig && typeof legacyConfig === 'object' ? legacyConfig : {};
    return {
        conversations: safeLegacy[CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATIONS.key],
        activeConversationId: safeLegacy[CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_ACTIVE_ID.key],
        selectedModel: safeLegacy[CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_MODEL.key],
        selectedReasoning: safeLegacy[CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_REASONING.key],
    };
}

function applyLegacySelectionOverrides(baseData, legacyData) {
    const safeBase = baseData && typeof baseData === 'object' ? baseData : {};
    const safeLegacy = legacyData && typeof legacyData === 'object' ? legacyData : {};
    const hasNonEmptyValue = value => value != null && String(value).trim() !== '';
    return {
        ...safeBase,
        selectedModel:
            hasNonEmptyValue(safeBase.selectedModel) && hasNonEmptyValue(safeLegacy.selectedModel)
                ? safeBase.selectedModel
                : hasNonEmptyValue(safeBase.selectedModel)
                  ? safeBase.selectedModel
                  : safeLegacy.selectedModel,
        selectedReasoning:
            hasNonEmptyValue(safeBase.selectedReasoning) &&
            hasNonEmptyValue(safeLegacy.selectedReasoning)
                ? safeBase.selectedReasoning
                : hasNonEmptyValue(safeBase.selectedReasoning)
                  ? safeBase.selectedReasoning
                  : safeLegacy.selectedReasoning,
    };
}

const initialState = {
    conversations: [{ ...DEFAULT_CONVERSATION }],
    activeConversationId: DEFAULT_CONVERSATION.id,
    selectedModel: DEFAULT_MODEL,
    selectedReasoning: DEFAULT_REASONING,
    // Per-conversation error: { [conversationId]: { title, message } }
    errorById: {},
    // Per conversation UI state
    loadingById: {},
    streamingById: {},
    summarizingById: {},
    messagesById: {},
    debugMode: false,
    lastRunDebugByConversationId: {},
};

function saveCacheSettings(state) {
    // Persist only cache-relevant fields; avoid serializing the full redux slice,
    // which may include non-serializable debug/runtime data.
    // Saves are fired immediately (not queued) so that writes reach chrome.storage
    // before the extension popup/panel is closed.
    const payload = buildConversationDataFromState(state);
    saveSingleExtensionConfigToCache(CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_DATA.key, payload)
        .then(() => {
            LOGGER.debug('[agent] saveCacheSettings persisted', {
                selectedModel: payload.selectedModel,
                selectedReasoning: payload.selectedReasoning,
            });
        })
        .catch(e => {
            LOGGER.error('Failed to save CONFIG to localstorage', e);
        });
    // Backward-compatible keys; can be removed once all clients read canonical payload.
    saveExtensionConfigToCache({
        [CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATIONS.key]: payload.conversations,
        [CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_ACTIVE_ID.key]: payload.activeConversationId,
        [CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_MODEL.key]: payload.selectedModel,
        [CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_REASONING.key]: payload.selectedReasoning,
    }).catch(e => {
        LOGGER.error('Failed to save legacy CONFIG to localstorage', e);
    });
}

function loadCacheSettings(cachedConfig, state) {
    try {
        const normalized = normalizeAgentConversationData(cachedConfig);
        Object.assign(state, normalized);
    } catch (e) {
        LOGGER.error('Failed to load CONFIG from localstorage', e);
    }
}

/**
 * Replaces binary image/file parts with a text placeholder before persisting
 * messages to streamHistory (cache). This prevents base64 blobs from bloating
 * extension storage and stops stale malformed parts from being replayed to the
 * LLM on the next session.
 */
function sanitizeMessagesForCache(messages: ModelMessage[]): ModelMessage[] {
    return messages.map(message => {
        const content = (message as { content?: unknown }).content;
        if (!Array.isArray(content)) return message;
        const sanitized = content.map(part => {
            if (!part || typeof part !== 'object') return part;
            const p = part as { type?: string; filename?: string; mediaType?: string };
            if (p.type === 'image') {
                const label = p.mediaType ? `[Image: ${p.mediaType}]` : '[Image]';
                return { type: 'text', text: label };
            }
            if (p.type === 'file') {
                const name = p.filename || p.mediaType || 'file';
                return { type: 'text', text: `[File: ${name}]` };
            }
            return part;
        });
        return { ...message, content: sanitized } as ModelMessage;
    });
}

function hydrateMessagesFromConversations(state: AgentState) {
    if (!Array.isArray(state.conversations) || state.conversations.length === 0) return;
    if (!state.messagesById) state.messagesById = {};
    for (const c of state.conversations) {
        const history = Array.isArray(c.streamHistory) ? c.streamHistory : [];
        const filtered = history.filter(
            (m: ModelMessage) => (m as { id?: string }).id !== Constants.WELCOME_MESSAGE.id
        );
        // Strip any lingering binary image/file blobs that were cached in previous sessions
        state.messagesById[c.id] = sanitizeMessagesForCache(filtered);
    }
}

// Async: load cached settings from extension storage
export const loadCacheSettingsAsync = createAsyncThunk(
    'agent/loadCacheSettings',
    async (_, { dispatch }) => {
        try {
            const [conversationData, legacyConfig] = await Promise.all([
                loadSingleExtensionConfigFromCache(
                    CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_DATA.key
                ),
                loadExtensionConfigFromCache([
                    CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATIONS.key,
                    CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_ACTIVE_ID.key,
                    CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_MODEL.key,
                    CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_REASONING.key,
                ]),
            ]);
            const legacyData = buildLegacyConversationData(legacyConfig);
            if (isNotUndefinedOrNull(conversationData)) {
                const mergedConversationData = applyLegacySelectionOverrides(
                    conversationData,
                    legacyData
                );
                return mergedConversationData;
            }
            // Backward-compatible fallback for older cache shape.
            LOGGER.debug('[agent] Loaded legacy conversation cache payload.', {
                legacySelectedModel: legacyData?.selectedModel,
                legacySelectedReasoning: legacyData?.selectedReasoning,
            });
            return legacyData;
        } catch (e) {
            LOGGER.error('loadCacheSettings.rejected --> error', e);
            dispatch(
                ERROR.reduxSlice.actions.addError({
                    message: 'Failed to load CONFIG from localstorage',
                    details: e.message,
                })
            );
            return null;
        }
    }
);

const agentSlice = createSlice({
    name: 'agent',
    initialState,
    reducers: {
        addConversation: (state, action) => {
            const conversation = normalizeConversation(action.payload?.conversation);
            state.conversations = [...state.conversations, conversation];
            if (!Array.isArray(state.messagesById[conversation.id])) {
                state.messagesById[conversation.id] = [];
            }
            saveCacheSettings(state);
        },
        deleteConversation: (state, action) => {
            const { id } = action.payload;
            const wasActive = state.activeConversationId === id;
            state.conversations = state.conversations.filter(c => c.id !== id);
            if (wasActive) {
                state.activeConversationId = state.conversations[0]?.id || DEFAULT_CONVERSATION.id;
            }
            delete state.messagesById[id];
            delete state.loadingById[id];
            delete state.streamingById[id];
            delete state.summarizingById[id];
            delete state.errorById[id];
            if (state.lastRunDebugByConversationId) {
                delete state.lastRunDebugByConversationId[id];
            }
            if (state.conversations.length === 0) {
                state.conversations = [{ ...DEFAULT_CONVERSATION }];
                state.activeConversationId = DEFAULT_CONVERSATION.id;
            }
            saveCacheSettings(state);
        },
        setActiveConversationId: (state, action) => {
            const { id } = action.payload;
            state.activeConversationId = id;
            saveCacheSettings(state);
        },
        updateConversationTitle: (state, action) => {
            const { id, title } = action.payload;
            const idx = state.conversations.findIndex(c => c.id === id);
            if (idx !== -1) {
                state.conversations[idx] = { ...state.conversations[idx], title };
            }
            saveCacheSettings(state);
        },
        updateConversationCompactionSummary: (state, action) => {
            const { id, summary } = action.payload;
            const idx = state.conversations.findIndex(c => c.id === id);
            if (idx !== -1) {
                state.conversations[idx] = {
                    ...state.conversations[idx],
                    compactionSummary: summary,
                };
            }
            saveCacheSettings(state);
        },
        updateConversationStreamHistory: (state, action) => {
            const { id } = action.payload;
            const idx = state.conversations.findIndex(c => c.id === id);
            if (idx !== -1) {
                state.conversations[idx] = {
                    ...state.conversations[idx],
                    streamHistory: sanitizeMessagesForCache(state.messagesById[id] || []),
                };
            }
            saveCacheSettings(state);
        },
        updateSelectedModel: (state, action) => {
            const { model } = action.payload;
            state.selectedModel = normalizeModel(model);
            saveCacheSettings(state);
        },
        setSelectedReasoning: (state, action) => {
            const { reasoning } = action.payload;
            state.selectedReasoning = normalizeReasoning(reasoning);
            saveCacheSettings(state);
        },
        setError: (state, action) => {
            const { id, title, message } = action.payload || {};
            if (!id) return;
            state.errorById[id] = { title: title || 'Error', message: message || null };
        },
        resetError: (state, action) => {
            const { id } = action.payload || {};
            if (id) delete state.errorById[id];
        },
        startLoading: (state, action) => {
            const { id } = action.payload;
            state.loadingById[id] = true;
        },
        stopLoading: (state, action) => {
            const { id } = action.payload;
            state.loadingById[id] = false;
        },
        startStreaming: (state, action) => {
            const { id } = action.payload;
            state.streamingById[id] = true;
        },
        stopStreaming: (state, action) => {
            const { id } = action.payload;
            state.streamingById[id] = false;
        },
        startSummarizing: (state, action) => {
            const { id } = action.payload;
            state.summarizingById[id] = true;
        },
        stopSummarizing: (state, action) => {
            const { id } = action.payload;
            state.summarizingById[id] = false;
        },
        setMessages: (state, action) => {
            const { id, messages } = action.payload;
            const newMessages = Array.isArray(messages)
                ? messages.map(m => ({
                      ...m,
                      id: m.id || guid(),
                  }))
                : [];
            state.messagesById[id] = newMessages;
            LOGGER.debug('[agent] setMessages', {
                conversationId: id,
                count: newMessages.length,
                roles: newMessages.map(m => m.role),
                partsCount: newMessages.map(m => (Array.isArray(m?.parts) ? m.parts.length : 0)),
                messages: newMessages,
            });
        },
        addMessages: (state, action) => {
            const { id, messages } = action.payload;
            const incoming: ModelMessage[] = Array.isArray(messages) ? messages : [];
            state.messagesById[id] = [...(state.messagesById[id] || []), ...incoming];
        },
        clearMessages: (state, action) => {
            const { id } = action.payload;
            state.messagesById[id] = [];
            const idx = state.conversations.findIndex(c => c.id === id);
            if (idx !== -1) {
                state.conversations[idx] = { ...state.conversations[idx], streamHistory: [] };
            }
            saveCacheSettings(state);
        },
        setDebugMode: (state, action) => {
            const { enabled } = action.payload || {};
            state.debugMode = !!enabled;
        },
        setLastRunDebug: (state, action) => {
            const { id, data } = action.payload || {};
            if (id != null) {
                if (!state.lastRunDebugByConversationId) {
                    state.lastRunDebugByConversationId = {};
                }
                state.lastRunDebugByConversationId[id] = data;
            }
        },
    },
    extraReducers: builder => {
        builder
            .addCase(loadCacheSettingsAsync.fulfilled, (state, action) => {
                const cachedConfig = action.payload;
                if (isNotUndefinedOrNull(cachedConfig)) {
                    loadCacheSettings(cachedConfig, state);
                }
                hydrateMessagesFromConversations(state);
            })
            .addCase(loadConversationsFromCache.fulfilled, (state, action) => {
                if (!isNotUndefinedOrNull(action.payload)) return;
                const normalized = normalizeAgentConversationData(action.payload);
                state.conversations = normalized.conversations;
                state.activeConversationId = normalized.activeConversationId;
                state.selectedModel = normalized.selectedModel;
                state.selectedReasoning = normalized.selectedReasoning;
                hydrateMessagesFromConversations(state);
            });
    },
});

export const reduxSlice = agentSlice;

export const loadConversationsFromCache = createAsyncThunk(
    'agent/loadConversationsFromCache',
    async () => {
        const [canonical, config] = await Promise.all([
            loadSingleExtensionConfigFromCache(CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_DATA.key),
            loadExtensionConfigFromCache([
                CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATIONS.key,
                CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_ACTIVE_ID.key,
                CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_MODEL.key,
                CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_REASONING.key,
            ]),
        ]);
        const legacyData = buildLegacyConversationData(config);
        if (isNotUndefinedOrNull(canonical)) {
            const merged = applyLegacySelectionOverrides(canonical, legacyData);
            return merged;
        }
        LOGGER.debug('[agent] loadConversationsFromCache legacy only', {
            legacySelectedModel: legacyData?.selectedModel,
            legacySelectedReasoning: legacyData?.selectedReasoning,
        });
        return legacyData;
    }
);

export const saveConversationsToCache = createAsyncThunk(
    'agent/saveConversationsToCache',
    async (_, { getState }) => {
        const state = getState();
        const payload = normalizeAgentConversationData({
            conversations: state.agent?.conversations,
            activeConversationId: state.agent?.activeConversationId,
            selectedModel: state.agent?.selectedModel,
            selectedReasoning: state.agent?.selectedReasoning,
        });
        const bulkConfig = {
            [CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATIONS.key]: payload.conversations,
            [CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_ACTIVE_ID.key]: payload.activeConversationId,
            [CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_MODEL.key]: payload.selectedModel,
            [CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_REASONING.key]: payload.selectedReasoning,
        };
        await saveSingleExtensionConfigToCache(
            CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_DATA.key,
            payload
        );
        await saveExtensionConfigToCache(bulkConfig);
        return { count: payload.conversations.length };
    }
);

// Execute agent stream thunk
export const executeAgent = createAsyncThunk(
    'agent/executeAgent',
    async ({ userMessages, agent }, { getState, dispatch }) => {
        try {
            LOGGER.debug('[agent] runExecuteAgent start', {
                conversationId: agent.conversationId,
                message: userMessages,
            });

            const AgentObserver = {
                onStepStart: (info: ProcessMessageStepStart) => {
                    LOGGER.debug('[agent] onStepStart', info);
                },
                onStepFinish: (info: ProcessMessageStepFinish) => {
                    LOGGER.debug('[agent] onStepFinish', info);
                },
                onToolStart: (info: ProcessMessageToolStart) => {
                    LOGGER.debug('[agent] onToolStart', info);
                },
                onToolFinish: (info: ProcessMessageToolFinish) => {
                    LOGGER.debug('[agent] onToolFinish', info);
                },
                onError: (info: ProcessMessageError) => {
                    LOGGER.debug('[agent] onError', info);
                    dispatch(
                        reduxSlice.actions.setError({
                            id: agent.conversationId,
                            title: 'Agent error',
                            message: info.message,
                        })
                    );
                },
            };
            dispatch(
                reduxSlice.actions.addMessages({
                    id: agent.conversationId,
                    messages: [...userMessages],
                })
            );
            dispatch(reduxSlice.actions.startLoading({ id: agent.conversationId }));
            dispatch(reduxSlice.actions.startStreaming({ id: agent.conversationId }));
            for await (const chunk of agent.processMessage(userMessages, AgentObserver)) {
            }
        } catch (e) {
            LOGGER.error('[agent] runExecuteAgent failed', e);
            dispatch(
                reduxSlice.actions.setError({
                    id: agent.conversationId,
                    title: 'Agent error',
                    message: e instanceof Error ? e.message : String(e),
                })
            );
            throw e;
        } finally {
            dispatch(
                reduxSlice.actions.updateConversationStreamHistory({
                    id: agent.conversationId,
                })
            );
            dispatch(reduxSlice.actions.stopLoading({ id: agent.conversationId }));
            dispatch(reduxSlice.actions.stopStreaming({ id: agent.conversationId }));
        }
    }
);
