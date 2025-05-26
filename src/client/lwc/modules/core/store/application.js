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
        openaiKey: null,
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
        updateOpenAIKey: (state, action) => {
            const { openaiKey } = action.payload;
            state.openaiKey = openaiKey;
        },
    },
});

export const reduxSlice = applicationSlice;
