import { createSlice, createAsyncThunk, createEntityAdapter } from '@reduxjs/toolkit';
import { DEFAULT, generateDefaultTab, formattedContentType } from 'api/utils';
import { SELECTORS, DOCUMENT } from 'core/store';
import { cacheManager,loadExtensionConfigFromCache,saveExtensionConfigToCache } from 'shared/cacheManager';
import {
    lowerCaseKey,
    guid,
    isNotUndefinedOrNull,
    isUndefinedOrNull,
    isChromeExtension,
} from 'shared/utils';
import LOGGER from 'shared/logger';
const API_SETTINGS_KEY = 'API_SETTINGS_KEY';

/** Methods */

export async function loadCacheSettings(alias) {
    const key = `${alias}-${API_SETTINGS_KEY}`;
    const configMap = await loadExtensionConfigFromCache([key]);
    const configText = configMap?configMap[key]:null;
    const cachedConfig = configText?JSON.parse(configText):null;
    return cachedConfig;
}

async function saveCacheSettings(alias, state) {
    const { viewerTab, recentPanelToggled, tabs } = state;
    const key = `${alias}-${API_SETTINGS_KEY}`;
    const data = JSON.stringify({ viewerTab, recentPanelToggled, tabs:tabs.map(formatTabBeforeSave) });
    await saveExtensionConfigToCache({ [key]: data });
}

function formatTabBeforeSave(tab){
    return {
        ...tab,
        actions: [], // to avoid too many actions in the cache
        actionPointer: 0,
    };
}

function formatTab({
    id,
    name,
    header,
    body,
    method,
    endpoint,
    isDraft,
    fileId,
    fileData,
    actions,
    actionPointer,
}) {
    return {
        id,
        name,
        header,
        body,
        method,
        endpoint,
        isDraft,
        fileId,
        fileData,
        actions,
        actionPointer,
    };
}

function enrichTabs(tabs, state, selector) {
    return tabs.map(tab => enrichTab(tab, state, selector));
}

function enrichTab(tab, state, selector) {
    const file = tab.fileId && selector ? selector.selectById(state, lowerCaseKey(tab.fileId)) : null;
    //const { header,body,method,endpoint } = file;
    const fileData = file?.extra || {};
    return {
        ...tab,
        isDraft:
            (fileData.body != tab.body ||
                fileData.header != tab.header ||
                fileData.method != tab.method ||
                fileData.endpoint != tab.endpoint) &&
            isNotUndefinedOrNull(tab.fileId),
    };
}

function assignNewApiData(item, value) {
    Object.assign(item, {
        header: value.header,
        method: value.method,
        endpoint: value.endpoint,
        body: value.body,
        actions: value.actions,
        actionPointer: value.actionPointer,
    });
}

function addAction({ state, tabId, request, response }) {
    LOGGER.log('addAction',{ state, tabId, request, response });
    const tabIndex = state.tabs.findIndex(x => x.id === tabId);
    if (tabIndex > -1) {
        let actions = state.tabs[tabIndex].actions || [];
        let actionPointer = state.tabs[tabIndex].actionPointer || 0;

        if (actions.length > 0 && actionPointer != actions.length - 1) {
            actions = actions.slice(0, actionPointer + 1);
        }
        actions.push({ request, response });
        Object.assign(state.tabs[tabIndex], {
            actions,
            actionPointer: actions.length - 1,
        });
        assignNewApiData(state, state.tabs[tabIndex]);
    }
}

export const apiAdapter = createEntityAdapter();
const _executeApiRequest = (connector, request, formattedRequest) => {
    //console.log('connector,body,headers',connector,body,headers);
    return new Promise((resolve, reject) => {
        try {
            const executionStartDate = new Date();
            const instance = connector.conn.httpApi();
            instance.on('response', async res => {
                // Set Response variables
                let content = res.body;
                let statusCode = res.statusCode;
                let _headers = res.headers || {};
                let contentHeaders = Object.keys(_headers).map(key => ({
                    key,
                    value: _headers[key],
                }));
                let contentType = instance.getResponseContentType(res);
                if (formattedContentType(contentType) !== 'xml') {
                    content = await instance.getResponseBody(res);
                }

                let contentLength = new TextEncoder().encode(JSON.stringify(content)).length;

                const result = {
                    content,
                    statusCode,
                    contentHeaders,
                    contentType,
                    contentLength,
                    executionEndDate: Date.now(),
                    executionStartDate,
                };
                resolve(result);
            });

            // Execute the request
            instance.request(formattedRequest);
        } catch (e) {
            console.error(e);
            reject(e);
        }
    });
};

export const executeApiRequest = createAsyncThunk(
    'api/callRequest',
    async (
        { connector, request, formattedRequest, tabId, createdDate },
        { dispatch, getState }
    ) => {
        //console.log('connector, body,tabId',connector, body,tabId);
        //const apiPath = isAllRows ? '/queryAll' : '/query';
        try {
            const response = await _executeApiRequest(connector, request, formattedRequest);
            // Add to Recent Panel :
            dispatch(
                DOCUMENT.reduxSlices.RECENT.actions.saveApi({
                    item: request,
                    alias: connector.conn.alias,
                })
            );

            return {
                response,
                request,
                alias: connector.conn.alias,
                tabId,
            };
        } catch (err) {
            console.error(err);
            throw err;
        }
    }
);

const createInitialTabs = apiVersion => {
    return [enrichTab(generateDefaultTab(apiVersion), null)];
};

// Create a slice with reducers and extraReducers
const apiSlice = createSlice({
    name: 'api',
    initialState: {
        viewerTab: 'Default',
        recentPanelToggled: false,
        tabs: [],
        currentTab: null,
        api: apiAdapter.getInitialState(),
        body: null,
        method: null,
        endpoint: null,
        header: null,
        currentApiVersion: '59.0',
        abortingMap: {},
        isInitialized: false,
    },
    reducers: {
        loadCacheSettings: (state, action) => {
            const { cachedConfig, apiFiles } = action.payload;
            if (cachedConfig && !state.isInitialized) {
                // Use cached config
                const { viewerTab, recentPanelToggled, tabs } = cachedConfig;
                const cachedTabs = tabs && tabs.length > 0 ? enrichTabs(tabs, { apiFiles },SELECTORS.apiFiles) : [];
                const allTabs = [...cachedTabs, ...state.tabs];
                Object.assign(state, {
                    viewerTab,
                    recentPanelToggled,
                    tabs: allTabs,
                    currentTab: allTabs.length > 0 ? allTabs[allTabs.length-1] : null,
                });
            }
            state.isInitialized = true;
        },
        saveCacheSettings: (state, action) => {
            const { alias } = action.payload;
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        updateViewerTab: (state, action) => {
            const { value, alias } = action.payload;
            state.viewerTab = value;
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        updateRequest: (state, action) => {
            const { header, method, endpoint, body, tabId, isDraft } = action.payload;
            const tabIndex = state.tabs.findIndex(x => x.id === tabId);
            // Reset Tab
            if (tabIndex > -1) {
                Object.assign(state.tabs[tabIndex], {
                    header,
                    method,
                    endpoint,
                    body,
                    isDraft,
                });
                assignNewApiData(state, state.tabs[tabIndex]);
                state.currentTab = state.tabs[tabIndex];
            }
        },
        updateCurrentApiVersion: (state, action) => {
            const { version } = action.payload;
            state.currentApiVersion = version || DEFAULT_API_VERSION;
        },
        updateRecentPanel: (state, action) => {
            const { value, alias } = action.payload;
            state.recentPanelToggled = value === true;
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        initTabs: (state, action) => {
            const { apiFiles,reset } = action.payload;
            if(reset || !state.tabs || state.tabs.length === 0){
                state.tabs = enrichTabs(createInitialTabs(state.currentApiVersion), { apiFiles }, SELECTORS.apiFiles);
            }else{
                state.tabs = enrichTabs(state.tabs.map(formatTab), { apiFiles }, SELECTORS.apiFiles);
            }
            // Set first tab
            if (state.tabs.length > 0) {
                const lastTabIndex = state.tabs.length - 1;
                state.currentTab = state.tabs[lastTabIndex];
                state.currentFileId = state.tabs[lastTabIndex].fileId;
                assignNewApiData(state, state.tabs[lastTabIndex]);
            }
        },
        resetTab: (state, action) => {
            const { tabId } = action.payload;
            const tabIndex = state.tabs.findIndex(x => x.id === tabId);
            // Reset Tab
            if (tabIndex > -1) {
                let enrichedTab;
                // if we reset on a tab with a file, then we reload the file.
                if (state.tabs[tabIndex].currentFileId) {
                    enrichedTab = enrichTab(
                        formatTab({ ...state.tabs[tabIndex], fileId }),
                        { apiFiles },
                        SELECTORS.apiFiles
                    );
                } else {
                    enrichedTab = enrichTab(generateDefaultTab(state.currentApiVersion), null);
                }
                state.tabs[tabIndex] = enrichedTab;
                state.currentTab = enrichedTab;
                assignNewApiData(state, enrichedTab);
            }
        },
        addTab: (state, action) => {
            const { apiFiles, tab } = action.payload;
            const enrichedTab = enrichTab(formatTab(tab), { apiFiles }, SELECTORS.apiFiles);
            state.tabs.push(enrichedTab);
            // Assign new tab
            state.currentTab = enrichedTab;
            state.currentFileId = enrichedTab.fileId;
            assignNewApiData(state, enrichedTab);
        },
        removeTab: (state, action) => {
            const { id, alias } = action.payload;
            state.tabs = state.tabs.filter(x => x.id != id);
            // Assign last tab
            if (state.tabs.length > 0 && state.currentTab.id == id) {
                const lastTab = state.tabs[state.tabs.length - 1];
                state.currentTab = lastTab;
                assignNewApiData(state, lastTab);
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
                assignNewApiData(state, tab);
            }
        },
        linkFileToTab: (state, action) => {
            const { fileId, alias, apiFiles } = action.payload;
            const currentTabIndex = state.tabs.findIndex(x => x.id == state.currentTab.id);
            if (currentTabIndex > -1) {
                const enrichedTab = enrichTab(
                    formatTab({ ...state.tabs[currentTabIndex], fileId }),
                    { apiFiles },
                    SELECTORS.apiFiles
                );
                state.tabs[currentTabIndex] = enrichedTab;
                state.currentTab = enrichedTab;
                assignNewApiData(state, enrichedTab);
                if (isNotUndefinedOrNull(alias)) {
                    saveCacheSettings(alias, state);
                }
            }
        },
        increaseActionPointer: (state, action) => {
            const { tabId } = action.payload;
            const tabIndex = state.tabs.findIndex(x => x.id === tabId);
            if (tabIndex > -1) {
                let actions = state.tabs[tabIndex].actions;
                let actionPointer = state.tabs[tabIndex].actionPointer;

                if (actions.length - 1 <= actionPointer) {
                    actionPointer = actions.length - 1;
                } else {
                    actionPointer = actionPointer + 1;
                }
                Object.assign(state.tabs[tabIndex], {
                    actionPointer,
                });
                assignNewApiData(state, state.tabs[tabIndex]);
            }
        },
        decreaseActionPointer: (state, action) => {
            const { tabId } = action.payload;
            const tabIndex = state.tabs.findIndex(x => x.id === tabId);
            if (tabIndex > -1) {
                //let actions = state.tabs[tabIndex].actions;
                let actionPointer = state.tabs[tabIndex].actionPointer;

                if (actionPointer <= 0) {
                    actionPointer = 0;
                } else {
                    actionPointer = actionPointer - 1;
                }
                Object.assign(state.tabs[tabIndex], {
                    actionPointer,
                });
                assignNewApiData(state, state.tabs[tabIndex]);
            }
        },
        setAbortingPromise: (state, action) => {
            const { tabId, promise } = action.payload;
            state.abortingMap = {
                ...state.abortingMap,
                [tabId]: promise,
            };
        },
        resetAbortingPromise: (state, action) => {
            const { tabId } = action.payload;
            state.abortingMap = {
                ...state.abortingMap,
                [tabId]: null,
            };
        },
        clearAbortingMap: (state) => {
            state.abortingMap = {};
        },
    },
    extraReducers: builder => {
        builder
            .addCase(executeApiRequest.pending, (state, action) => {
                const { tabId, createdDate } = action.meta.arg;
                apiAdapter.upsertOne(state.api, {
                    id: lowerCaseKey(tabId),
                    response: null,
                    createdDate,
                    isFetching: true,
                    error: null,
                });
            })
            .addCase(executeApiRequest.fulfilled, (state, action) => {
                const { response, request } = action.payload;
                const { tabId, createdDate } = action.meta.arg;
                state.abortingMap = {
                    ...state.abortingMap,
                    [tabId]: null,
                };
                apiAdapter.upsertOne(state.api, {
                    id: lowerCaseKey(tabId),
                    response,
                    request,
                    isFetching: false,
                    createdDate,
                    error: null,
                });
                addAction({ state, tabId, request, response });
            })
            .addCase(executeApiRequest.rejected, (state, action) => {
                const { error } = action;
                const { tabId } = action.meta.arg;
                state.abortingMap = {
                    ...state.abortingMap,
                    [tabId]: null,
                };
                apiAdapter.upsertOne(state.api, {
                    id: lowerCaseKey(tabId),
                    isFetching: false,
                    error,
                });
            });
    },
});

export const reduxSlice = apiSlice;
