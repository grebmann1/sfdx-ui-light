import * as CONST from '../../constants';
import type { ApplicationAction } from './actions';

type ApplicationState = {
    connector?: Record<string, unknown> | null;
    isLoggedIn?: boolean;
    isLoggedOut?: boolean;
    isUpdate?: boolean;
    isNavigate?: boolean;
    redirectTo?: string | Record<string, unknown>;
    isOpen?: boolean;
    target?: string | Record<string, unknown>;
    isMenuDisplayed?: boolean;
    isMenuExpanded?: boolean;
    source?: string;
    isAgentChatExpanded?: boolean;
    type?: string;
};

export default function application(
    state: ApplicationState = {
        connector: null,
    },
    action: ApplicationAction
): ApplicationState {
    switch (action.type) {
        case CONST.LOGIN:
            return {
                isLoggedIn: true,
                connector: action.payload.connector,
            };
        case CONST.LOGOUT:
            return {
                isLoggedOut: true,
                connector: null,
            };
        case CONST.UPDATE_IDENTITY:
            return {
                ...state,
                connector: action.payload.connector,
                isUpdate: true,
            };
        case CONST.NAVIGATE:
            return {
                isNavigate: true,
                redirectTo: action.payload.target,
            };
        case CONST.FAKE_NAVIGATE:
            return {
                type: action.type,
                target: action.payload.target,
            };
        case CONST.OPEN:
            return {
                isOpen: true,
                target: action.payload.target,
            };
        case CONST.MENU_HIDE:
            return {
                isMenuDisplayed: false,
            };
        case CONST.MENU_SHOW:
            return {
                isMenuDisplayed: true,
            };
        case CONST.MENU_COLLAPSE:
            return {
                isMenuExpanded: false,
                source: action.payload.source,
            };
        case CONST.MENU_EXPAND:
            return {
                isMenuExpanded: true,
                source: action.payload.source,
            };
        case CONST.AGENT_CHAT_COLLAPSE:
            return {
                isAgentChatExpanded: false,
                source: action.payload.source,
            };
        case CONST.AGENT_CHAT_EXPAND:
            return {
                isAgentChatExpanded: true,
                source: action.payload.source,
            };
        default:
            return state;
    }
}
