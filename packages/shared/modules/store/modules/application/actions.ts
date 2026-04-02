import * as CONST from '../../constants';

type Connector = Record<string, unknown>;
type NavigateTarget = string | Record<string, unknown>;
type ActionSource = string;

type LoginAction = { type: typeof CONST.LOGIN; payload: { connector: Connector } };
type UpdateIdentityAction = { type: typeof CONST.UPDATE_IDENTITY; payload: { connector: Connector } };
type LogoutAction = { type: typeof CONST.LOGOUT };
type NavigateAction = { type: typeof CONST.NAVIGATE; payload: { target: NavigateTarget } };
type FakeNavigateAction = { type: typeof CONST.FAKE_NAVIGATE; payload: { target: NavigateTarget } };
type OpenAction = { type: typeof CONST.OPEN; payload: { target: NavigateTarget } };
type MenuHideAction = { type: typeof CONST.MENU_HIDE };
type MenuShowAction = { type: typeof CONST.MENU_SHOW };
type MenuCollapseAction = { type: typeof CONST.MENU_COLLAPSE; payload: { source: ActionSource } };
type MenuExpandAction = { type: typeof CONST.MENU_EXPAND; payload: { source: ActionSource } };
type AgentChatCollapseAction = {
    type: typeof CONST.AGENT_CHAT_COLLAPSE;
    payload: { source: ActionSource };
};
type AgentChatExpandAction = {
    type: typeof CONST.AGENT_CHAT_EXPAND;
    payload: { source: ActionSource };
};

export type ApplicationAction =
    | LoginAction
    | UpdateIdentityAction
    | LogoutAction
    | NavigateAction
    | FakeNavigateAction
    | OpenAction
    | MenuHideAction
    | MenuShowAction
    | MenuCollapseAction
    | MenuExpandAction
    | AgentChatCollapseAction
    | AgentChatExpandAction;

export function login(connector: Connector): LoginAction {
    return {
        type: CONST.LOGIN,
        payload: { connector },
    };
}
export function updateConnector(connector: Connector): UpdateIdentityAction {
    return {
        type: CONST.UPDATE_IDENTITY,
        payload: { connector },
    };
}

export function logout(): LogoutAction {
    return {
        type: CONST.LOGOUT,
    };
}

export function navigate(target: NavigateTarget): NavigateAction {
    return {
        type: CONST.NAVIGATE,
        payload: { target },
    };
}

export function fakeNavigate(target: NavigateTarget): FakeNavigateAction {
    return {
        type: CONST.FAKE_NAVIGATE,
        payload: { target },
    };
}

export function open(target: NavigateTarget): OpenAction {
    return {
        type: CONST.OPEN,
        payload: { target },
    };
}

export function hideMenu(): MenuHideAction {
    return {
        type: CONST.MENU_HIDE,
    };
}

export function showMenu(): MenuShowAction {
    return {
        type: CONST.MENU_SHOW,
    };
}

export function collapseMenu(source: ActionSource): MenuCollapseAction {
    return {
        type: CONST.MENU_COLLAPSE,
        payload: { source },
    };
}

export function expandMenu(source: ActionSource): MenuExpandAction {
    return {
        type: CONST.MENU_EXPAND,
        payload: { source },
    };
}

export function collapseAgentChat(source: ActionSource): AgentChatCollapseAction {
    return {
        type: CONST.AGENT_CHAT_COLLAPSE,
        payload: { source },
    };
}

export function expandAgentChat(source: ActionSource): AgentChatExpandAction {
    return {
        type: CONST.AGENT_CHAT_EXPAND,
        payload: { source },
    };
}
