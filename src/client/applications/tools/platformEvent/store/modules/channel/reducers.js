import {
    RECEIVE_MESSAGE_SUCCESS,
    CLEAN_MESSAGES,
    SUBSCRIBE_CHANNEL_SUCCESS
} from './constants';

export default function channel(state = {},action) {
    switch (action.type) {
        case RECEIVE_MESSAGE_SUCCESS:
            return {
                latest: action.payload.latest,
                messages: action.payload.messages,
                channel: action.payload.channel,
            };
        case SUBSCRIBE_CHANNEL_SUCCESS:
            return {
                messages: [],
                channel: action.payload.channel,
            }
        case CLEAN_MESSAGES:
            return{
                messages: [],
                channel: action.payload.channel,
            }
        default:
            return null;
    }
}
