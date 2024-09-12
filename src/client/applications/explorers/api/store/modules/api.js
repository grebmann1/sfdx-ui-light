import { createSlice, createAsyncThunk,createEntityAdapter } from '@reduxjs/toolkit';
import { lowerCaseKey,guid,isNotUndefinedOrNull } from 'shared/utils';

const API_SETTINGS_KEY = 'API_SETTINGS_KEY';

/** Methods */


function loadCacheSettings(alias) {
    try {
        const configText = localStorage.getItem(`${alias}-${API_SETTINGS_KEY}`);
        if (configText) return JSON.parse(configText);
    } catch (e) {
        console.error('Failed to load CONFIG from localStorage', e);
    }
    return null;
}

function saveCacheSettings(alias,state) {
    
    console.log('saveCacheSettings');
    try {
        const { 
            viewerTab
        } = state

        localStorage.setItem(
            `${alias}-${API_SETTINGS_KEY}`,
            JSON.stringify({ 
                viewerTab
            })
        );
    } catch (e) {
        console.error('Failed to save CONFIG to localstorage', e);
    }
}

/** Redux */


// Create a slice with reducers and extraReducers
const apiSlice = createSlice({
    name: 'api',
    initialState:{
        viewerTab:'Default',
    },
    reducers: {
        loadCacheSettings : (state,action) => {
            const { alias } = action.payload;
            const cachedConfig = loadCacheSettings(alias);
            if(cachedConfig){
                const { viewerTab } = cachedConfig; 
                Object.assign(state,{
                    viewerTab,
                });
            }
            console.log('#cachedConfig#',cachedConfig);
        },
        saveCacheSettings : (state,action) => {
            const { alias } = action.payload;
            if(isNotUndefinedOrNull(alias)){
                saveCacheSettings(alias,state);
            }
        },
        updateViewerTab :(state, action) => {
            const { value,alias } = action.payload;
            state.viewerTab = value;
            if(isNotUndefinedOrNull(alias)){
                saveCacheSettings(alias,state);
            }
        }
    }
});

export const reduxSlice = apiSlice;
