import {
    LOGIN,
    LOGOUT,
    NAVIGATE
} from './constants';

export function login(user) {
    return {
        type: LOGIN,
        payload: { user }
    };
}

export function logout() {
    return {
        type: LOGOUT
    };
}

export function navigate(target) {
    return {
        type: NAVIGATE,
        payload: { target }
    };
}
