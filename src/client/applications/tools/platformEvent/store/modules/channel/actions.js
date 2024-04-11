import {
    RECEIVE_MESSAGE_SUCCESS,
    CLEAN_MESSAGES,
    SUBSCRIBE_CHANNEL_SUCCESS,
} from './constants';

export function subscribeChannelSuccess(channel, alias) {
    return {
        type: SUBSCRIBE_CHANNEL_SUCCESS,
        payload: { channel },
        alias:alias
    };
}

export function receiveMessageSuccess(latest,messages, channel) {
    return {
        type: RECEIVE_MESSAGE_SUCCESS,
        payload: { latest,messages,channel }
    };
}

export function cleanMessages(channel) {
    return {
        type: CLEAN_MESSAGES,
        payload: { channel }
    };
}
