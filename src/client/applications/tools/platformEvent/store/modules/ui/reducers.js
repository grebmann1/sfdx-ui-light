import {
    UPDATE_API_LIMIT,
    LOAD_RECENT_CHANNELS,
} from './constants';

import { SUBSCRIBE_CHANNEL_SUCCESS } from '../channel/constants';

const RECENT_CHANNELS_KEY = 'lsb.recentChannels';
const MAX_RECENT_CHANNELS = 20;

function recentChannels(state = [], action) {
    console.log('---> store recentChannels');
    const { channel } = action.payload;
    const recentChannelState = [
        channel,
        ...state.filter(q => q !== channel).slice(0, MAX_RECENT_CHANNELS - 1)
    ];
    try {
        localStorage.setItem(
            `${action.alias}-${RECENT_CHANNELS_KEY}`,
            JSON.stringify(recentChannelState)
        );
    } catch (e) {
        console.warn('Failed to save recent channel from localStorage', e);
    }
    return recentChannelState;
}

function loadRecentChannels(alias) {
    try {
        const recentChannelsText = localStorage.getItem(`${alias}-${RECENT_CHANNELS_KEY}`);
        if (recentChannelsText) return JSON.parse(recentChannelsText);
    } catch (e) {
        console.warn('Failed to load recent channels from localStorage', e);
    }
    return [];
}

export default function ui(state = {}, action) {
    switch (action.type) {

        case UPDATE_API_LIMIT: {
            const { limitInfo } = action.payload?.connector;
            return {
                ...state,
                apiUsage: limitInfo ? limitInfo.apiUsage : undefined
            };
        }

        case SUBSCRIBE_CHANNEL_SUCCESS:
            return {
                ...state,
                recentChannels: recentChannels(state.recentChannels, action)
            };

        case LOAD_RECENT_CHANNELS:
            return {
                ...state,
                recentChannels: loadRecentChannels(action.alias)
            };

        default:
            return null;
    }
}