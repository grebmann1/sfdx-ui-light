import { createSlice } from '@reduxjs/toolkit';
import {
    createDefaultProviderConfigMap,
    DEFAULT_LLM_PROVIDER,
    isInternalProviderBaseUrl,
    normalizeLlmProvider,
    normalizeProviderConfigMap,
    type LlmModelOption,
    type LlmProvider,
    type LlmProviderCatalog,
    type LlmProviderConfigMap,
} from 'shared/llm';
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
    providerConfigs: LlmProviderConfigMap;
    availableModelsByProvider: Record<LlmProvider, LlmModelOption[]>;
    modelCatalogStatusByProvider: Record<
        LlmProvider,
        {
            status: LlmProviderCatalog['status'];
            error?: string | null;
        }
    >;
    openaiKey: string | null;
    openaiUrl: string;
    mistralKey: string | null;
    isInternal: boolean;
};

function getActiveProviderConfig(state: ApplicationState) {
    return state.providerConfigs[normalizeLlmProvider(state.aiProvider)];
}

function syncLegacyProviderFields(state: ApplicationState) {
    state.openaiKey = state.providerConfigs.openai.apiKey;
    state.openaiUrl = state.providerConfigs.openai.baseUrl;
    state.mistralKey = state.providerConfigs.mistral.apiKey;
    const activeConfig = getActiveProviderConfig(state);
    state.isInternal = isInternalProviderBaseUrl(activeConfig?.baseUrl || '');
}

const initialState: ApplicationState = {
    isLoading: false,
    connector: null,
    isLoggedIn: false,
    currentApplication: null,
    sessionHasExpired: false,
    isSidePanel: false,
    aiProvider: DEFAULT_LLM_PROVIDER,
    providerConfigs: createDefaultProviderConfigMap(),
    availableModelsByProvider: {
        openai: [],
        anthropic: [],
        gemini: [],
        mistral: [],
        grok: [],
    },
    modelCatalogStatusByProvider: {
        openai: { status: 'missing_key', error: null },
        anthropic: { status: 'missing_key', error: null },
        gemini: { status: 'missing_key', error: null },
        mistral: { status: 'missing_key', error: null },
        grok: { status: 'missing_key', error: null },
    },
    openaiKey: null,
    openaiUrl: createDefaultProviderConfigMap().openai.baseUrl,
    mistralKey: null,
    isInternal: false,
};

const applicationSlice = createSlice({
    name: 'application',
    initialState,
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
            state.aiProvider = normalizeLlmProvider(aiProvider);
            syncLegacyProviderFields(state);
        },
        updateProviderConfigs: (state, action) => {
            state.providerConfigs = normalizeProviderConfigMap(action.payload?.providerConfigs);
            syncLegacyProviderFields(state);
        },
        updateProviderConfig: (state, action) => {
            const provider = normalizeLlmProvider(action.payload?.provider);
            state.providerConfigs = normalizeProviderConfigMap({
                ...state.providerConfigs,
                [provider]: {
                    ...state.providerConfigs[provider],
                    ...action.payload?.config,
                },
            });
            syncLegacyProviderFields(state);
        },
        updateProviderCatalogs: (state, action) => {
            const catalogs = action.payload?.catalogs || {};
            for (const provider of Object.keys(state.availableModelsByProvider) as LlmProvider[]) {
                const catalog = catalogs[provider];
                if (!catalog) continue;
                state.availableModelsByProvider[provider] = Array.isArray(catalog.models)
                    ? catalog.models
                    : [];
                state.modelCatalogStatusByProvider[provider] = {
                    status: catalog.status,
                    error: catalog.error ?? null,
                };
            }
        },
        updateOpenAIKey: (state, action) => {
            const { openaiKey, openaiUrl } = action.payload;
            state.providerConfigs = normalizeProviderConfigMap({
                ...state.providerConfigs,
                openai: {
                    ...state.providerConfigs.openai,
                    apiKey: openaiKey ?? null,
                    baseUrl: openaiUrl ?? state.providerConfigs.openai.baseUrl,
                },
            });
            syncLegacyProviderFields(state);
        },
        updateMistralKey: (state, action) => {
            const { mistralKey } = action.payload;
            state.providerConfigs = normalizeProviderConfigMap({
                ...state.providerConfigs,
                mistral: {
                    ...state.providerConfigs.mistral,
                    apiKey: mistralKey ?? null,
                },
            });
            syncLegacyProviderFields(state);
        },
    },
});

export const reduxSlice = applicationSlice;
