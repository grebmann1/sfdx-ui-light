import { createSlice,createAsyncThunk,createEntityAdapter } from '@reduxjs/toolkit';
import { lowerCaseKey,guid,isUndefinedOrNull } from 'shared/utils';


// Adapters
export const queryFileAdapter = createEntityAdapter();
export const queryRecentAdapter = createEntityAdapter();

const REFERENCES = {
    QUERYFILES:'QUERYFILES',
    RECENT:'RECENTS'
}
const MAX_RECENT = 20;
const RECENT_QUERIES_KEY = 'lsb.recentQueries';

function setInLocalStorage(referenceKey,entities) {
    try {
        localStorage.setItem(referenceKey,JSON.stringify(entities));
    } catch (e) {
        console.warn(`Failed to save ${referenceKey} to localstorage`, e);
    }
}

function loadFromStorage(referenceKey) {
    try {
        const itemText = localStorage.getItem(referenceKey);
        if (itemText) return JSON.parse(itemText);
    } catch (e) {
        console.warn(`Failed to load ${referenceKey} from localstorage`, e);
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
        console.warn('Failed to load recent queries from localStorage', e);
    }
    return [];
}


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
        queries:[]
    },
    reducers: {
        loadFromStorage: (state, action) => {
            state.queries = loadRecentQueries(action.payload.alias)
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
        }
    },
});

export const reduxSlices = {
    QUERYFILE:queryFileSlice,
    RECENT:recentSlice
};



