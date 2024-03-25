import * as CONST from '../../constants';

export function login(connector) {
    return {
        type: CONST.LOGIN,
        payload: { connector }
    };
}

export function logout() {
    return {
        type: CONST.LOGOUT
    };
}

export function navigate(target) {
    return {
        type: CONST.NAVIGATE,
        payload: { target }
    };
}

export function fakeNavigate(target) {
    return {
        type: CONST.FAKE_NAVIGATE,
        payload: { target }
    };
}

export function open(target) {
    return {
        type: CONST.OPEN,
        payload: { target }
    };
}

export function hideMenu() {
    return {
        type: CONST.MENU_HIDE
    };
}

export function showMenu() {
    return {
        type: CONST.MENU_SHOW
    };
}

export function collapseMenu(source){
    return {
        type: CONST.MENU_COLLAPSE,
        payload:{source}
    };
}

export function expandMenu(source){
    return {
        type: CONST.MENU_EXPAND,
        payload:{source}
    };
}

