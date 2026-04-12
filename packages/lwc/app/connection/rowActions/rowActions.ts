export const CONNECTION_ROW_ACTIONS = {
    AUTHORIZE: 'authorize',
    LOGIN: 'login',
} as const;

export function getErrorRowActionName(connectAction?: string) {
    return connectAction === CONNECTION_ROW_ACTIONS.AUTHORIZE
        ? CONNECTION_ROW_ACTIONS.AUTHORIZE
        : CONNECTION_ROW_ACTIONS.LOGIN;
}

export function resolveRequestedConnectionAction(actionName?: string, rowConnectAction?: string) {
    if (
        actionName === CONNECTION_ROW_ACTIONS.LOGIN &&
        rowConnectAction === CONNECTION_ROW_ACTIONS.AUTHORIZE
    ) {
        return CONNECTION_ROW_ACTIONS.AUTHORIZE;
    }

    return actionName || CONNECTION_ROW_ACTIONS.LOGIN;
}
