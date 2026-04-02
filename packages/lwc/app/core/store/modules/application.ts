import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getOpenAIKeyFromCache } from 'shared/cacheManager';
import { lowerCaseKey, guid, isUndefinedOrNull } from 'shared/utils';
import type { ConnectorLike } from 'core/connector';

const saveSession = value => {
    sessionStorage.setItem('currentConnection', JSON.stringify(value));
};

const removeSession = () => {
    sessionStorage.removeItem('currentConnection');
};

// QUERIES
type ApplicationState = {
    isLoading: boolean;
    isLoadingMessage?: string | null;
    connector: ConnectorLike | null;
    isLoggedIn: boolean;
    currentApplication: string | null;
    sessionHasExpired: boolean;
    isSidePanel: boolean;
    aiProvider: string;
    openaiKey: string | null;
    openaiUrl: string;
    mistralKey: string | null;
    isInternal: boolean;
};

const initialState: ApplicationState = {
    isLoading: false,
    connector: null,
    isLoggedIn: false,
    currentApplication: null,
    sessionHasExpired: false,
    isSidePanel: false,
    aiProvider: 'openai',
    openaiKey: null,
    openaiUrl: 'https://api.openai.com/v1', // Used for OpenAI proxy
    mistralKey: null, // Added for Mistral
    isInternal: false,
};

const applicationSlice = createSlice({
    name: 'application',
    initialState,
    reducers: {
        isLoading: false,
        connector: null,
        isLoggedIn: false,
        currentApplication: null,
        sessionHasExpired: false,
        isSidePanel: false,
        aiProvider: 'openai',
        openaiKey: null,
        openaiUrl: 'https://api.openai.com/v1', // Used for OpenAI proxy
        mistralKey: null, // Added for Mistral
        isInternal: false,
    },
    reducers: {
        updateCurrentApplication: (state, action) => {
            state.currentApplication = action.payload?.application || null;
        },
        startLoading: (state, action) => {
            state.isLoading = true;
            state.isLoadingMessage = action.payload?.message || null;
        },
        stopLoading: (state, action) => {
            state.isLoading = false;
        },
        setIsSidePanel: (state, action) => {
            state.isSidePanel = true;
        },
        login: (state, action) => {
            const { connector } = action.payload;
            state.connector = connector;
            state.isLoggedIn = true;
            state.sessionHasExpired = false;
            // Save Session
            const { instanceUrl, accessToken, version, refreshToken } = connector.conn;
            saveSession({
                ...connector.configuration,
                instanceUrl,
                accessToken,
                instanceApiVersion: version,
                refreshToken,
            });
        },
        logout: (state, action) => {
            state.connector = null;
            state.isLoggedIn = false;
            state.currentApplication = null;
            state.sessionHasExpired = false;
            // Remove Session
            removeSession();
        },
        sessionExpired: (state, action) => {
            const { sessionHasExpired } = action.payload;
            state.sessionHasExpired = sessionHasExpired;
        },
        updateConnector: (state, action) => {
            const { connector } = action.payload;
            state.connector = connector;
            state.sessionHasExpired = false;
        },
        updateAiProvider: (state, action) => {
            const { aiProvider } = action.payload;
            state.aiProvider = aiProvider;
        },
        updateOpenAIKey: (state, action) => {
            const { openaiKey, openaiUrl } = action.payload;
            state.openaiKey = openaiKey;
            if (openaiUrl !== undefined) {
                state.openaiUrl = openaiUrl;
            }
            const nextUrl = state.openaiUrl || '';
            state.isInternal = nextUrl.includes('eng-ai-model-gateway');
        },
        updateMistralKey: (state, action) => {
            const { mistralKey } = action.payload;
            state.mistralKey = mistralKey;
        },
    },
});

export const reduxSlice = applicationSlice;
