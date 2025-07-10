import { createSlice } from '@reduxjs/toolkit';
import { ERROR, store } from 'core/store';
import { isNotUndefinedOrNull } from 'shared/utils';

const SOBJECTEXPLORER_SETTINGS_KEY = 'SOBJECTEXPLORER_SETTINGS_KEY';

function loadCacheSettings(alias) {
    try {
        const configText = localStorage.getItem(`${alias}-${SOBJECTEXPLORER_SETTINGS_KEY}`);
        if (configText) return JSON.parse(configText);
    } catch (e) {
        console.error('Failed to load CONFIG from localStorage', e);
        store.dispatch(
            ERROR.reduxSlice.actions.addError({
                message: 'Failed to load CONFIG from localStorage',
                details: e.message,
            })
        );
    }
    return null;
}

function saveCacheSettings(alias, state) {
    try {
        const { tabs } = state;
        localStorage.setItem(
            `${alias}-${SOBJECTEXPLORER_SETTINGS_KEY}`,
            JSON.stringify({
                tabs,
            })
        );
    } catch (e) {
        console.error('Failed to save CONFIG to localstorage', e);
        store.dispatch(
            ERROR.reduxSlice.actions.addError({
                message: 'Failed to save CONFIG to localstorage',
                details: e.message,
            })
        );
    }
}

export const formatTab = payload => {
    const validParams = ['id', 'label', 'details'];
    const tab = {};
    validParams.forEach(key => {
        if (key in payload && payload[key] !== undefined) {
            tab[key] = payload[key];
        }
    });
    return tab;
};

const sobjectExplorerSlice = createSlice({
    name: 'sobjectExplorer',
    initialState: {
        tabs: [],
        currentTab: null,
    },
    reducers: {
        loadCacheSettings: (state, action) => {
            const { alias } = action.payload;
            const cachedConfig = loadCacheSettings(alias);
            if (cachedConfig) {
                const { tabs } = cachedConfig;
                Object.assign(state, { tabs });
            }
        },
        saveCacheSettings: (state, action) => {
            const { alias } = action.payload;
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        upsertTab: (state, action) => {
            const { tab } = action.payload;
            const indexTab = state.tabs.findIndex(x => x.id === tab.id);
            if (indexTab < 0) {
                state.tabs.push(tab);
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
        },
        selectTab: (state, action) => {
            const { id } = action.payload;
            const tab = state.tabs.find(x => x.id == id);
            if (tab) {
                state.currentTab = tab;
            }
        },
    },
    extraReducers: builder => {},
});

export const reduxSlice = sobjectExplorerSlice; 