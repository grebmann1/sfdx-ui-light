const VSCODE_BACKGROUND_ACTIONS = new Set([
    'fetchCookieForTabId',
    'listOrgSessions',
    'requestTabsPermission',
    'openWorkbenchTab',
]);

export function isVscodeBackgroundAction(action) {
    return VSCODE_BACKGROUND_ACTIONS.has(action);
}

export async function handleVscodeBackgroundMessage(message, api) {
    if (message.action === 'fetchCookieForTabId') {
        const tabId = Number(message.tabId);
        if (!Number.isFinite(tabId)) {
            return { error: 'Missing/invalid tabId' };
        }
        return await api.getSidCookieForTabId(tabId);
    }
    if (message.action === 'listOrgSessions') {
        return await api.listOrgSessionsFromTabs();
    }
    if (message.action === 'requestTabsPermission') {
        return await api.requestPermission('tabs');
    }
    if (message.action === 'openWorkbenchTab') {
        const sourceTabId = Number(message?.sourceTabId);
        await api.openWorkbenchTab(Number.isFinite(sourceTabId) ? sourceTabId : null);
        return { ok: true };
    }
    return undefined;
}

