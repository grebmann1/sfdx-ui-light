const STANDARD_LIGHTNING_DOMAIN_REGEX = {
    regex: /lightning(.*).force([.-])com/,
    replace: 'my$1.salesforce$2com',
};

const SOMA_LOCAL_DOMAIN_REGEX = {
    regex: /lightning.localhost.soma.force/,
    replace: 'my.localhost.sfdcdev.salesforce',
};

const SALESFORCE_SETUP_DOMAIN_REGEX = {
    regex: /salesforce-setup([.-])com/,
    replace: 'salesforce$1com',
};

const WORKSPACE_NO_MY_DOMAIN_REGEX = {
    regex: /dev.lightning.force-com.(\w+)/,
    replace: '$1',
};

export async function getCurrentTabCookieStoreId(tabId) {
    const stores = await chrome.cookies.getAllCookieStores();
    const currentStore = stores.find(obj => obj.tabIds.includes(tabId));
    return currentStore?.id;
}

export async function hasPermission(permission) {
    try {
        if (!chrome?.permissions?.contains) return true;
        const res = await chrome.permissions.contains({ permissions: [permission] });
        return Boolean(res);
    } catch {
        return false;
    }
}

export async function requestPermission(permission) {
    try {
        if (!chrome?.permissions?.request) {
            return { granted: false, error: 'permissions API unavailable' };
        }
        const granted = await chrome.permissions.request({ permissions: [permission] });
        return { granted: Boolean(granted) };
    } catch (e) {
        return { granted: false, error: e?.message || String(e) };
    }
}

export async function getTabIdToStoreIdMap() {
    const stores = await chrome.cookies.getAllCookieStores();
    const map = new Map();
    for (const store of stores || []) {
        const storeId = store?.id;
        if (!storeId) continue;
        for (const tabId of store?.tabIds || []) {
            map.set(tabId, storeId);
        }
    }
    return map;
}

export function getSalesforceURL(tabUrl) {
    let url = new URL(tabUrl).origin;
    if (tabUrl.match(SOMA_LOCAL_DOMAIN_REGEX.regex)) {
        url = new URL(
            tabUrl.replace(SOMA_LOCAL_DOMAIN_REGEX.regex, SOMA_LOCAL_DOMAIN_REGEX.replace)
        ).origin;
    } else if (tabUrl.match(WORKSPACE_NO_MY_DOMAIN_REGEX.regex)) {
        url = new URL(
            tabUrl.replace(WORKSPACE_NO_MY_DOMAIN_REGEX.regex, WORKSPACE_NO_MY_DOMAIN_REGEX.replace)
        ).origin;
    } else if (tabUrl.match(STANDARD_LIGHTNING_DOMAIN_REGEX.regex)) {
        url = new URL(
            tabUrl.replace(
                STANDARD_LIGHTNING_DOMAIN_REGEX.regex,
                STANDARD_LIGHTNING_DOMAIN_REGEX.replace
            )
        ).origin;
    } else if (tabUrl.match(SALESFORCE_SETUP_DOMAIN_REGEX.regex)) {
        url = new URL(
            tabUrl.replace(
                SALESFORCE_SETUP_DOMAIN_REGEX.regex,
                SALESFORCE_SETUP_DOMAIN_REGEX.replace
            )
        ).origin;
    }
    return url;
}

export function canonicalizeServerUrl(serverUrl) {
    if (!serverUrl) return serverUrl;
    try {
        return getSalesforceURL(serverUrl);
    } catch {
        return serverUrl;
    }
}

export function isHttpUrl(raw) {
    try {
        const url = new URL(raw);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

export async function getSidCookieForOrigin({ origin, storeId }) {
    if (!origin) return { error: 'Missing origin' };
    let cookie = await chrome.cookies.get({
        name: 'sid',
        url: origin,
        ...(storeId ? { storeId } : {}),
    });

    if (!cookie?.value && origin.includes('soma')) {
        const fallbackOrigin = origin.replace('soma', 'sfdcdev');
        cookie = await chrome.cookies.get({
            name: 'sid',
            url: fallbackOrigin,
            ...(storeId ? { storeId } : {}),
        });
        if (cookie?.value) {
            return { serverUrl: fallbackOrigin, sessionId: cookie.value };
        }
    }

    if (cookie?.value) {
        return { serverUrl: origin, sessionId: cookie.value };
    }
    return { error: 'No sid cookie found' };
}

export async function getSidCookieForTabId(tabId) {
    const canUseTabs = await hasPermission('tabs');
    if (!canUseTabs) {
        return { error: 'Tab access not granted. Enable tab-based org discovery permission.' };
    }

    const tab = await chrome.tabs.get(tabId);
    if (!tab?.url) {
        return { error: 'Tab has no URL' };
    }

    const canonicalOrigin = getSalesforceURL(tab.url);
    const storeId = await getCurrentTabCookieStoreId(tabId);
    const res = await getSidCookieForOrigin({ origin: canonicalOrigin, storeId });
    if (res?.sessionId && res?.serverUrl) return res;
    return { error: 'No Salesforce sid cookie found for tab' };
}

export async function getHostAndSession(tab) {
    try {
        if (!tab?.url) return;
        let url = getSalesforceURL(tab.url);
        const parsedTabUrl = new URL(tab.url);
        const isDeveloperServer = !!parsedTabUrl.port;
        const cookieStoreId = await getCurrentTabCookieStoreId(tab.id);
        let cookie = await chrome.cookies.get({
            name: 'sid',
            url,
            storeId: cookieStoreId,
        });
        if (!cookie || !cookie.value) {
            const fallbackUrl = url.replace('soma', 'sfdcdev');
            cookie = await chrome.cookies.get({
                name: 'sid',
                url: fallbackUrl,
            });
            url = fallbackUrl;
        }
        if (cookie?.value) {
            return {
                domain: url,
                session: cookie.value,
                isDeveloperServer,
            };
        }
        return;
    } catch (e) {
        console.error('getHostAndSession issue: ', e);
        return;
    }
}

const servicesDataBaseUrlCache = new Map();

export async function getServicesDataBaseUrl(serverUrl, sessionId) {
    if (!serverUrl || !sessionId) return '/services/data/v63.0';
    const cached = servicesDataBaseUrlCache.get(serverUrl);
    if (cached) return cached;
    try {
        const resp = await fetch(`${serverUrl}/services/data/`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${sessionId}` },
        });
        if (!resp.ok) throw new Error('services/data discovery failed');
        const json = await resp.json();
        if (!Array.isArray(json) || json.length === 0) throw new Error('services/data invalid');
        const best = json
            .map(item => ({ version: Number(item?.version), url: item?.url }))
            .filter(item => Number.isFinite(item.version) && typeof item.url === 'string')
            .sort((a, b) => b.version - a.version)[0];
        const baseUrl = best?.url ? best.url.replace(/\/+$/, '') : '/services/data/v63.0';
        servicesDataBaseUrlCache.set(serverUrl, baseUrl);
        return baseUrl;
    } catch {
        return '/services/data/v63.0';
    }
}

export async function validateSession(serverUrl, sessionId) {
    try {
        if (!serverUrl || !sessionId) return false;
        const base = await getServicesDataBaseUrl(serverUrl, sessionId);
        const url = `${serverUrl}${base}/limits`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${sessionId}` },
        });
        return response.ok;
    } catch {
        return false;
    }
}

export async function listOrgSessionsFromTabs() {
    const canUseTabs = await hasPermission('tabs');
    if (!canUseTabs) {
        return { error: 'Tab access not granted. Enable tab-based org discovery permission.' };
    }

    const tabs = await chrome.tabs.query({});
    const tabIdToStoreId = await getTabIdToStoreIdMap();
    const byKey = new Map();

    for (const tab of tabs || []) {
        try {
            if (!tab?.id || !tab?.url) continue;
            if (!isHttpUrl(tab.url)) continue;

            const origin = getSalesforceURL(tab.url);
            const storeId = tabIdToStoreId.get(tab.id);
            const cookieInfo = await getSidCookieForOrigin({ origin, storeId });
            if (!cookieInfo?.serverUrl || !cookieInfo?.sessionId) continue;

            const key = `${cookieInfo.serverUrl}|${cookieInfo.sessionId}`;
            const existing = byKey.get(key) || {
                serverUrl: cookieInfo.serverUrl,
                sessionId: cookieInfo.sessionId,
                tabIds: [],
                titles: [],
            };
            existing.tabIds.push(tab.id);
            if (tab.title) existing.titles.push(tab.title);
            byKey.set(key, existing);
        } catch {
            // Ignore invalid tabs.
        }
    }

    const out = [];
    for (const candidate of byKey.values()) {
        // eslint-disable-next-line no-await-in-loop
        const ok = await validateSession(candidate.serverUrl, candidate.sessionId);
        if (!ok) continue;
        let host = candidate.serverUrl;
        try {
            host = new URL(candidate.serverUrl).host;
        } catch {
            // Ignore host parsing issues.
        }
        const firstTitle = candidate.titles?.[0] || '';
        out.push({
            serverUrl: candidate.serverUrl,
            sessionId: candidate.sessionId,
            label: host,
            detail: `${candidate.tabIds.length} tab(s)${firstTitle ? ` • ${firstTitle}` : ''}`,
        });
    }

    out.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    return out;
}

export function openWorkbenchTab(sourceTabId) {
    const url = chrome.runtime.getURL(
        `views/vscode.html${sourceTabId ? `?sourceTabId=${sourceTabId}` : ''}`
    );
    return chrome.tabs.create({ url });
}
