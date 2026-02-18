import { createSlice, createAsyncThunk, createEntityAdapter } from '@reduxjs/toolkit';
import { lowerCaseKey, guid, isNotUndefinedOrNull } from 'shared/utils';
import { ERROR, store } from 'core/store';

const PLATFORM_EVENT_SETTINGS_KEY = 'PLATFORM_EVENT_SETTINGS_KEY';

/** Methods */

function loadCacheSettings(alias) {
    try {
        const configText = localStorage.getItem(`${alias}-${PLATFORM_EVENT_SETTINGS_KEY}`);
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
        const { recentPanelToggled, viewerTab, maxMessagesPerChannel } = state;

        localStorage.setItem(
            `${alias}-${PLATFORM_EVENT_SETTINGS_KEY}`,
            JSON.stringify({
                recentPanelToggled,
                viewerTab,
                maxMessagesPerChannel,
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

/** Redux */

export const platformEventAdapter = createEntityAdapter();

// Create a slice with reducers and extraReducers
const platformEventSlice = createSlice({
    name: 'platformEvent',
    initialState: {
        recentPanelToggled: false,
        viewerTab: 'Default',
        maxMessagesPerChannel: 500,
        subscriptions: platformEventAdapter.getInitialState(),
        currentChannel: null,
    },
    reducers: {
        loadCacheSettings: (state, action) => {
            const { alias } = action.payload;
            const cachedConfig = loadCacheSettings(alias);
            if (cachedConfig) {
                const { recentPanelToggled, viewerTab, maxMessagesPerChannel } = cachedConfig;
                Object.assign(state, {
                    recentPanelToggled,
                    viewerTab,
                    maxMessagesPerChannel:
                        typeof maxMessagesPerChannel === 'number' ? maxMessagesPerChannel : state.maxMessagesPerChannel,
                });
            }
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
        updateChannel: (state, action) => {
            const { value } = action.payload;
            state.currentChannel = value;
        },
        updateViewerTab: (state, action) => {
            const { value, alias } = action.payload;
            state.viewerTab = value;
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        updateMaxMessagesPerChannel: (state, action) => {
            const { value, alias } = action.payload;
            const parsed = parseInt(value, 10);
            state.maxMessagesPerChannel = Number.isFinite(parsed) && parsed > 0 ? parsed : 500;
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        createSubscription: (state, action) => {
            const { channel, status, name, replayId, type } = action.payload;
            platformEventAdapter.upsertOne(state.subscriptions, {
                id: lowerCaseKey(channel),
                name: name || channel,
                type,
                replayId,
                error: null,
                messages: [],
                status,
            });
        },
        deleteSubscription: (state, action) => {
            const { channel } = action.payload;
            platformEventAdapter.removeOne(state.subscriptions, channel);
        },
        updateSubscriptionStatus: (state, action) => {
            const { channel, status } = action.payload;
            const existing = state.subscriptions.entities[lowerCaseKey(channel)]?.messages || [];
            platformEventAdapter.upsertOne(state.subscriptions, {
                id: lowerCaseKey(channel),
                error: null,
                messages: existing,
                status,
            });
        },
        cleanMessages: (state, action) => {
            const { channel } = action.payload;
            platformEventAdapter.upsertOne(state.subscriptions, {
                id: lowerCaseKey(channel),
                error: null,
                messages: [],
            });
        },
        updateReadStatusOnSpecificMessage: (state, action) => {
            const { channel, messageId } = action.payload;
            let _messages = state.subscriptions.entities[lowerCaseKey(channel)].messages;
            let _index = _messages.findIndex(x => x.id === messageId);
            if (_index > -1) {
                _messages[_index].isRead = true;
            }
            platformEventAdapter.upsertOne(state.subscriptions, {
                id: lowerCaseKey(channel),
                error: null,
                messages: _messages,
            });
        },
        upsertSubscriptionMessages: (state, action) => {
            const { channel, messages } = action.payload;
            const cap = state.maxMessagesPerChannel || 500;

            const existing = state.subscriptions.entities[lowerCaseKey(channel)]?.messages || [];

            const enrich = (m) => {
                if (m && m._searchText) return m;
                try {
                    const content = m?.content || m;
                    const replayId = content?.data?.event?.replayId ?? m?.id ?? '';
                    const uuid = content?.data?.event?.EventUuid ?? '';
                    const ch = content?.channel ?? channel ?? '';
                    const json = JSON.stringify(content);
                    const cappedJson = json.length > 10000 ? `${json.slice(0, 10000)}…` : json;
                    return {
                        ...m,
                        _searchText: `${replayId} ${uuid} ${ch} ${cappedJson}`,
                    };
                } catch {
                    return { ...m, _searchText: `${m?.id ?? ''} ${channel ?? ''}` };
                }
            };

            platformEventAdapter.upsertOne(state.subscriptions, {
                id: lowerCaseKey(channel),
                error: null,
                lastModifiedDate: new Date(),
                messages:
                    cap > 0
                        ? [...existing, ...messages.map(enrich)].slice(-cap)
                        : [...existing, ...messages.map(enrich)],
            });
        },
    },
});

export const reduxSlice = platformEventSlice;
