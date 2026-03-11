import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { loggedInAgent, loggedOutAgent } from 'agent/agents';
import { filterToolsByModel } from 'agent/tools';
import {
    readFileContent,
    Message,
    Context,
    StreamingAgentService,
    Constants,
    DEFAULT_MODEL,
    DEFAULT_REASONING,
} from 'agent/utils';
import {
    CACHE_CONFIG,
    loadExtensionConfigFromCache,
    saveSingleExtensionConfigToCache,
    saveExtensionConfigToCache,
    loadSingleExtensionConfigFromCache,
} from 'shared/cacheManager';
import { getEffectiveAgentSkills } from 'shared/defaultAgentSkills';
import { ensureOpenAIAgentsBundleLoaded } from 'shared/loader';
import LOGGER from 'shared/logger';
import { isNotUndefinedOrNull, guid, ROLES } from 'shared/utils';

import * as ERROR from './error';

const AGENT_CACHE_KEYS = {
    ACTIVE_ID: 'einstein_agent_active_id',
    MODEL: 'einstein_agent_model',
};

async function loadAgents() {
    await ensureOpenAIAgentsBundleLoaded();
    return { loggedInAgent, loggedOutAgent };
}

function safeSerializeForDebug(obj) {
    try {
        return JSON.parse(JSON.stringify(obj, (_, v) => (typeof v === 'function' ? undefined : v)));
    } catch (_) {
        return null;
    }
}

const deepClone = obj => JSON.parse(JSON.stringify(obj));

function getReasoningConfigFromSelection(selection) {
    if (selection === 'off' || selection === 'none' || !selection) return undefined;
    return { effort: selection, summary: 'auto' };
}

const initialState = {
    conversations: [{ id: 'default', title: 'Conversation 1', streamHistory: [] }],
    activeConversationId: 'default',
    selectedModel: DEFAULT_MODEL,
    selectedReasoning: DEFAULT_REASONING,
    // Per-conversation error: { [conversationId]: { title, message } }
    errorById: {},
    // Per conversation UI state
    loadingById: {},
    streamingById: {},
    messagesById: {},
    streamingMessageById: {},
    debugMode: false,
    lastRunDebugByConversationId: {},
};

function saveCacheSettings(state) {
    try {
        const { conversations, activeConversationId, selectedModel, selectedReasoning } =
            JSON.parse(JSON.stringify(state));
        saveSingleExtensionConfigToCache(CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_DATA.key, {
            conversations,
            activeConversationId,
            selectedModel,
            selectedReasoning,
        });
    } catch (e) {
        LOGGER.error('Failed to save CONFIG to localstorage', e);
    }
}

function loadCacheSettings(cachedConfig, state) {
    try {
        const { conversations, activeConversationId, selectedModel, selectedReasoning } =
            cachedConfig;
        Object.assign(state, {
            conversations,
            activeConversationId,
            selectedModel,
        });
        if (selectedReasoning !== undefined) {
            state.selectedReasoning = selectedReasoning;
        }
    } catch (e) {
        LOGGER.error('Failed to load CONFIG from localstorage', e);
    }
}

function hydrateMessagesFromConversations(state) {
    if (!state.conversations || state.conversations.length === 0) return;
    if (!state.messagesById) state.messagesById = {};
    (state.conversations || []).forEach(c => {
        if (c.streamHistory && c.streamHistory.length > 0) {
            const msgs = Message.formatStreamHistory(c.streamHistory);
            const withoutWelcome = Array.isArray(msgs)
                ? msgs.filter(m => m.id !== Constants.WELCOME_MESSAGE.id)
                : [];
            state.messagesById[c.id] = withoutWelcome;
            LOGGER.debug('[agent] hydrateMessagesFromConversations', {
                conversationId: c.id,
                streamHistoryLength: c.streamHistory.length,
                formattedCount: Array.isArray(msgs) ? msgs.length : 0,
                afterFilterCount: withoutWelcome.length,
                roles: withoutWelcome.map(m => m.role),
                types: withoutWelcome.map(m => m.type),
            });
        } else {
            state.messagesById[c.id] = [];
        }
    });
}

// Async: load cached settings from extension storage
export const loadCacheSettingsAsync = createAsyncThunk(
    'agent/loadCacheSettings',
    async (_, { dispatch, getState }) => {
        try {
            return await loadSingleExtensionConfigFromCache(
                CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_DATA.key
            );
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
            const { conversation } = action.payload;
            state.conversations = [...state.conversations, conversation];
            saveCacheSettings(state);
        },
        deleteConversation: (state, action) => {
            const { id } = action.payload;
            const wasActive = state.activeConversationId === id;
            state.conversations = state.conversations.filter(c => c.id !== id);
            if (wasActive) {
                state.activeConversationId = state.conversations[0]?.id || null;
            }
            delete state.messagesById[id];
            delete state.loadingById[id];
            delete state.streamingById[id];
            delete state.streamingMessageById[id];
            delete state.streamingReasoningMessageById[id];
            if (state.streamingReasoningMessageIdById) {
                delete state.streamingReasoningMessageIdById[id];
            }
            delete state.errorById[id];
            if (state.lastRunDebugByConversationId) {
                delete state.lastRunDebugByConversationId[id];
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
        updateConversationStreamHistory: (state, action) => {
            const { id, streamHistory } = action.payload;
            const idx = state.conversations.findIndex(c => c.id === id);
            if (idx !== -1) {
                state.conversations[idx] = { ...state.conversations[idx], streamHistory };
            }
            saveCacheSettings(state);
        },
        updateSelectedModel: (state, action) => {
            const { model } = action.payload;
            state.selectedModel = model;
            saveCacheSettings(state);
        },
        setSelectedReasoning: (state, action) => {
            const { reasoning } = action.payload;
            state.selectedReasoning = reasoning ?? DEFAULT_REASONING;
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
        setMessages: (state, action) => {
            const { id, messages } = action.payload;
            state.messagesById[id] = Array.isArray(messages) ? messages : [];
            LOGGER.debug('[agent] setMessages', {
                conversationId: id,
                count: state.messagesById[id].length,
                roles: state.messagesById[id].map(m => m.role),
                types: state.messagesById[id].map(m => m.type),
            });
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
        setStreamingMessage: (state, action) => {
            const { id, message } = action.payload;
            state.streamingMessageById[id] = message || null;
        },
        clearStreamingMessage: (state, action) => {
            const { id } = action.payload;
            state.streamingMessageById[id] = null;
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
                const conversations = action.payload?.conversations || [];
                state.conversations = Array.isArray(conversations) ? conversations : [];
                const loadedActive = action.payload?.activeId;
                const loadedModel = action.payload?.model;
                if (loadedModel) {
                    state.selectedModel = loadedModel;
                }
                if (loadedActive && state.conversations.find(c => c.id === loadedActive)) {
                    state.activeConversationId = loadedActive;
                } else if (
                    !state.activeConversationId ||
                    !state.conversations.find(c => c.id === state.activeConversationId)
                ) {
                    state.activeConversationId = state.conversations[0]?.id || null;
                }
                hydrateMessagesFromConversations(state);
            });
    },
});

export const reduxSlice = agentSlice;

export const loadConversationsFromCache = createAsyncThunk(
    'agent/loadConversationsFromCache',
    async () => {
        const config = await loadExtensionConfigFromCache([
            CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATIONS.key,
            AGENT_CACHE_KEYS.ACTIVE_ID,
            AGENT_CACHE_KEYS.MODEL,
        ]);
        const conversations = config[CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATIONS.key] || [];
        const activeId = config[CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_ACTIVE_ID.key] || null;
        const model = config[CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_MODEL.key] || null;
        return { conversations, activeId, model };
    }
);

export const saveConversationsToCache = createAsyncThunk(
    'agent/saveConversationsToCache',
    async (_, { getState }) => {
        const state = getState();
        const convs = state.agent?.conversations || [];
        const activeId = state.agent?.activeConversationId || null;
        const model = state.agent?.selectedModel || null;
        const bulkConfig = {
            [CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATIONS.key]: convs,
            [CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_ACTIVE_ID.key]: activeId,
            [CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_MODEL.key]: model,
        };
        await saveExtensionConfigToCache(bulkConfig);
        return { count: convs.length };
    }
);

// Module-scoped registry for active streaming services (non-serializable)
const streamingServices = {};

const MAX_CONTINUATIONS = 5;

// Execute agent stream thunk
export const executeAgent = createAsyncThunk(
    'agent/executeAgent',
    async (
        { prompt, directMessages = [], files = [], model, conversationId, continuationCount = 0 },
        { getState, dispatch }
    ) => {
        const conversationIdForCleanup = conversationId;
        const dispatchError = (title, message) => {
            dispatch(reduxSlice.actions.stopLoading({ id: conversationIdForCleanup }));
            dispatch(reduxSlice.actions.stopStreaming({ id: conversationIdForCleanup }));
            dispatch(
                reduxSlice.actions.setError({
                    id: conversationIdForCleanup,
                    title: title || 'Error',
                    message: message || 'An error occurred',
                })
            );
        };
        try {
            return await runExecuteAgent(
                { prompt, directMessages, files, model, conversationId, continuationCount },
                { getState, dispatch, dispatchError }
            );
        } catch (e) {
            dispatchError('Error', e?.message || String(e));
            throw e;
        }
    }
);

async function runExecuteAgent(
    { prompt, directMessages = [], files = [], model, conversationId, continuationCount = 0 },
    { getState, dispatch, dispatchError }
) {
    const state = getState();
    let baseUrl = state.application?.openaiUrl || 'https://api.openai.com/v1';
    const directOpenAI = 'https://api.openai.com/v1';
    if (typeof window !== 'undefined' && window.location?.origin) {
        if (!state.application?.openaiUrl || state.application.openaiUrl === directOpenAI) {
            baseUrl = `${window.location.origin}/openai/v1`;
        }
        try {
            const url = new URL(baseUrl);
            if (
                (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
                url.protocol === 'https:'
            ) {
                url.protocol = 'http:';
                baseUrl = url.toString();
            }
        } catch (_) {
            // keep baseUrl as-is if URL parsing fails
        }
    }
    const openaiKey = state.application?.openaiKey ?? '';
    const isLoggedIn = !!state.application?.connector;

    const { loggedInAgent, loggedOutAgent } = await loadAgents();
    const { Runner, user, setDefaultOpenAIClient, setOpenAIAPI } = window.OpenAIAgentsBundle.Agents;
    const OpenAI = (await import('openai')).default;

    const openai = new OpenAI({
        dangerouslyAllowBrowser: true,
        apiKey: openaiKey,
        baseURL: baseUrl,
    });
    setDefaultOpenAIClient(openai);
    setOpenAIAPI('responses');
    const selectedAgent = isLoggedIn ? loggedInAgent : loggedOutAgent;

    dispatch(reduxSlice.actions.startLoading({ id: conversationId }));
    dispatch(reduxSlice.actions.startStreaming({ id: conversationId }));

    // Read files and upload PDFs if needed
    let filesData = [];
    if (files && files.length > 0) {
        filesData = await Promise.all(files.map(readFileContent));
        for (const file of filesData) {
            if (file.type === 'application/pdf' && file.content) {
                try {
                    const uploadResponse = await openai.files.create({
                        file: new File(
                            [await fetch(file.content).then(r => r.arrayBuffer())],
                            file.name,
                            { type: file.type }
                        ),
                        purpose: 'user_data',
                    });
                    if (uploadResponse && uploadResponse.id) {
                        file._openaiFileId = uploadResponse.id;
                    }
                } catch (err) {
                    // swallow upload errors; continue without file id
                }
            }
        }
    }

    // Initialize messages
    let currentMessages = state.agent?.messagesById?.[conversationId] || [];
    if (prompt) {
        const uiMessage = user(prompt);
        currentMessages = Message.updateOrAppendMessage(
            currentMessages,
            Message.formatMessage(uiMessage, filesData)
        );
        dispatch(reduxSlice.actions.setMessages({ id: conversationId, messages: currentMessages }));
    } else if (directMessages && directMessages.length > 0) {
        let updated = currentMessages;
        directMessages.forEach(msg => {
            updated = Message.appendMessageIfNotExists(updated, msg);
        });
        dispatch(reduxSlice.actions.setMessages({ id: conversationId, messages: updated }));
    }

    const rawMessages = (getState().agent?.messagesById?.[conversationId] || []).slice();
    const conversationOnly = rawMessages.filter(msg => msg.id !== Constants.WELCOME_MESSAGE.id);
    const messagesForRunner = conversationOnly.map(msg => Message.ensureMessageContentArray(msg));
    const currentModel = model || getState().agent?.selectedModel || DEFAULT_MODEL;
    const runner = new Runner({
        model: currentModel,
    });

    const filteredTools = filterToolsByModel(selectedAgent.tools || [], currentModel);
    const reasoningConfig =         getReasoningConfigFromSelection(
                getState().agent?.selectedReasoning ?? DEFAULT_REASONING
            );
    const agentWithFilteredTools = new Proxy(selectedAgent, {
        get(target, prop) {
            if (prop === 'getAllTools') return () => filteredTools;
            if (prop === 'tools') return filteredTools;
            if (prop === 'modelSettings') {
                const base = target.modelSettings || {};
                return reasoningConfig != null
                    ? { ...base, reasoning: reasoningConfig }
                    : { ...base, reasoning: undefined };
            }
            return target[prop];
        },
    });

    const fakeStore = { getState };
    const dynamicContext = `\n                Context:\n                    ${await Context.getCurrentGlobalContext(fakeStore)}\n                    ${await Context.getCurrentApplicationContext(fakeStore)}\n                `;
    const cachedSkills =
        (await loadSingleExtensionConfigFromCache(CACHE_CONFIG.EINSTEIN_AGENT_SKILLS.key)) || [];
    const skills = getEffectiveAgentSkills(cachedSkills);
    const enabledSkills = skills.filter(s => s && s.enabled);
    const skillsText =
        enabledSkills.length > 0
            ? `\n## Tool-use guidelines (apply when selecting and calling tools)\nFollow these guidelines to decide which tools to use and when. Do not call a tool when the guideline says "when NOT to use".\n\n${enabledSkills
                  .map(s => (s.content || '').trim())
                  .filter(Boolean)
                  .join('\n\n')}`
            : '';
    const runContext = { dynamicContext, skillsText };
    const debugMode = getState().agent?.debugMode === true;
    const rawEvents = [];
    let currentItemId = null;
    const serviceOptions = {
        maxTurns: 25,
        context: runContext,
        ...(reasoningConfig != null && { reasoning: reasoningConfig }),
        ...(debugMode && {
            onRawEvent: event => rawEvents.push(safeSerializeForDebug(event) ?? event),
        }),
        onChunk: chunk => {
            const list = (getState().agent?.messagesById?.[conversationId] || []).slice();
            const currentStreamingMessage = deepClone(getState().agent?.streamingMessageById?.[conversationId] || {});
            // Create or Close streaming message
            if (chunk.type === 'message') {
                if (chunk.start === true) {
                    currentItemId = chunk.item_id;
                    // New streaming message started
                    dispatch(
                        reduxSlice.actions.setStreamingMessage({
                            id: conversationId,
                            message: {
                                _key: chunk.item_id,
                                id: chunk.item_id,
                                role: chunk.role || ROLES.ASSISTANT,
                                type: chunk.itemType
                            },
                        })
                    );
                } else if (chunk.end === true) {
                    dispatch(reduxSlice.actions.setMessages({ id: conversationId, messages: [...list, { ...currentStreamingMessage }] }));
                    dispatch(reduxSlice.actions.clearStreamingMessage({ id: conversationId, item_id: currentItemId }));
                    currentItemId = null;
                }
            }else if (chunk.type === 'reasoning') {
                const summaryIndex = Number(chunk.summary_index) >= 0 ? Number(chunk.summary_index) : 0;
                if (chunk.partStart === true) {
                    currentStreamingMessage.content = currentStreamingMessage.content || [];
                    currentStreamingMessage.content.push({
                        ...chunk.part,
                        startedAt: chunk.startedAt != null ? Number(chunk.startedAt) : Date.now(),
                    });
                    dispatch(reduxSlice.actions.setStreamingMessage({ id: conversationId, message: currentStreamingMessage }));
                }else if (chunk.delta !== undefined) {
                    currentStreamingMessage.content[summaryIndex].text = currentStreamingMessage.content[summaryIndex].text + chunk.delta;
                    dispatch(reduxSlice.actions.setStreamingMessage({ id: conversationId, message: currentStreamingMessage }));
                } else if (chunk.partEnd === true) {
                    currentStreamingMessage.content[summaryIndex].endedAt = chunk.endedAt != null ? Number(chunk.endedAt) : Date.now();
                    dispatch(reduxSlice.actions.setStreamingMessage({ id: conversationId, message: currentStreamingMessage }));
                }
            } else if (chunk.type === 'output_text') {
                if (chunk.partStart === true) {
                    currentStreamingMessage.content = currentStreamingMessage.content || [];
                    currentStreamingMessage.content.push({
                        ...chunk.part,
                    });
                    dispatch(reduxSlice.actions.setStreamingMessage({ id: conversationId, message: currentStreamingMessage }));
                }else if (chunk.delta !== undefined) {
                    currentStreamingMessage.content[currentStreamingMessage.content.length - 1].text += chunk.delta;
                    dispatch(reduxSlice.actions.setStreamingMessage({ id: conversationId, message: currentStreamingMessage }));
                } else if (chunk.partEnd === true) {
                    dispatch(reduxSlice.actions.setStreamingMessage({ id: conversationId, message: currentStreamingMessage }));
                }
            }
        },
        onToolEvent: rawItem => {
            const msg = Message.formatMessage(rawItem, []);
            const list = (getState().agent?.messagesById?.[conversationId] || []).slice();
            const updated = Message.appendMessageIfNotExists(list, msg);
            dispatch(reduxSlice.actions.setMessages({ id: conversationId, messages: updated }));
        },
        onStreamEnd: async stream => {
            dispatch(reduxSlice.actions.stopLoading({ id: conversationId }));
            dispatch(reduxSlice.actions.stopStreaming({ id: conversationId }));
            const fullList = getState().agent?.messagesById?.[conversationId] ?? [];
            LOGGER.debug('[agent] onStreamEnd: persisting messages', {
                conversationId,
                fullListCount: fullList.length,
                roles: fullList.map(m => m.role),
                types: fullList.map(m => m.type),
            });
            dispatch(
                reduxSlice.actions.updateConversationStreamHistory({
                    id: conversationId,
                    streamHistory: fullList,
                })
            );
            dispatch(saveConversationsToCache());
            delete streamingServices[conversationId];

            if (debugMode) {
                const payload = {
                    runContext: {
                        model: currentModel,
                        timestamp: new Date().toISOString(),
                    },
                    messagesSent: safeSerializeForDebug(conversationOnly) ?? conversationOnly,
                    streamSnapshot: {
                        history: safeSerializeForDebug(stream.history) ?? stream.history,
                        newItems: safeSerializeForDebug(stream.newItems) ?? stream.newItems,
                        lastAgent: safeSerializeForDebug(stream.lastAgent) ?? {},
                    },
                    rawEvents: rawEvents.slice(),
                };
                dispatch(reduxSlice.actions.setLastRunDebug({ id: conversationId, data: payload }));
            }

            // If the last tool is in stopAtToolNames (e.g. chrome_screenshot, agent_request_continue),
            // re-run with the tool output as user message. Cap continuations for agent_request_continue.
            try {
                const stopNames = stream?.lastAgent?.toolUseBehavior?.stopAtToolNames || [];
                const newItems = Array.isArray(stream?.newItems) ? stream.newItems : [];
                const lastItem = newItems.length > 0 ? newItems[newItems.length - 1] : null;
                const lastOutputName = lastItem?.rawItem?.name;
                if (lastItem && stopNames.includes(lastOutputName)) {
                    const isAgentContinue = lastOutputName === 'agent_request_continue';
                    if (isAgentContinue && continuationCount >= MAX_CONTINUATIONS) {
                        dispatch(
                            reduxSlice.actions.setError({
                                id: conversationId,
                                title: 'Limit reached',
                                message:
                                    'Max automatic continuations reached. You can continue in a new message.',
                            })
                        );
                        return;
                    }
                    const outputContent = lastItem?.output?.content;
                    const isError = lastItem?.output?.isError;
                    if (outputContent && !isError) {
                        if (isAgentContinue) {
                            const list = getState().agent?.messagesById?.[conversationId] || [];
                            const continuingMsg = {
                                id: guid(),
                                _key: guid(),
                                role: ROLES.ASSISTANT,
                                content: 'Continuing with more steps…',
                            };
                            dispatch(
                                reduxSlice.actions.setMessages({
                                    id: conversationId,
                                    messages: [...list, continuingMsg],
                                })
                            );
                        }
                        const userMsg = user('');
                        userMsg.content = outputContent;
                        await dispatch(
                            executeAgent({
                                prompt: null,
                                directMessages: [Message.formatMessage(userMsg, [])],
                                files: [],
                                conversationId,
                                model: model || getState().agent?.selectedModel,
                                continuationCount: isAgentContinue ? continuationCount + 1 : 0,
                            })
                        );
                    } else if (isError) {
                        await dispatch(
                            executeAgent({
                                prompt: null,
                                directMessages: [],
                                files: [],
                                conversationId,
                                continuationCount,
                            })
                        );
                    } else {
                        LOGGER.error('No output content for stopAtToolNames item', lastItem);
                    }
                }
            } catch (e) {
                LOGGER.error('End-of-stream auto-resend handling failed', e);
            }
        },
        onError: e => {
            console.error('onError', e);
            if (debugMode) {
                dispatch(
                    reduxSlice.actions.setLastRunDebug({
                        id: conversationId,
                        data: {
                            runContext: {
                                model: currentModel,
                                timestamp: new Date().toISOString(),
                            },
                            error: {
                                message: e?.message ?? String(e),
                                name: e?.name,
                            },
                        },
                    })
                );
            }
            const msg = e?.message || '';
            const unsupportedTextMatch =
                msg.indexOf('Unsupported output content type') >= 0 &&
                (() => {
                    try {
                        const start = msg.indexOf('{');
                        const end = msg.lastIndexOf('}') + 1;
                        if (start >= 0 && end > start) {
                            const obj = JSON.parse(msg.slice(start, end));
                            if (
                                obj &&
                                typeof obj.text === 'string' &&
                                (obj.type === 'text' || obj.type === 'input_text')
                            )
                                return obj.text;
                        }
                    } catch (_) {}
                    const jsonMatch = msg.match(
                        /\{[^{}]*"type"\s*:\s*"(?:text|input_text)"[^{}]*"text"\s*:\s*"([^"]*(?:\\.[^"]*)*)"[^{}]*\}/
                    );
                    if (jsonMatch) return jsonMatch[1].replace(/\\"/g, '"');
                    return null;
                })();
            if (unsupportedTextMatch) {
                const list = (getState().agent?.messagesById?.[conversationId] || []).slice();
                const assistantMessage = {
                    id: guid(),
                    role: ROLES.ASSISTANT,
                    content: unsupportedTextMatch,
                };
                const updated = Message.appendMessageIfNotExists(list, assistantMessage);
                dispatch(reduxSlice.actions.setMessages({ id: conversationId, messages: updated }));
                dispatch(reduxSlice.actions.clearStreamingMessage({ id: conversationId }));
            } else {
                dispatch(
                    reduxSlice.actions.setError({
                        id: conversationId,
                        title: 'Error',
                        message: msg,
                    })
                );
            }
            dispatch(reduxSlice.actions.stopLoading({ id: conversationId }));
            dispatch(reduxSlice.actions.stopStreaming({ id: conversationId }));
            delete streamingServices[conversationId];
        },
    };
    const service = new StreamingAgentService(
        runner,
        agentWithFilteredTools,
        messagesForRunner,
        serviceOptions
    );

    streamingServices[conversationId] = service;
    await service.startStreaming();
    return { started: true };
}

export const stopAgent = createAsyncThunk('agent/stopAgent', async ({ id }, { dispatch }) => {
    const service = streamingServices[id];
    if (service) {
        try {
            service.abort();
        } catch (e) {}
        delete streamingServices[id];
    }
    dispatch(reduxSlice.actions.stopLoading({ id }));
    dispatch(reduxSlice.actions.stopStreaming({ id }));
    return { id };
});
