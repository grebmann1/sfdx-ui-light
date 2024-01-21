
import {
    LOGIN,
    LOGOUT,
} from './constants';

export default function application(state = {}, action) {
    switch (action.type) {
        case LOGIN:
            return {
                ...state,
                isLoggedIn: true,
                user: action.payload.user
            };

        case LOGOUT:
            return {
                ...state,
                isLoggedIn: false
            };

        default:
            return state;
    }
}
