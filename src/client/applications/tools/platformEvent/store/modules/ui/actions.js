import {
    UPDATE_API_LIMIT,
    LOAD_RECENT_CHANNELS,
} from './constants';


export function updateApiLimit({connector}) {
    return {
        type: UPDATE_API_LIMIT,
        payload: { connector },
        alias: connector.alias
    };
}

export function loadRecentChannels(alias) {
    return {
        type: LOAD_RECENT_CHANNELS,
        alias: alias
    };
}
