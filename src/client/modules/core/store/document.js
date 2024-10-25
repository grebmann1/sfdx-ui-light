import { createSlice,createAsyncThunk,createEntityAdapter } from '@reduxjs/toolkit';
import { lowerCaseKey,guid,isUndefinedOrNull } from 'shared/utils';


// Adapters
export const queryFileAdapter = createEntityAdapter();
export const apexFileAdapter = createEntityAdapter();
export const apiFileAdapter = createEntityAdapter();
export const platformEventFileAdapter = createEntityAdapter();


const REFERENCES = {
    QUERYFILES:'QUERYFILES',
    APIFILES:'APIFILES',
    APEXFILES:'APEXFILES',
    RECENT:'RECENTS'
}
const MAX_RECENT = 20;
const RECENT_QUERIES_KEY = 'lsb.recentQueries';
const RECENT_APEX_KEY = 'lsb.recentApex';
const RECENT_API_KEY = 'lsb.recentApi';
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

function loadRecent(key){
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

// API
const apiFileSlice = createSlice({
    name: 'apiFiles',
    initialState:apiFileAdapter.getInitialState(),
    reducers: {
        loadFromStorage: (state, action) => {
            apiFileAdapter.setAll(state,loadFromStorage(REFERENCES.APIFILES));
        },
        upsertOne: (state, action) => {
            apiFileAdapter.upsertOne(state,formatData(action.payload));
            const entities = Object.values(state.entities);
            setInLocalStorage(REFERENCES.APIFILES,entities);
        },
        removeOne: (state, action) => {
            apiFileAdapter.removeOne(state,action.payload);
            const entities = Object.values(state.entities);
            setInLocalStorage(REFERENCES.APIFILES,entities);
        },
    },
});

function saveItem(key,value){
    try {
        localStorage.setItem(key,value);
    } catch (e) {
        console.warn(`Failed to save "${key}" to localStorage`, e);
    }
}
// RECENT (Basic Arrays)
const recentSlice = createSlice({
    name: 'recents',
    initialState:{
        queries:[],
        apex:[],
        platformEvents:[],
        api:[]
    },
    reducers: {
        loadFromStorage: (state, action) => {
            state.queries   = loadRecent(`${action.payload.alias}-${RECENT_QUERIES_KEY}`);
            state.apex      = loadRecent(`${action.payload.alias}-${RECENT_APEX_KEY}`);
            state.api       = loadRecent(`${action.payload.alias}-${RECENT_API_KEY}`);
            state.platformEvents = loadRecent(`${action.payload.alias}-${RECENT_PLATFORM_EVENT_KEY}`);
        },
        saveQuery: (state, action) => {
            const { soql, alias } = action.payload;
            const recentQueriesState = [
                soql,
                ...state.queries.filter(q => q !== soql).slice(0, MAX_RECENT - 1)
            ];
            saveItem(
                `${alias}-${RECENT_QUERIES_KEY}`,
                JSON.stringify(recentQueriesState)
            );
            state.queries = recentQueriesState;
        },
        saveApex: (state, action) => {
            const { body, alias } = action.payload;
            const recentApexState = [
                body,
                ...state.apex.filter(q => q !== body).slice(0, MAX_RECENT - 1)
            ];
            saveItem(
                `${alias}-${RECENT_APEX_KEY}`,
                JSON.stringify(recentApexState)
            );
            state.apex = recentApexState;
        },
        saveApi: (state, action) => {
            console.log('state.api',state.api);
            // item = body, url and header
            const { item, alias } = action.payload;
            const recentApiState = [
                item,
                ...state.api.filter(q => 
                    q.method !== item.method || q.endpoint !== item.endpoint 
                ).slice(0, MAX_RECENT - 1)
            ];
            saveItem(
                `${alias}-${RECENT_API_KEY}`,
                JSON.stringify(recentApiState)
            );
            state.api = recentApiState;
        },
        savePlatformEvents: (state, action) => {
            const { channel, alias } = action.payload;
            const recentPlatformEventState = [
                channel,
                ...state.platformEvents.filter(q => q !== channel).slice(0, MAX_RECENT - 1)
            ];
            saveItem(
                `${alias}-${RECENT_PLATFORM_EVENT_KEY}`,
                JSON.stringify(recentPlatformEventState)
            );
            state.platformEvents = recentPlatformEventState;
        },
    },
});

export const reduxSlices = {
    QUERYFILE:queryFileSlice,
    APEXFILE:apexFileSlice,
    APIFILE:apiFileSlice,
    RECENT:recentSlice
};



