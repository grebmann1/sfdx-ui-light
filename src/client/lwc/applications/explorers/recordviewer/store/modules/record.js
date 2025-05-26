import { createSlice, createAsyncThunk, createEntityAdapter } from '@reduxjs/toolkit';
import { SELECTORS, DOCUMENT } from 'core/store';
import { lowerCaseKey, guid, isNotUndefinedOrNull } from 'shared/utils';

const RECORDVIEWER_SETTINGS_KEY = 'RECORDVIEWER_SETTINGS_KEY';

function loadCacheSettings(alias) {
    try {
        const configText = localStorage.getItem(`${alias}-${RECORDVIEWER_SETTINGS_KEY}`);
        if (configText) return JSON.parse(configText);
    } catch (e) {
        console.error('Failed to load CONFIG from localStorage', e);
    }
    return null;
}

function saveCacheSettings(alias, state) {
    console.log('saveCacheSettings');
    try {
        const { tabs, recentPanelToggled } = state;

        localStorage.setItem(
            `${alias}-${RECORDVIEWER_SETTINGS_KEY}`,
            JSON.stringify({
                tabs,
                recentPanelToggled,
            })
        );
    } catch (e) {
        console.error('Failed to save CONFIG to localstorage', e);
    }
}

export const formatTab = payload => {
    const validParams = ['id', 'refreshedDate', 'record', 'recordType'];
    const tab = {};
    validParams.forEach(key => {
        if (key in payload && payload[key] !== undefined) {
            tab[key] = payload[key];
        }
    });
    return tab;
};

// Create a slice with reducers and extraReducers
const recordViewerSlice = createSlice({
    name: 'recordViewer',
    initialState: {
        tabs: [],
        currentTab: null,
        recentPanelToggled: false,
    },
    reducers: {
        loadCacheSettings: (state, action) => {
            const { alias } = action.payload;
            const cachedConfig = loadCacheSettings(alias);
            if (cachedConfig) {
                const { tabs, recentPanelToggled } = cachedConfig;
                Object.assign(state, {
                    tabs,
                    recentPanelToggled,
                });
            }
            console.log('#cachedConfig#', cachedConfig);
        },
        saveCacheSettings: (state, action) => {
            const { alias } = action.payload;
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        updateRecentPanel: (state, action) => {
            const { value, alias } = action.payload;
            state.recentPanelToggled = value === true;
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        upsertTab: (state, action) => {
            const { tab } = action.payload;
            const indexTab = state.tabs.findIndex(x => x.id === tab.id);
            if (indexTab < 0) {
                state.tabs.push(tab);
                // Assign new tab
                state.currentTab = tab;
            } else {
                const originalTab = state.tabs.find(x => x.id === tab.id);
                const newTab = Object.assign(originalTab, tab);
                state.tabs[indexTab] = newTab;
                state.currentTab = newTab;
            }
        },
        removeTab: (state, action) => {
            const { id, alias } = action.payload;
            state.tabs = state.tabs.filter(x => x.id != id);
            // Assign last tab
            if (state.tabs.length > 0 && state.currentTab.id == id) {
                const lastTab = state.tabs[state.tabs.length - 1];
                state.currentTab = lastTab;
            }
            if (state.tabs.length == 0) {
                state.currentTab = null;
            }

            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
            // can't remove the last one !!!
        },
        selectionTab: (state, action) => {
            const { id } = action.payload;
            const tab = state.tabs.find(x => x.id == id);
            // Assign new tab
            if (tab) {
                state.currentTab = tab;
            }
        },
    },
    extraReducers: builder => {},
});

export const reduxSlice = recordViewerSlice;
