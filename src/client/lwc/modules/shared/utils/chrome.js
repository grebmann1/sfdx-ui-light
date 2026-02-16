import { isChromeExtension } from './env';

/**
 * Chrome extension specific utilities
 */

export async function getAllOrgs(debugMode = false) {
    if (debugMode) {
        return [
            {
                id: 'DEMO-B2C',
                username: 'DEMO-B2C@test.com',
                company: 'DEMO',
                name: 'B2C',
                alias: 'DEMO-B2C',
            },
        ];
    }
    let res = await window.electron.invoke('org-getAllOrgs');
    res = res.sort((a, b) => a.alias.localeCompare(b.alias));
    res = res.map((item, index) => {
        return {
            ...item,
            ...{
                id: item.alias,
                username: item.value,
                company: `${
                    item.alias.split('-').length > 1 ? item.alias.split('-').shift() : ''
                }`.toUpperCase(),
                name: item.alias.split('-').pop(),
            },
        };
    });
    return res;
}

export const redirectToUrlViaChrome = ({
    baseUrl,
    redirectUrl,
    sessionId,
    serverUrl,
    isNewTab,
}) => {
    let params = new URLSearchParams();
    if (sessionId) {
        params.append('sessionId', sessionId);
        params.append('serverUrl', serverUrl);
    }

    if (redirectUrl) {
        params.append('redirectUrl', redirectUrl);
    }
    let url = new URL(baseUrl);
    url.search = params.toString();
    if (isNewTab) {
        window.open(url.href, '_blank');
    } else {
        window.open(url.href);
    }
};

export async function getCurrentTab() {
    if (!isChromeExtension()) return null;
    let queryOptions = { active: true, lastFocusedWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

export const refreshCurrentTab = () => {
    if (!isChromeExtension()) return;

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.reload(tabs[0].id);
    });
};
