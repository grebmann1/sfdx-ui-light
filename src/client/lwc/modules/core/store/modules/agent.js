import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { CACHE_CONFIG, loadExtensionConfigFromCache, saveSingleExtensionConfigToCache, saveExtensionConfigToCache, loadSingleExtensionConfigFromCache } from 'shared/cacheManager';
import { ERROR } from 'core/store';
import { isNotUndefinedOrNull, guid } from 'shared/utils';
import { readFileContent, Message, Context, StreamingAgentService } from 'agent/utils';
import { loggedInAgent, loggedOutAgent } from 'agent/agents';

const AGENT_CACHE_KEYS = {
    ACTIVE_ID: 'einstein_agent_active_id',
    MODEL: 'einstein_agent_model',
};

const initialState = {
    conversations: [
        { id: 'default', title: 'Conversation 1', streamHistory: [] },
    ],
    activeConversationId: 'default',
    selectedModel: 'gpt-5-mini',
    errorTitle: null,
    errorMessage: null,
    // Per conversation UI state
    loadingById: {},
    streamingById: {},
    messagesById: {},
    streamingMessageById: {},
};

function saveCacheSettings(state) {
    try {
        const { conversations, activeConversationId, selectedModel } = JSON.parse(JSON.stringify(state));
        saveSingleExtensionConfigToCache(CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_DATA.key,{
            conversations,
            activeConversationId,
            selectedModel
        });
    } catch (e) {
        console.error('Failed to save CONFIG to localstorage', e);
    }
}

function loadCacheSettings(cachedConfig, state) { 
    try {
        const { conversations, activeConversationId, selectedModel } = cachedConfig;
        Object.assign(state, { conversations, activeConversationId, selectedModel });
    } catch (e) {
        console.error('Failed to load CONFIG from localstorage', e);
    }
} 

// Async: load cached settings from extension storage
export const loadCacheSettingsAsync = createAsyncThunk(
    'agent/loadCacheSettings',
    async (_, { dispatch, getState }) => {
        try {
            return await loadSingleExtensionConfigFromCache(CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATION_DATA.key);
        } catch (e) {
            console.error('loadCacheSettings.rejected --> error', e);
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
        setConversations: (state, action) => {
            const { conversations } = action.payload;
            state.conversations = Array.isArray(conversations) ? conversations : [];
            if (!state.activeConversationId || !state.conversations.find(c => c.id === state.activeConversationId)) {
                state.activeConversationId = state.conversations[0]?.id || null;
            }
            saveCacheSettings(state);
        },
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
        setError: (state, action) => {
            const { title, message } = action.payload || {};
            state.errorTitle = title || 'Error';
            state.errorMessage = message || null;
        },
        resetError: (state) => {
            state.errorTitle = null;
            state.errorMessage = null;
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
    },
    extraReducers: builder => {
        builder
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
                } else if (!state.activeConversationId || !state.conversations.find(c => c.id === state.activeConversationId)) {
                    state.activeConversationId = state.conversations[0]?.id || null;
                }
            })
            .addCase(loadCacheSettingsAsync.fulfilled, (state, action) => {
                const cachedConfig = action.payload;
                if(isNotUndefinedOrNull(cachedConfig)) {
                    loadCacheSettings(cachedConfig, state);
                }
                // In case there is issue with some missing messages, check this FUNCTION !!!
                (state.conversations || []).forEach(c => {
                    const hasMessages = (state.messagesById?.[c.id] || []).length > 0;
                    if (!hasMessages && c.streamHistory && c.streamHistory.length > 0) {
                        const msgs = Message.formatStreamHistory(c.streamHistory);
                        state.messagesById[c.id] = Array.isArray(msgs) ? msgs : [];
                    }
                });
            });
    }
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

// Execute agent stream thunk
export const executeAgent = createAsyncThunk(
    'agent/executeAgent',
    async ({ prompt, directMessages = [], files = [], model, conversationId }, { getState, dispatch }) => {
        const state = getState();
        const openaiKey = state.application?.openaiKey;
        const baseUrl = state.application?.openaiUrl;
        const isLoggedIn = !!state.application?.connector;

        const { Runner, user, setDefaultOpenAIClient, setOpenAIAPI } = window.OpenAIAgentsBundle?.Agents || {};
        const OpenAI = (await import('openai')).default;
        

        const openai = new OpenAI({ dangerouslyAllowBrowser: true, apiKey: openaiKey, baseURL: baseUrl });
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
                            file: new File([await fetch(file.content).then(r => r.arrayBuffer())], file.name, { type: file.type }),
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
            currentMessages = Message.updateOrAppendMessage(currentMessages, Message.formatMessage(uiMessage, filesData));
            dispatch(reduxSlice.actions.setMessages({ id: conversationId, messages: currentMessages }));
        } else if (directMessages && directMessages.length > 0) {
            let updated = currentMessages;
            directMessages.forEach(msg => {
                updated = Message.appendMessageIfNotExists(updated, msg);
            });
            dispatch(reduxSlice.actions.setMessages({ id: conversationId, messages: updated }));
        }

        const messagesForRunner = (getState().agent?.messagesById?.[conversationId] || []).slice();
        const runner = new Runner({ model: model || getState().agent?.selectedModel || 'gpt-5-mini' });

        const fakeStore = { getState };
        const context = `\n                Context:\n                    ${await Context.getCurrentGlobalContext(fakeStore)}\n                    ${await Context.getCurrentApplicationContext(fakeStore)}\n                `;
        const service = new StreamingAgentService(
            runner,
            selectedAgent,
            messagesForRunner,
            {
                maxTurns: 25,
                context,
                onChunk: (chunk) => {
                    if (chunk.delta !== undefined) {
                        const current = (getState().agent?.streamingMessageById?.[conversationId]) || { id: guid(), content: '' };
                        const next = { ...current, content: (current.content || '') + chunk.delta };
                        dispatch(reduxSlice.actions.setStreamingMessage({ id: conversationId, message: next }));
                    } else {
                        dispatch(reduxSlice.actions.setStreamingMessage({ id: conversationId, message: { ...chunk } }));
                        dispatch(reduxSlice.actions.stopLoading({ id: conversationId }));
                    }
                },
                onToolEvent: (rawItem) => {
                    const msg = Message.formatMessage(rawItem, []);
                    const list = (getState().agent?.messagesById?.[conversationId] || []).slice();
                    const updated = Message.appendMessageIfNotExists(list, msg);
                    dispatch(reduxSlice.actions.setMessages({ id: conversationId, messages: updated }));
                },
                onStreamEnd: async (stream) => {
                    const streamingMsg = getState().agent?.streamingMessageById?.[conversationId];
                    if (streamingMsg) {
                        const list = (getState().agent?.messagesById?.[conversationId] || []).slice();
                        const updated = Message.appendMessageIfNotExists(list, streamingMsg);
                        dispatch(reduxSlice.actions.setMessages({ id: conversationId, messages: updated }));
                        dispatch(reduxSlice.actions.clearStreamingMessage({ id: conversationId }));
                    }
                    dispatch(reduxSlice.actions.stopLoading({ id: conversationId }));
                    dispatch(reduxSlice.actions.stopStreaming({ id: conversationId }));
                    dispatch(reduxSlice.actions.updateConversationStreamHistory({ id: conversationId, streamHistory: stream.history }));
                    dispatch(saveConversationsToCache());
                    delete streamingServices[conversationId];

                    // Adapted from previous processEndOfStream logic:
                    // If the last tool output name is in stopAtToolNames (e.g. chrome_screenshot),
                    // immediately re-run with the tool output content as a user message.
                    try {
                        const stopNames = stream?.lastAgent?.toolUseBehavior?.stopAtToolNames || [];
                        const newItems = Array.isArray(stream?.newItems) ? stream.newItems : [];
                        const lastItem = newItems.length > 0 ? newItems[newItems.length - 1] : null;
                        const lastOutputName = lastItem?.rawItem?.name;
                        if (lastItem && stopNames.includes(lastOutputName)) {
                            const outputContent = lastItem?.output?.content;
                            const isError = lastItem?.output?.isError;
                            if (outputContent && !isError) {
                                const userMsg = user('');
                                userMsg.content = outputContent;
                                await dispatch(executeAgent({
                                    prompt: null,
                                    directMessages: [Message.formatMessage(userMsg, [])],
                                    files: [],
                                    conversationId,
                                }));
                            } else if (isError) {
                                // Dry run to process the error (if possible)
                                await dispatch(executeAgent({ prompt: null, directMessages: [], files: [], conversationId }));
                            } else {
                                // No output content
                                // eslint-disable-next-line no-console
                                console.error('No output content for stopAtToolNames item', lastItem);
                            }
                        }
                    } catch (e) {
                        // eslint-disable-next-line no-console
                        console.error('End-of-stream auto-resend handling failed', e);
                    }
                },
                onError: (e) => {
                    dispatch(reduxSlice.actions.stopLoading({ id: conversationId }));
                    dispatch(reduxSlice.actions.stopStreaming({ id: conversationId }));
                    dispatch(reduxSlice.actions.setError({ title: 'Error', message: e?.message }));
                    delete streamingServices[conversationId];
                },
            }
        );

        streamingServices[conversationId] = service;
        await service.startStreaming();
        return { started: true };
    }
);

export const stopAgent = createAsyncThunk(
    'agent/stopAgent',
    async ({ id }, { dispatch }) => {
        const service = streamingServices[id];
        if (service) {
            try { service.abort(); } catch (e) {}
            delete streamingServices[id];
        }
        dispatch(reduxSlice.actions.stopLoading({ id }));
        dispatch(reduxSlice.actions.stopStreaming({ id }));
        return { id };
    }
);


