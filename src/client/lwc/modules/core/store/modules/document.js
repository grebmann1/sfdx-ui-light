import { createSlice, createAsyncThunk, createEntityAdapter } from '@reduxjs/toolkit';
import { lowerCaseKey, guid, isUndefinedOrNull } from 'shared/utils';
import { CACHE_DOCUMENTS, cacheManager } from 'shared/cacheManager';

// Adapters
export const queryFileAdapter = createEntityAdapter();
export const apexFileAdapter = createEntityAdapter();
export const apiFileAdapter = createEntityAdapter();
export const openapiSchemaFileAdapter = createEntityAdapter();
export const platformEventFileAdapter = createEntityAdapter();
export const shortcutFileAdapter = createEntityAdapter();

const MAX_RECENT = 20;
const RECENT_QUERIES_KEY = 'lsb.recentQueries';
const RECENT_APEX_KEY = 'lsb.recentApex';
const RECENT_API_KEY = 'lsb.recentApi';
const RECENT_PLATFORM_EVENT_KEY = 'lsb.recentPlatformEvents';
const RECENT_RECORD_VIEWER_KEY = 'lsb.recentRecordViewer';

function setInLocalStorage(referenceKey, entities) {
    try {
        localStorage.setItem(referenceKey, JSON.stringify(entities));
    } catch (e) {
        console.error(`Failed to save ${referenceKey} to localstorage`, e);
    }
}

function loadFromStorage(referenceKey) {
    try {
        const itemText = localStorage.getItem(referenceKey);
        if (itemText) return JSON.parse(itemText);
    } catch (e) {
        console.error(`Failed to load ${referenceKey} from localstorage`, e);
    }
    return [];
}

function formatData(payload) {
    if (
        isUndefinedOrNull(payload.id) ||
        isUndefinedOrNull(payload.isGlobal) ||
        (isUndefinedOrNull(payload.alias) && payload.isGlobal == false)
    ) {
        throw new Error('Required data missing !');
    }
    return {
        id: lowerCaseKey(payload.id),
        content: payload.content,
        name: payload.name || payload.id,
        isGlobal: payload.isGlobal,
        alias: payload.isGlobal ? null : payload.alias,
        extra: payload.extra, // Used to store extra params such as useToolingApi
    };
}

function loadRecent(key) {
    try {
        const recentText = localStorage.getItem(key);
        if (recentText) return JSON.parse(recentText);
    } catch (e) {
        console.error(`Failed to load "${key}" from localStorage`, e);
    }
    return [];
}

// APEX
const apexFileSlice = createSlice({
    name: 'apexFiles',
    initialState: apexFileAdapter.getInitialState(),
    reducers: {
        loadFromStorage: (state, action) => {
            apexFileAdapter.setAll(state, loadFromStorage(CACHE_DOCUMENTS.APEXFILES));
        },
        upsertOne: (state, action) => {
            apexFileAdapter.upsertOne(state, formatData(action.payload));
            const entities = Object.values(state.entities);
            setInLocalStorage(CACHE_DOCUMENTS.APEXFILES, entities);
        },
        removeOne: (state, action) => {
            apexFileAdapter.removeOne(state, action.payload);
            const entities = Object.values(state.entities);
            setInLocalStorage(CACHE_DOCUMENTS.APEXFILES, entities);
        },
    },
});

// QUERIES
const queryFileSlice = createSlice({
    name: 'queryFiles',
    initialState: queryFileAdapter.getInitialState(),
    reducers: {
        loadFromStorage: (state, action) => {
            queryFileAdapter.setAll(state, loadFromStorage(CACHE_DOCUMENTS.QUERYFILES));
        },
        upsertOne: (state, action) => {
            queryFileAdapter.upsertOne(state, formatData(action.payload));
            const entities = Object.values(state.entities);
            setInLocalStorage(CACHE_DOCUMENTS.QUERYFILES, entities);
        },
        removeOne: (state, action) => {
            queryFileAdapter.removeOne(state, action.payload);
            const entities = Object.values(state.entities);
            setInLocalStorage(CACHE_DOCUMENTS.QUERYFILES, entities);
        },
    },
});

// SHORTCUTS
const shortcutFileSlice = createSlice({
    name: 'shortcutFiles',
    initialState: shortcutFileAdapter.getInitialState(),
    reducers: {
        loadFromStorage: (state, action) => {
            shortcutFileAdapter.setAll(state, loadFromStorage(CACHE_DOCUMENTS.SHORTCUTFILES));
        },
        upsertOne: (state, action) => {
            shortcutFileAdapter.upsertOne(state, formatData(action.payload));
            const entities = Object.values(state.entities);
            setInLocalStorage(CACHE_DOCUMENTS.SHORTCUTFILES, entities);
        },
        removeOne: (state, action) => {
            shortcutFileAdapter.removeOne(state, action.payload);
            const entities = Object.values(state.entities);
            setInLocalStorage(CACHE_DOCUMENTS.SHORTCUTFILES, entities);
        },
    },
});

// API
const apiFileSlice = createSlice({
    name: 'apiFiles',
    initialState: apiFileAdapter.getInitialState(),
    reducers: {
        loadFromStorage: (state, action) => {
            apiFileAdapter.setAll(state, loadFromStorage(CACHE_DOCUMENTS.APIFILES));
        },
        upsertOne: (state, action) => {
            apiFileAdapter.upsertOne(state, formatData(action.payload));
            const entities = Object.values(state.entities);
            setInLocalStorage(CACHE_DOCUMENTS.APIFILES, entities);
        },
        removeOne: (state, action) => {
            apiFileAdapter.removeOne(state, action.payload);
            const entities = Object.values(state.entities);
            setInLocalStorage(CACHE_DOCUMENTS.APIFILES, entities);
        },
    },
});

// OPENAPI SCHEMAS
const openapiSchemaFileSlice = createSlice({
    name: 'openapiSchemaFiles',
    initialState: openapiSchemaFileAdapter.getInitialState(),
    reducers: {
        loadFromStorage: (state, action) => {
            openapiSchemaFileAdapter.setAll(state,loadFromStorage(CACHE_DOCUMENTS.OPENAPI_SCHEMAS_FILES));
        },
        upsertOne: (state, action) => {
            openapiSchemaFileAdapter.upsertOne(state, formatData(action.payload));
            const entities = Object.values(state.entities);
            setInLocalStorage(CACHE_DOCUMENTS.OPENAPI_SCHEMAS_FILES, entities);
        },
        removeOne: (state, action) => {
            openapiSchemaFileAdapter.removeOne(state, action.payload);
            const entities = Object.values(state.entities);
            setInLocalStorage(CACHE_DOCUMENTS.OPENAPI_SCHEMAS_FILES, entities);
        },
    },
});
// RECENT (Basic Arrays)
const recentSlice = createSlice({
    name: 'recents',
    initialState: {
        queries: [],
        apex: [],
        platformEvents: [],
        api: [],
        recordViewers: [],
    },
    reducers: {
        loadFromStorage: (state, action) => {
            state.queries = loadRecent(`${action.payload.alias}-${RECENT_QUERIES_KEY}`);
            state.apex = loadRecent(`${action.payload.alias}-${RECENT_APEX_KEY}`);
            state.api = loadRecent(`${action.payload.alias}-${RECENT_API_KEY}`);
            state.platformEvents = loadRecent(
                `${action.payload.alias}-${RECENT_PLATFORM_EVENT_KEY}`
            );
            state.recordViewers = loadRecent(`${action.payload.alias}-${RECENT_RECORD_VIEWER_KEY}`);
        },
        saveQuery: (state, action) => {
            const { soql, alias } = action.payload;
            const recentQueriesState = [
                soql,
                ...state.queries.filter(q => q !== soql).slice(0, MAX_RECENT - 1),
            ];
            setInLocalStorage(`${alias}-${RECENT_QUERIES_KEY}`, recentQueriesState);
            state.queries = recentQueriesState;
        },
        saveApex: (state, action) => {
            const { body, alias } = action.payload;
            const recentApexState = [
                body,
                ...state.apex.filter(q => q !== body).slice(0, MAX_RECENT - 1),
            ];
            setInLocalStorage(`${alias}-${RECENT_APEX_KEY}`, recentApexState);
            state.apex = recentApexState;
        },
        saveApi: (state, action) => {
            // item = body, url and header
            const { item, alias } = action.payload;
            const recentApiState = [
                item,
                ...state.api
                    .filter(q => q.method !== item.method || q.endpoint !== item.endpoint)
                    .slice(0, MAX_RECENT - 1),
            ];
            setInLocalStorage(`${alias}-${RECENT_API_KEY}`, recentApiState);
            state.api = recentApiState;
        },
        savePlatformEvents: (state, action) => {
            const { channel, alias } = action.payload;
            const recentPlatformEventState = [
                channel,
                ...state.platformEvents.filter(q => q !== channel).slice(0, MAX_RECENT - 1),
            ];
            setInLocalStorage(
                `${alias}-${RECENT_PLATFORM_EVENT_KEY}`,
                recentPlatformEventState
            );
            state.platformEvents = recentPlatformEventState;
        },
        saveRecordViewers: (state, action) => {
            const { item, alias } = action.payload;
            const recentRecordViewerState = [
                item,
                ...state.recordViewers
                    .filter(q => q.recordId !== item.recordId)
                    .slice(0, MAX_RECENT - 1),
            ];
            setInLocalStorage(
                `${alias}-${RECENT_RECORD_VIEWER_KEY}`,
                recentRecordViewerState
            );
            state.recordViewers = recentRecordViewerState;
        },
    },
});

export const reduxSlices = {
    QUERYFILE: queryFileSlice,
    APEXFILE: apexFileSlice,
    APIFILE: apiFileSlice,
    OPENAPI_SCHEMA_FILE: openapiSchemaFileSlice,
    SHORTCUTFILE: shortcutFileSlice,
    RECENT: recentSlice,
};
