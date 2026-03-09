import { store } from 'core/store';
import LOGGER from 'shared/logger';
import { store as legacyStore, store_application as legacyStore_application } from 'shared/store';
import { guid, isChromeExtension, getChromePort } from 'shared/utils';

export function formatTabId(tabId, tabs) {
    LOGGER.log('Tool -> utils -> formatTabId', tabId, tabs);
    if (tabs.some(tab => tab.id === tabId)) {
        return { tabId, isNewTab: false };
    }
    return { tabId: guid(), isNewTab: true };
}

// Helper: waitForLoaded (copied from soqlLogic.js)
export function waitForLoaded() {
    return new Promise(resolve => {
        const checkLoading = () => {
            const { application } = store.getState();
            if (!application.isLoading) {
                clearInterval(intervalId);
                resolve();
            }
        };
        checkLoading();
        const intervalId = setInterval(checkLoading, 1000);
    });
}

export function wrappedNavigate(payload) {
    let formattedPayload = `sftoolkit:${JSON.stringify({
        type: 'application',
        state: payload,
    })}`;
    LOGGER.log('wrappedNavigate', formattedPayload);
    return legacyStore.dispatch(legacyStore_application.navigate(formattedPayload));
}

export async function openToolkit({ connector, redirect }) {
    const generateMessage = ({ sessionInfo, params }) => ({
        action: 'redirectToUrl',
        sessionId: sessionInfo.sessionId,
        serverUrl: sessionInfo.serverUrl,
        baseUrl: chrome.runtime.getURL('/views/app.html'),
        navigation: params,
    });

    LOGGER.log('openToolkit', connector, redirect);
    let url = new URL(
        isChromeExtension()
            ? chrome.runtime.getURL('/views/app.html')
            : 'https://sf-toolkit.com/extension'
    );

    let isChromeProcessSuccess = false;
    if (isChromeExtension()) {
        try {
            const port = getChromePort();
            const sessionInfo = {
                sessionId: connector.conn.accessToken,
                serverUrl: connector.conn.instanceUrl,
            };
            const params = {
                type: 'application',
            };
            if (redirect) {
                // assume the format is applicationName=api
                params.state = {
                    applicationName: redirect.split('=')[1],
                };
            }
            port.postMessage(generateMessage({ sessionInfo, params }));
            isChromeProcessSuccess = true;
        } catch (e) {
            LOGGER.error('openToolkit error', e);
            //handleError(e, 'Open Toolkit Error');
            // In case of error, we let the default flow to handle it
        }
    }
    if (!isChromeProcessSuccess) {
        let params = new URLSearchParams();
        params.append('sessionId', connector.conn.accessToken);
        params.append('serverUrl', connector.conn.instanceUrl);
        if (redirect) {
            params.append('redirectUrl', encodeURIComponent(redirect));
        }
        // Add params
        url.search = params.toString();
        window.open(url.href, '_blank');
    }
}

const createOrAddToTabGroup = async (tab, groupName, windowId) => {
    const safeGroupName =
        typeof groupName === 'string' && groupName.trim().length > 0
            ? groupName.trim()
            : 'SF Toolkit';

    const chromeCall = (fn, ...args) =>
        new Promise((resolve, reject) => {
            try {
                fn(...args, result => {
                    const err = chrome?.runtime?.lastError;
                    if (err) {
                        reject(new Error(err.message || String(err)));
                    } else {
                        resolve(result);
                    }
                });
            } catch (e) {
                reject(e);
            }
        });

    const groups = (await chromeCall(chrome.tabGroups.query, { windowId })) || [];
    const group = (Array.isArray(groups) ? groups : []).find(g => g?.title === safeGroupName);

    if (group?.id && tab?.id) {
        // Group exists, add the tab to this group
        await chromeCall(chrome.tabs.group, { groupId: group.id, tabIds: tab.id });
        if (group?.collapsed === true) {
            await chromeCall(chrome.tabGroups.update, group.id, { collapsed: false });
        }
        return;
    }

    // Group does not exist, create a new group with this tab
    const newGroupId = await chromeCall(chrome.tabs.group, {
        createProperties: { windowId },
        tabIds: tab.id,
    });
    await chromeCall(chrome.tabGroups.update, newGroupId, {
        title: safeGroupName,
        collapsed: false,
    });
};

export async function openBrowser({ url, target, alias }) {
    if (isChromeExtension()) {
        if (target === 'incognito') {
            const windows = await chrome.windows.getAll({
                populate: false,
                windowTypes: ['normal'],
            });
            for (let w of windows) {
                if (w.incognito) {
                    // Use this window.
                    const tab = await chrome.tabs.create({ url: url, windowId: w.id });
                    await createOrAddToTabGroup(tab, alias, w.id);
                    return;
                }
            }
            // No incognito window found, open a new one.
            chrome.windows.create({ url: url, incognito: true });
        } else {
            const current = await chrome.windows.getCurrent();
            const tab = await chrome.tabs.create({ url: url, windowId: current.id });
            await createOrAddToTabGroup(tab, alias, current.id);
        }
    } else {
        window.open(url, target);
    }
}
