import { createSlice, createAsyncThunk,createEntityAdapter } from '@reduxjs/toolkit';
import { lowerCaseKey,guid,isNotUndefinedOrNull } from 'shared/utils';

const PLATFORM_EVENT_SETTINGS_KEY = 'PLATFORM_EVENT_SETTINGS_KEY';

/** Methods */


function loadCacheSettings(alias) {
    try {
        const configText = localStorage.getItem(`${alias}-${PLATFORM_EVENT_SETTINGS_KEY}`);
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
            recentPanelToggled,viewerTab
        } = state

        localStorage.setItem(
            `${alias}-${PLATFORM_EVENT_SETTINGS_KEY}`,
            JSON.stringify({ 
                recentPanelToggled,viewerTab
            })
        );
    } catch (e) {
        console.error('Failed to save CONFIG to localstorage', e);
    }
}

/** Redux */

export const platformEventAdapter = createEntityAdapter();

// Create a slice with reducers and extraReducers
const platformEventSlice = createSlice({
    name: 'platformEvent',
    initialState:{
        recentPanelToggled:false,
        viewerTab:'Default',
        subscriptions:platformEventAdapter.getInitialState(),
        currentChannel:null
    },
    reducers: {
        loadCacheSettings : (state,action) => {
            const { alias } = action.payload;
            const cachedConfig = loadCacheSettings(alias);
            if(cachedConfig){
                const { recentPanelToggled,viewerTab } = cachedConfig; 
                Object.assign(state,{
                    recentPanelToggled,viewerTab
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
        updateRecentPanel :(state, action) => {
            const { value,alias } = action.payload;
            state.recentPanelToggled = value === true;
            if(isNotUndefinedOrNull(alias)){
                saveCacheSettings(alias,state);
            }
        },
        updateChannel :(state, action) => {
            const { value } = action.payload;
            state.currentChannel = value;
        },
        updateViewerTab :(state, action) => {
            const { value,alias } = action.payload;
            state.viewerTab = value;
            if(isNotUndefinedOrNull(alias)){
                saveCacheSettings(alias,state);
            }
        },
        createSubscription:(state, action) => {
            const { channel,status,name,replayId,type } = action.payload;
            platformEventAdapter.upsertOne(state.subscriptions, {
                id: lowerCaseKey(channel),
                name: name || channel,
                type,
                replayId,
                error: null,
                messages:[],
                status,
            });
        },
        deleteSubscription:(state, action) => {
            const { channel } = action.payload;
            platformEventAdapter.removeOne(state.subscriptions,channel);
        },
        updateSubscriptionStatus :(state, action) => {
            const { channel,status } = action.payload;
            platformEventAdapter.upsertOne(state.subscriptions, {
                id: lowerCaseKey(channel),
                error: null,
                messages:[],
                status
            });
        },
        cleanMessages :(state, action) => {
            const { channel } = action.payload;
            platformEventAdapter.upsertOne(state.subscriptions, {
                id: lowerCaseKey(channel),
                error: null,
                messages:[],
            });
        },
        updateReadStatusOnSpecificMessage : (state, action) => {
            const { channel,messageId } = action.payload;
            let _messages = state.subscriptions.entities[lowerCaseKey(channel)].messages;
            let _index = _messages.findIndex(x => x.id === messageId);
            if(_index > -1){
                _messages[_index].isRead = true
            }
            platformEventAdapter.upsertOne(state.subscriptions, {
                id: lowerCaseKey(channel),
                error: null,
                messages:_messages
            });
        },
        upsertSubscriptionMessages : (state, action) => {
            const { channel,messages } = action.payload;
            platformEventAdapter.upsertOne(state.subscriptions, {
                id: lowerCaseKey(channel),
                error: null,
                lastModifiedDate:new Date(),
                messages:[
                    ...(state.subscriptions.entities[lowerCaseKey(channel)]?.messages || []), 
                    ...messages
                  ]
            });
        }
    }
});

export const reduxSlice = platformEventSlice;
