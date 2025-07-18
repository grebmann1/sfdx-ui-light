import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { saveSession, removeSession } from 'connection/utils';
import { getOpenAIKeyFromCache } from 'shared/cacheManager';
import { lowerCaseKey, guid, isUndefinedOrNull } from 'shared/utils';

// QUERIES
const applicationSlice = createSlice({
    name: 'application',
    initialState: {
        isLoading: false,
        connector: null,
        isLoggedIn: false,
        currentApplication: null,
        sessionHasExpired: false,
        aiProvider: 'openai',
        openaiKey: null,
        mistralKey: null, // Added for Mistral
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
            const { openaiKey } = action.payload;
            state.openaiKey = openaiKey;
        },
        updateMistralKey: (state, action) => {
            const { mistralKey } = action.payload;
            state.mistralKey = mistralKey;
        },
    },
});

export const reduxSlice = applicationSlice;
