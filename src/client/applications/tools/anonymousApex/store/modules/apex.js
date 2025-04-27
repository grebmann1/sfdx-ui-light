import { createSlice, createAsyncThunk, createEntityAdapter } from '@reduxjs/toolkit';
import { SELECTORS, DOCUMENT } from 'core/store';
import { lowerCaseKey, guid, isNotUndefinedOrNull } from 'shared/utils';

const Schemas = {};
Schemas.ExecuteAnonymousResult = {
    compileProblem: 'string',
    compiled: 'boolean',
    line: 'number',
    column: 'number',
    exceptionMessage: 'string',
    exceptionStackTrace: 'string',
    success: 'boolean',
    // From Header
    debugLog: 'string',
};
const INFO = 'INFO';
const DEBUG = 'DEBUG';
const ANONYNMOUS_APEX_SETTINGS_KEY = 'ANONYNMOUS_APEX_SETTINGS_KEY';

const INITIAL_TABS = [enrichTab({ id: guid(), body: "System.debug('Hello the world');" }, null)];

/** Methods */

function updateCurrentTab(state, attributes) {
    const tabIndex = state.tabs.findIndex(x => x.id === state.currentTab.id);
    if (tabIndex > -1) {
        state.tabs[tabIndex].body = state.body;
        if (attributes) {
            // Extra Attributes
            Object.assign(state.tabs[tabIndex], attributes);
        }
    }
}

function formatTab({ id, name, body, isDraft, fileId, fileBody }) {
    return { id, name, body, isDraft, fileId, fileBody };
}

function enrichTabs(tabs, state, selector) {
    return tabs.map(tab => enrichTab(tab, state, selector));
}

function enrichTab(tab, state, selector) {
    const file =
        tab.fileId && selector ? selector.selectById(state, lowerCaseKey(tab.fileId)) : null;
    const fileBody = file?.content || tab.fileBody;
    return {
        ...tab,
        fileBody: fileBody,
        isDraft: fileBody != tab.body && isNotUndefinedOrNull(tab.fileId),
    };
}

function loadCacheSettings(alias) {
    try {
        const configText = localStorage.getItem(`${alias}-${ANONYNMOUS_APEX_SETTINGS_KEY}`);
        if (configText) return JSON.parse(configText);
    } catch (e) {
        console.error('Failed to load CONFIG from localStorage', e);
    }
    return null;
}

function saveCacheSettings(alias, state) {
    console.log('saveCacheSettings');
    try {
        const {
            isFilterDebugEnabled,
            recentPanelToggled,
            tabs,
            debug_db,
            debug_callout,
            debug_apexCode,
            debug_validation,
            debug_profiling,
            debug_system,
        } = state;

        localStorage.setItem(
            `${alias}-${ANONYNMOUS_APEX_SETTINGS_KEY}`,
            JSON.stringify({
                isFilterDebugEnabled,
                recentPanelToggled,
                tabs,
                debug_db,
                debug_callout,
                debug_apexCode,
                debug_validation,
                debug_profiling,
                debug_system,
            })
        );
    } catch (e) {
        console.error('Failed to save CONFIG to localstorage', e);
    }
}

/** Redux */

export const apexAdapter = createEntityAdapter();
const _executeApexAnonymous = (connector, body, headers) => {
    //console.log('connector,body,headers',connector,body,headers);
    return connector.conn.soap._invoke(
        'executeAnonymous',
        { apexcode: body },
        Schemas.ExecuteAnonymousResult,
        {
            xmlns: 'http://soap.sforce.com/2006/08/apex',
            endpointUrl: connector.conn.instanceUrl + '/services/Soap/s/' + connector.conn.version,
            headers,
        }
    );
};
const formatHeaders = state => ({
    DebuggingHeader: {
        categories: [
            {
                category: 'Apex_code',
                level: state.debug_apexCode,
            },
            {
                category: 'Callout',
                level: state.debug_callout,
            },
            {
                category: 'Validation',
                level: state.debug_validation,
            },
            {
                category: 'Db',
                level: state.debug_db,
            },
            {
                category: 'Apex_profiling',
                level: state.debug_profiling,
            },
            {
                category: 'System',
                level: state.debug_system,
            },
        ],
    },
});
export const executeApexAnonymous = createAsyncThunk(
    'apex/executeAnonymous',
    async ({ connector, body, tabId, createdDate }, { dispatch, getState }) => {
        //console.log('connector, body,tabId',connector, body,tabId);
        //const apiPath = isAllRows ? '/queryAll' : '/query';
        try {
            const res = await _executeApexAnonymous(
                connector,
                body,
                formatHeaders(getState().apex)
            );
            dispatch(
                DOCUMENT.reduxSlices.RECENT.actions.saveApex({
                    body,
                    alias: connector.conn.alias,
                })
            );
            return { data: res, body, alias: connector.conn.alias, tabId };
        } catch (err) {
            console.error(err);
            throw err;
        }
    }
);
// TODO : Add model to the state to be able to display the model in the editor instead of the body !!!!!
// Priority : 1 (for full Editor concept)
// Create a slice with reducers and extraReducers
const apexSlice = createSlice({
    name: 'apex',
    initialState: {
        debug_db: INFO,
        debug_callout: INFO,
        debug_apexCode: DEBUG,
        debug_validation: INFO,
        debug_profiling: INFO,
        debug_system: INFO,
        isFilterDebugEnabled: false,
        recentPanelToggled: false,
        apex: apexAdapter.getInitialState(),
        tabs: INITIAL_TABS,
        currentTab: INITIAL_TABS[0],
        body: null,
    },
    reducers: {
        loadCacheSettings: (state, action) => {
            const { alias, apexFiles } = action.payload;
            const cachedConfig = loadCacheSettings(alias);
            if (cachedConfig) {
                const { recentPanelToggled, tabs } = cachedConfig;
                Object.assign(state, {
                    //body:body || '',
                    recentPanelToggled,
                    tabs: enrichTabs(tabs || INITIAL_TABS, { apexFiles }),
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
        updateBody: (state, action) => {
            const { body, isDraft } = action.payload;
            state.body = body;
            updateCurrentTab(state, { isDraft });
        },
        updateRecentPanel: (state, action) => {
            const { value, alias } = action.payload;
            state.recentPanelToggled = value === true;
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        updateFilterDebug: (state, action) => {
            const { value, alias } = action.payload;
            state.isFilterDebugEnabled = value === true;
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        updateDebug: (state, action) => {
            const { key, value, alias } = action.payload;
            state[key] = value;
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        clearApexError: (state, action) => {
            const { tabId } = action.payload;
            apexAdapter.upsertOne(state, {
                id: lowerCaseKey(tabId),
                error: null,
            });
        },
        initTabs: (state, action) => {
            const { apexFiles } = action.payload;
            state.tabs = enrichTabs(state.tabs.map(formatTab), { apexFiles }, SELECTORS.apexFiles);
            // Set first tab
            if (state.tabs.length > 0) {
                state.currentTab = state.tabs[0];
                state.currentFileId = state.tabs[0].fileId;
                state.body = state.tabs[0].body;
            }
        },
        addTab: (state, action) => {
            const { apexFiles, tab } = action.payload;
            const enrichedTab = enrichTab(formatTab(tab), { apexFiles }, SELECTORS.apexFiles);
            state.tabs.push(enrichedTab);
            // Assign new tab
            state.currentTab = enrichedTab;
            state.currentFileId = enrichedTab.fileId;
            state.body = enrichedTab.body;
        },
        removeTab: (state, action) => {
            const { id, alias } = action.payload;
            state.tabs = state.tabs.filter(x => x.id != id);
            // Assign last tab
            if (state.tabs.length > 0 && state.currentTab.id == id) {
                const lastTab = state.tabs[state.tabs.length - 1];
                state.currentTab = lastTab;
                state.body = lastTab.body;
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
                state.body = tab.body;
            }
        },
        linkFileToTab: (state, action) => {
            const { fileId, alias, apexFiles } = action.payload;
            const currentTabIndex = state.tabs.findIndex(x => x.id == state.currentTab.id);
            if (currentTabIndex > -1) {
                const enrichedTab = enrichTab(
                    formatTab({ ...state.tabs[currentTabIndex], fileId }),
                    { apexFiles },
                    SELECTORS.apexFiles
                );
                state.tabs[currentTabIndex] = enrichedTab;
                state.currentTab = enrichedTab;
                if (isNotUndefinedOrNull(alias)) {
                    saveCacheSettings(alias, state);
                }
            }
        },
    },
    extraReducers: builder => {
        builder
            .addCase(executeApexAnonymous.pending, (state, action) => {
                const { tabId, createdDate } = action.meta.arg;
                apexAdapter.upsertOne(state.apex, {
                    id: lowerCaseKey(tabId),
                    data: null,
                    createdDate,
                    isFetching: true,
                    error: null,
                });
            })
            .addCase(executeApexAnonymous.fulfilled, (state, action) => {
                const { data, body } = action.payload;
                const { tabId, createdDate } = action.meta.arg;
                apexAdapter.upsertOne(state.apex, {
                    id: lowerCaseKey(tabId),
                    data,
                    body,
                    isFetching: false,
                    createdDate,
                    error: null,
                });
            })
            .addCase(executeApexAnonymous.rejected, (state, action) => {
                const { error } = action;
                const { tabId } = action.meta.arg;
                apexAdapter.upsertOne(state.apex, {
                    id: lowerCaseKey(tabId),
                    isFetching: false,
                    error,
                });
            });
    },
});

export const reduxSlice = apexSlice;
