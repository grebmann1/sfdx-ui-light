import { createSlice,createAsyncThunk,createEntityAdapter } from '@reduxjs/toolkit';
import { lowerCaseKey,guid,isUndefinedOrNull } from 'shared/utils';


// Adapters
export const queryFileAdapter = createEntityAdapter();
export const apexFileAdapter = createEntityAdapter();
export const platformEventFileAdapter = createEntityAdapter();


const REFERENCES = {
    QUERYFILES:'QUERYFILES',
    APEXFILES:'APEXFILES',
    RECENT:'RECENTS'
}
const MAX_RECENT = 20;
const RECENT_QUERIES_KEY = 'lsb.recentQueries';
const RECENT_APEX_KEY = 'lsb.recentApex';
const RECENT_PLATFORM_EVENT_KEY = 'lsb.recentPlatformEvents';

function setInLocalStorage(referenceKey,entities) {
    try {
        localStorage.setItem(referenceKey,JSON.stringify(entities));
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

function formatData(payload){
    if(isUndefinedOrNull(payload.id) || isUndefinedOrNull(payload.isGlobal) || isUndefinedOrNull(payload.alias) && payload.isGlobal == false){
        throw new Error('Required data missing !');
    }
    return {
        id:lowerCaseKey(payload.id),
        content:payload.content,
        name:payload.name || payload.id,
        isGlobal:payload.isGlobal,
        alias:payload.isGlobal?null:payload.alias,
        extra:payload.extra // Used to store extra params such as useToolingApi
    }
}

function loadRecentQueries(alias) {
    try {
        const recentQueriesText = localStorage.getItem(`${alias}-${RECENT_QUERIES_KEY}`);
        if (recentQueriesText) return JSON.parse(recentQueriesText);
    } catch (e) {
        console.error('Failed to load recent queries from localStorage', e);
    }
    return [];
}

function loadRecentApex(alias) {
    try {
        const recentApexText = localStorage.getItem(`${alias}-${RECENT_APEX_KEY}`);
        if (recentApexText) return JSON.parse(recentApexText);
    } catch (e) {
        console.error('Failed to load recent apex from localStorage', e);
    }
    return [];
}

function loadRecentPlatformEvents(alias) {
    try {
        const recentPlatformEventText = localStorage.getItem(`${alias}-${RECENT_PLATFORM_EVENT_KEY}`);
        if (recentPlatformEventText) return JSON.parse(recentPlatformEventText);
    } catch (e) {
        console.error('Failed to load recent apex from localStorage', e);
    }
    return [];
}

// APEX
const apexFileSlice = createSlice({
    name: 'apexFiles',
    initialState:apexFileAdapter.getInitialState(),
    reducers: {
        loadFromStorage: (state, action) => {
            apexFileAdapter.setAll(state,loadFromStorage(REFERENCES.APEXFILES));
        },
        upsertOne: (state, action) => {
            apexFileAdapter.upsertOne(state,formatData(action.payload));
            const entities = Object.values(state.entities);
            setInLocalStorage(REFERENCES.APEXFILES,entities);
        },
        removeOne: (state, action) => {
            apexFileAdapter.removeOne(state,action.payload);
            const entities = Object.values(state.entities);
            setInLocalStorage(REFERENCES.APEXFILES,entities);
        },
    },
});

// QUERIES
const queryFileSlice = createSlice({
    name: 'queryFiles',
    initialState:queryFileAdapter.getInitialState(),
    reducers: {
        loadFromStorage: (state, action) => {
            queryFileAdapter.setAll(state,loadFromStorage(REFERENCES.QUERYFILES));
        },
        upsertOne: (state, action) => {
            queryFileAdapter.upsertOne(state,formatData(action.payload));
            const entities = Object.values(state.entities);
            setInLocalStorage(REFERENCES.QUERYFILES,entities);
        },
        removeOne: (state, action) => {
            queryFileAdapter.removeOne(state,action.payload);
            const entities = Object.values(state.entities);
            setInLocalStorage(REFERENCES.QUERYFILES,entities);
        },
    },
});
// RECENT (Basic Arrays)
const recentSlice = createSlice({
    name: 'recents',
    initialState:{
        queries:[],
        apex:[],
        platformEvents:[]
    },
    reducers: {
        loadFromStorage: (state, action) => {
            state.queries   = loadRecentQueries(action.payload.alias);
            state.apex      = loadRecentApex(action.payload.alias);
            state.platformEvents = loadRecentPlatformEvents(action.payload.alias)
        },
        saveQuery: (state, action) => {
            const { soql, alias } = action.payload;
            const recentQueriesState = [
                soql,
                ...state.queries.filter(q => q !== soql).slice(0, MAX_RECENT - 1)
            ];
            try {
                localStorage.setItem(
                    `${alias}-${RECENT_QUERIES_KEY}`,
                    JSON.stringify(recentQueriesState)
                );
            } catch (e) {
                console.warn('Failed to save recent queries to localStorage', e);
            }
            state.queries = recentQueriesState;
        },
        saveApex: (state, action) => {
            const { body, alias } = action.payload;
            const recentApexState = [
                body,
                ...state.apex.filter(q => q !== body).slice(0, MAX_RECENT - 1)
            ];
            try {
                localStorage.setItem(
                    `${alias}-${RECENT_APEX_KEY}`,
                    JSON.stringify(recentApexState)
                );
            } catch (e) {
                console.warn('Failed to save recent apex to localStorage', e);
            }
            state.apex = recentApexState;
        },
        savePlatformEvents: (state, action) => {
            const { channel, alias } = action.payload;
            const recentPlatformEventState = [
                channel,
                ...state.platformEvents.filter(q => q !== channel).slice(0, MAX_RECENT - 1)
            ];
            try {
                localStorage.setItem(
                    `${alias}-${RECENT_PLATFORM_EVENT_KEY}`,
                    JSON.stringify(recentPlatformEventState)
                );
            } catch (e) {
                console.warn('Failed to save recent apex to localStorage', e);
            }
            state.platformEvents = recentPlatformEventState;
        },
    },
});

export const reduxSlices = {
    QUERYFILE:queryFileSlice,
    APEXFILE:apexFileSlice,
    RECENT:recentSlice
};



