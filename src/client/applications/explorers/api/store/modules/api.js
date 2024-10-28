import { createSlice, createAsyncThunk,createEntityAdapter } from '@reduxjs/toolkit';
import { lowerCaseKey,guid,isNotUndefinedOrNull,isUndefinedOrNull } from 'shared/utils';
import { DEFAULT, generateDefaultTab,formattedContentType } from 'api/utils';
import { SELECTORS,DOCUMENT } from 'core/store';

const API_SETTINGS_KEY = 'API_SETTINGS_KEY';
const DEFAULT_API_VERSION = '60.0';
const INITIAL_TABS = [
    enrichTab(
        generateDefaultTab(DEFAULT_API_VERSION),
        null
    )
];

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
    try {
        const { 
            viewerTab,recentPanelToggled,tabs
        } = state

        localStorage.setItem(
            `${alias}-${API_SETTINGS_KEY}`,
            JSON.stringify({ 
                viewerTab,recentPanelToggled,tabs
            })
        );
    } catch (e) {
        console.error('Failed to save CONFIG to localstorage', e);
    }
}


function formatTab({id,name,header,body,method,endpoint,isDraft,fileId,fileData,actions,actionPointer}){
    return {id,name,header,body,method,endpoint,isDraft,fileId,fileData,actions,actionPointer};
}

function enrichTabs(tabs,state,selector){
    return tabs.map(tab => enrichTab(tab,state,selector))
}

function enrichTab(tab,state,selector){
    const file = tab.fileId && selector?selector.selectById(state,lowerCaseKey(tab.fileId)):null;
    //const { header,body,method,endpoint } = file;
    const fileData = file?.extra || {};
    return {
        ...tab,
        isDraft:(
            fileData.body != tab.body || 
            fileData.header != tab.header || 
            fileData.method != tab.method || 
            fileData.endpoint != tab.endpoint
        ) && isNotUndefinedOrNull(tab.fileId)
    }
}

function assignNewApiData(item,value){
    Object.assign(item,{
        header:value.header,
        method:value.method,
        endpoint:value.endpoint,
        body:value.body,
        actions:value.actions,
        actionPointer:value.actionPointer
    });
}

function addAction({state,tabId,request,response}){
    const tabIndex = state.tabs.findIndex(x => x.id === tabId);
    if(tabIndex > -1 ){
        let actions = state.tabs[tabIndex].actions || [];
        let actionPointer = state.tabs[tabIndex].actionPointer || 0;

        if(actions.length > 0 && actionPointer != actions.length - 1){
            actions = actions.slice(0,actionPointer + 1)
        }
        actions.push({request,response});
        Object.assign(state.tabs[tabIndex],{
            actions,
            actionPointer:actions.length - 1
        });
        assignNewApiData(state,state.tabs[tabIndex]);
    }
}

export const apiAdapter = createEntityAdapter();
const _executeApiRequest = (connector,request,formattedRequest) => {
    //console.log('connector,body,headers',connector,body,headers);
    return new Promise((resolve,reject) => {
        try{

            const executionStartDate = new Date();
            const instance = connector.conn.httpApi();
                instance.on('response', async (res) => {
                    
                    // Set Response variables
                    let content = res.body;
                    let statusCode = res.statusCode;
                    let _headers = res.headers || {};
                    let contentHeaders = Object.keys(_headers).map(key => ({key,value:_headers[key]}));
                    let contentType = instance.getResponseContentType(res);
                    if(formattedContentType(contentType) !== 'xml'){
                        content = await instance.getResponseBody(res);
                    }

                    const result = {
                        content,
                        statusCode,
                        contentHeaders,
                        contentType,
                        executionEndDate:new Date(),
                        executionStartDate
                    };
                    resolve(result);
                });

            // Execute the request
            instance.request(formattedRequest);
        }catch(e){
            console.error(e);
            reject(e);
        }
    })
}

export const executeApiRequest = createAsyncThunk(
    'api/callRequest',
    async ({ connector,request,formattedRequest,tabId,createdDate}, { dispatch,getState }) => {
        //console.log('connector, body,tabId',connector, body,tabId);
        //const apiPath = isAllRows ? '/queryAll' : '/query';
        try {
            const response = await _executeApiRequest(connector,request,formattedRequest);
            // Add to Recent Panel :
            dispatch(DOCUMENT.reduxSlices.RECENT.actions.saveApi({
                item:request, 
                alias:connector.conn.alias,
            }));
            

            return { 
                response,
                request,
                alias: connector.conn.alias,
                tabId
            };
        } catch (err) {
            console.error(err);
            throw err;
        }
    }
);

// Create a slice with reducers and extraReducers
const apiSlice = createSlice({
    name: 'api',
    initialState:{
        viewerTab:'Default',
        recentPanelToggled:false,
        tabs:INITIAL_TABS,
        currentTab:INITIAL_TABS[0],
        api:apiAdapter.getInitialState(),
        body:null,
        method:null,
        endpoint:null,
        header:null,
        currentApiVersion:DEFAULT_API_VERSION
    },
    reducers: {
        loadCacheSettings : (state,action) => {
            const { alias,apiFiles } = action.payload;
            const cachedConfig = loadCacheSettings(alias);
            if(cachedConfig){
                const { viewerTab,recentPanelToggled,tabs } = cachedConfig; 
                Object.assign(state,{
                    viewerTab,
                    recentPanelToggled,
                    tabs:enrichTabs(tabs || INITIAL_TABS,{apiFiles})
                });
            }
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
        },
        updateRequest : (state, action) => {
            const { header,method,endpoint,body,tabId,isDraft } = action.payload;
            const tabIndex = state.tabs.findIndex(x => x.id === tabId);
            // Reset Tab
            if(tabIndex > -1 ){
                Object.assign(
                    state.tabs[tabIndex],
                    {
                        header,method,endpoint,body,
                        isDraft
                    }
                );
                assignNewApiData(state,state.tabs[tabIndex]);
                state.currentTab = state.tabs[tabIndex];
            }
            
        },
        updateCurrentApiVersion :(state, action) => {
            const { version } = action.payload;
            state.currentApiVersion = version || DEFAULT_API_VERSION;
        },
        updateRecentPanel :(state, action) => {
            const { value,alias } = action.payload;
            state.recentPanelToggled = value === true;
            if(isNotUndefinedOrNull(alias)){
                saveCacheSettings(alias,state);
            }
        },
        initTabs:(state,action) => {
            const { apiFiles } = action.payload;
            state.tabs = enrichTabs(state.tabs.map(formatTab),{apiFiles},SELECTORS.apiFiles);
            // Set first tab
            if(state.tabs.length > 0){
                state.currentTab = state.tabs[0];
                state.currentFileId = state.tabs[0].fileId;
                assignNewApiData(state,state.tabs[0]);
            }
        },
        resetTab:(state,action) => {
            const { tabId } = action.payload;
            const tabIndex = state.tabs.findIndex(x => x.id === tabId);
            // Reset Tab
            if(tabIndex > -1 ){
                let enrichedTab;
                // if we reset on a tab with a file, then we reload the file.
                if(state.tabs[tabIndex].currentFileId){
                    enrichedTab = enrichTab(
                        formatTab({...state.tabs[tabIndex],fileId}),{apiFiles},SELECTORS.apiFiles
                    );
                }else{
                    enrichedTab = enrichTab(generateDefaultTab(state.currentApiVersion),null);
                }
                state.tabs[tabIndex] = enrichedTab;
                state.currentTab = enrichedTab;
                assignNewApiData(state,enrichedTab);
            }
        },
        addTab:(state,action) => {
            const { apiFiles,tab } = action.payload;
            const enrichedTab = enrichTab(formatTab(tab),{apiFiles},SELECTORS.apiFiles);
            state.tabs.push(enrichedTab);
            // Assign new tab
            state.currentTab = enrichedTab;
            state.currentFileId = enrichedTab.fileId;
            assignNewApiData(state,enrichedTab);
        },
        removeTab:(state,action) => {
            const { id,alias } = action.payload;
            state.tabs = state.tabs.filter(x => x.id != id);
            // Assign last tab
            if(state.tabs.length > 0 && state.currentTab.id == id){
                const lastTab = state.tabs[state.tabs.length - 1];
                state.currentTab = lastTab;
                assignNewApiData(state,lastTab);
            }
            if(isNotUndefinedOrNull(alias)){
                saveCacheSettings(alias,state);
            }
            // can't remove the last one !!!
        },
        selectionTab:(state,action) => {
            const { id } = action.payload;
            const tab = state.tabs.find(x => x.id == id);
            // Assign new tab
            if(tab){
                state.currentTab = tab;
                assignNewApiData(state,tab);
            }
        },
        linkFileToTab:(state,action) => {
            const { fileId,alias,apiFiles } = action.payload;
            const currentTabIndex = state.tabs.findIndex(x => x.id == state.currentTab.id);
            if(currentTabIndex > -1){
                const enrichedTab = enrichTab(
                    formatTab({...state.tabs[currentTabIndex],fileId}),{apiFiles},SELECTORS.apiFiles
                );
                state.tabs[currentTabIndex] = enrichedTab
                state.currentTab = enrichedTab;
                assignNewApiData(state,enrichedTab);
                if(isNotUndefinedOrNull(alias)){
                    saveCacheSettings(alias,state);
                }
            }
        },
        increaseActionPointer:(state,action) => {
            const { tabId } = action.payload;
            const tabIndex = state.tabs.findIndex(x => x.id === tabId);
            if(tabIndex > -1 ){
                let actions = state.tabs[tabIndex].actions;
                let actionPointer = state.tabs[tabIndex].actionPointer;

                if(actions.length - 1 <= actionPointer){
                    actionPointer = actions.length - 1;
                }else{
                    actionPointer = actionPointer + 1;
                }
                Object.assign(state.tabs[tabIndex],{
                    actionPointer
                });
                assignNewApiData(state,state.tabs[tabIndex])
            }
        },
        decreaseActionPointer:(state,action) => {
            const { tabId } = action.payload;
            const tabIndex = state.tabs.findIndex(x => x.id === tabId);
            if(tabIndex > -1 ){
                //let actions = state.tabs[tabIndex].actions;
                let actionPointer = state.tabs[tabIndex].actionPointer;

                if(actionPointer <= 0){
                    actionPointer = 0;
                }else{
                    actionPointer = actionPointer - 1;
                }
                Object.assign(state.tabs[tabIndex],{
                    actionPointer
                });
                assignNewApiData(state,state.tabs[tabIndex])
            }
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(executeApiRequest.pending, (state, action) => {
                const { tabId,createdDate } = action.meta.arg;
                apiAdapter.upsertOne(state.api, {
                    id: lowerCaseKey(tabId),
                    response:null,
                    createdDate,
                    isFetching: true,
                    error: null 
                });
            })
            .addCase(executeApiRequest.fulfilled, (state, action) => {
                const { response,request } = action.payload;
                const { tabId,createdDate } = action.meta.arg;
                apiAdapter.upsertOne(state.api, {
                    id: lowerCaseKey(tabId),
                    response,
                    request,
                    isFetching: false,
                    createdDate,
                    error: null
                });
                addAction({state,tabId,request,response})
            })
            .addCase(executeApiRequest.rejected, (state, action) => {
                const { error } = action;
                const { tabId } = action.meta.arg;
                apiAdapter.upsertOne(state.api, {
                    id: lowerCaseKey(tabId),
                    isFetching:false,
                    error
                });
            })
    }
});

export const reduxSlice = apiSlice;
