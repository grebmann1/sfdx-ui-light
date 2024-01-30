
import * as CONST from '../../constants';

export default function application(state = {}, action) {
    switch (action.type) {
        case CONST.LOGIN:
            return {
                isLoggedIn: true,
                connector: action.payload.connector
            };
        case CONST.LOGOUT:
            return {
                isLoggedOut: true
            };
        case CONST.NAVIGATE:
            return {
                isNavigate: true,
                redirectTo: action.payload.target
            };
        case CONST.OPEN:
            return {
                isOpen: true,
                target: action.payload.target
            }
        case CONST.MENU_HIDE:
            return {
                isMenuDisplayed:false
            }
        case CONST.MENU_SHOW:
            return {
                isMenuDisplayed:true
            }
        case CONST.MENU_COLLAPSE:
            return {
                isMenuExpanded:false,
                source: action.payload.source
            }
        case CONST.MENU_EXPAND:
            return {
                isMenuExpanded:true,
                source: action.payload.source
            }
        default:
            return state;
    }
}
