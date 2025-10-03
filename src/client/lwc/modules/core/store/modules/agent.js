import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { CACHE_CONFIG, loadExtensionConfigFromCache, saveSingleExtensionConfigToCache, saveExtensionConfigToCache } from 'shared/cacheManager';
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
        },
        addConversation: (state, action) => {
            const { conversation } = action.payload;
            state.conversations = [...state.conversations, conversation];
        },
        deleteConversation: (state, action) => {
            const { id } = action.payload;
            const wasActive = state.activeConversationId === id;
            state.conversations = state.conversations.filter(c => c.id !== id);
            if (wasActive) {
                state.activeConversationId = state.conversations[0]?.id || null;
            }
        },
        setActiveConversationId: (state, action) => {
            const { id } = action.payload;
            state.activeConversationId = id;
        },
        updateConversationTitle: (state, action) => {
            const { id, title } = action.payload;
            const idx = state.conversations.findIndex(c => c.id === id);
            if (idx !== -1) {
                state.conversations[idx] = { ...state.conversations[idx], title };
            }
        },
        updateConversationStreamHistory: (state, action) => {
            const { id, streamHistory } = action.payload;
            const idx = state.conversations.findIndex(c => c.id === id);
            if (idx !== -1) {
                state.conversations[idx] = { ...state.conversations[idx], streamHistory };
            }
        },
        updateSelectedModel: (state, action) => {
            const { model } = action.payload;
            state.selectedModel = model;
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

        const { Runner, user, setDefaultOpenAIClient, setOpenAIAPI } = window.OpenAIAgentsBundle?.Agents;
        const OpenAI = (await import('openai')).default;
        const { readFileContent, Message, Context } = await import('agent/utils');
        const { loggedInAgent, loggedOutAgent } = await import('agent/agents');
        const { guid } = await import('shared/utils');

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

        const { StreamingAgentService } = await import('agent/utils');
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
                onStreamEnd: (stream) => {
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


