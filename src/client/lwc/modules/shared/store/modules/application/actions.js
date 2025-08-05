import * as CONST from '../../constants';

export function login(connector) {
    return {
        type: CONST.LOGIN,
        payload: { connector },
    };
}
export function updateConnector(connector) {
    return {
        type: CONST.UPDATE_IDENTITY,
        payload: { connector },
    };
}

export function logout() {
    return {
        type: CONST.LOGOUT,
    };
}

export function navigate(target) {
    return {
        type: CONST.NAVIGATE,
        payload: { target },
    };
}

export function fakeNavigate(target) {
    return {
        type: CONST.FAKE_NAVIGATE,
        payload: { target },
    };
}

export function open(target) {
    return {
        type: CONST.OPEN,
        payload: { target },
    };
}

export function hideMenu() {
    return {
        type: CONST.MENU_HIDE,
    };
}

export function showMenu() {
    return {
        type: CONST.MENU_SHOW,
    };
}

export function collapseMenu(source) {
    return {
        type: CONST.MENU_COLLAPSE,
        payload: { source },
    };
}

export function expandMenu(source) {
    return {
        type: CONST.MENU_EXPAND,
        payload: { source },
    };
}

export function collapseAgentChat(source) {
    return {
        type: CONST.AGENT_CHAT_COLLAPSE,
        payload: { source },
    };
}

export function expandAgentChat(source) {
    return {
        type: CONST.AGENT_CHAT_EXPAND,
        payload: { source },
    };
}
