import { handleChromeInteraction } from './chromeApi.js';
import { CACHE_CONFIG, saveSingleExtensionConfigToCache, loadSingleExtensionConfigFromCache } from 'shared/cacheManager';

/** STATIC **/
const OVERLAY_ENABLE = 'overlay_enable';
const OVERLAY_DISABLE = 'overlay_disable';
const OVERLAY_ENABLE_TITLE = 'Enable Overlay';
const OVERLAY_DISABLE_TITLE = 'Disable Overlay';
const OVERLAY_TOGGLE = 'overlay_toggle';
// Opening Actions
const OPEN_OVERLAY_SEARCH = 'open_overlay_search';
const OPEN_SIDE_PANEL = 'open_side_panel';
const OPEN_TOOLKIT = 'open_toolkit';

// Default patterns

// Default patterns
const DEFAULT_INCLUDE_PATTERNS = [
    '/\.salesforce(-com)?\./',
    '/\.lightning\.force(-com)?\./',
    '/\.crm\.dev(:\d+)?\//',
    '/\.develop\.lightning\.force(-com)?\./',
    '/\.salesforce-setup(-com)?\./',
    '/\.force\.com/',
    '/\.salesforce\.mil/',
    '/\.crmforce\.mil/',
    '/\.lightning\.force\.mil/',
    '/\.cloudforce\.mil/',
    '/\.sfcrmapps\.cn/',
    '/\.sfcrmproducts\.cn/',
    '/\.lightning\.force\.com\.mcas\.ms/',
    '/\.builder\.salesforce-experience\.com/',
    '/lightning/',
];
const DEFAULT_EXCLUDE_PATTERNS = [
    '/\/setup\/secur\/RemoteAccessAuthorizationPage\.apexp/',
    '/\/_ui\/common\/apex\/debug\//',
    '/\/_ui\//',
    'https:\/\/test\.salesforce\.com\//',
    'https:\/\/login\.salesforce\.com\//',
    '/\/loginflow\//',
    'salesforce\.com\/#\[^\/\]/',
];

const isEmpty = str => {
    return !str || str.length === 0;
};

const isNotNullOrUndefined = (value) => {
    return value !== null && value !== undefined;
};

const redirectToUrlViaChrome = ({
    baseUrl,
    sessionId,
    serverUrl,
    navigation,
}) => {
    let params = new URLSearchParams();
    if (sessionId) {
        params.append('sessionId', sessionId);
        params.append('serverUrl', serverUrl);
    }

    if (navigation) {
        // Navigation state is a key-value pair of the state of the navigation
        const redirectUrl = new URLSearchParams();
        if(isNotNullOrUndefined(navigation.state)){
            console.log('navigation.state',navigation.state);
            Object.entries(navigation.state).forEach(([key, value]) => {
                redirectUrl.append(key, value);
            });
        }
        params.append('redirectUrl', encodeURIComponent(redirectUrl.toString()));
    }

    let url = new URL(baseUrl);
        url.search = params.toString();
    // Open a new tab
    chrome.tabs.create({
        url: url.href,
    });
};

/** Variables */

// Code is duplicated in the shared module, but we need to keep it here for now !!!

const getCurrentTabCookieStoreId = async tabId => {
    const stores = await chrome.cookies.getAllCookieStores();

    const currentStore = stores.find(obj => {
        return obj.tabIds.includes(tabId);
    });
    return currentStore.id;
};

/*** Utility Functions ***/
const compareMajorMinor = (versionA, versionB) => {
    // Compare only major and minor, ignore patch
    // version format: x.y.z
    const [aMajor, aMinor] = versionA.split('.').map(Number);
    const [bMajor, bMinor] = versionB.split('.').map(Number);
    return aMajor !== bMajor || aMinor !== bMinor;
};

// --- Salesforce Domain Regex Utilities ---
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

function getSalesforceURL(tabUrl) {
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

function canonicalizeServerUrl(serverUrl) {
    if (!serverUrl) return serverUrl;
    try {
        return getSalesforceURL(serverUrl);
    } catch (e) {
        return serverUrl;
    }
}

const getHostAndSession = async tab => {
    try {
        if (!tab.url) return;
        // 1. Get the canonical Salesforce URL for the tab
        let url = getSalesforceURL(tab.url);
        // Detect dev server by checking if a port is specified in the current tab URL
        const parsedTabUrl = new URL(tab.url);
        const isDeveloperServer = !!parsedTabUrl.port;
        let cookieStoreId = await getCurrentTabCookieStoreId(tab.id);
        // 2. Try to get the SID cookie for this URL
        let cookie = await chrome.cookies.get({
            name: 'sid',
            url: url,
            storeId: cookieStoreId,
        });
        // 3. If not found, try substituting soma with sfdcdev (for local dev)
        if (!cookie || !cookie.value) {
            const newUrl = url.replace('soma', 'sfdcdev');
            cookie = await chrome.cookies.get({
                name: 'sid',
                url: newUrl,
            });
            url = newUrl; // update url if we found the cookie here
        }
        if (cookie && cookie.value) {
            // 4. Return the session and domain
            return {
                domain: url,
                session: cookie.value,
                isDeveloperServer,
            };
        } else {
            // 5. No session found
            return;
        }
    } catch (e) {
        console.error('getHostAndSession issue: ', e);
        return;
    }
};

/**
 * Validate a Salesforce session by calling a simple authenticated endpoint.
 * Returns true if the session is valid (HTTP 200), false otherwise.
 */
const _servicesDataBaseUrlCache = new Map(); // serverUrl -> "/services/data/vXX.X"

async function getServicesDataBaseUrl(serverUrl, sessionId) {
    if (!serverUrl || !sessionId) return '/services/data/v63.0';
    const cached = _servicesDataBaseUrlCache.get(serverUrl);
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
            .map(x => ({ version: Number(x?.version), url: x?.url }))
            .filter(x => Number.isFinite(x.version) && typeof x.url === 'string')
            .sort((a, b) => b.version - a.version)[0];
        const baseUrl = (best && best.url) ? best.url.replace(/\/+$/, '') : '/services/data/v63.0';
        _servicesDataBaseUrlCache.set(serverUrl, baseUrl);
        return baseUrl;
    } catch (e) {
        return '/services/data/v63.0';
    }
}

async function validateSession(serverUrl, sessionId) {
    try {
        if (!serverUrl || !sessionId) return false;
        const base = await getServicesDataBaseUrl(serverUrl, sessionId);
        const url = `${serverUrl}${base}/limits`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${sessionId}`,
            },
        });
        return response.ok;
    } catch (e) {
        return false;
    }
}

/**
 * Find a valid sessionId from existing tabs for a specific alias and/or instanceUrl.
 * - If instanceUrl is provided, restrict search to that instance (canonicalized).
 * - If alias is provided and mapped in current instance connections, use its serverUrl.
 * - If neither resolves to a target, search across all Salesforce tabs.
 * Returns { sessionId, serverUrl, tabId } or undefined.
 */
async function findExistingSession({ alias, instanceUrl } = {}) {
    // Derive target serverUrl from alias if available
    let targetServerUrl;
    if (instanceUrl) {
        try {
            targetServerUrl = getSalesforceURL(instanceUrl);
        } catch (e) {}
    }
    if (!targetServerUrl && alias) {
        for (const [, instance] of instanceConnections.entries()) {
            if (instance && instance.alias === alias && instance.serverUrl) {
                targetServerUrl = getSalesforceURL(instance.serverUrl);
                break;
            }
        }
    }

    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        try {
            if (!tab || !tab.url) continue;
            // Consider only Salesforce-related tabs we would inject into
            if (!(await shouldInjectScriptAsync(tab.url))) continue;

            const canonicalTabServerUrl = getSalesforceURL(tab.url);
            if (targetServerUrl && canonicalTabServerUrl !== targetServerUrl) continue;

            // Use the tab's cookie store to fetch the SID cookie
            const storeId = await getCurrentTabCookieStoreId(tab.id);
            let cookie = await chrome.cookies.get({
                name: 'sid',
                url: canonicalTabServerUrl,
                storeId,
            });

            // If not found, try soma->sfdcdev fallback like getHostAndSession does
            if (!cookie || !cookie.value) {
                const fallbackUrl = canonicalTabServerUrl.replace('soma', 'sfdcdev');
                if (fallbackUrl !== canonicalTabServerUrl) {
                    cookie = await chrome.cookies.get({ name: 'sid', url: fallbackUrl, storeId });
                    if (cookie && cookie.value) {
                        // Use fallbackUrl as canonical if cookie found there
                        if (!targetServerUrl) {
                            targetServerUrl = fallbackUrl;
                        }
                    }
                }
            }

            if (cookie && cookie.value) {
                const serverUrlToValidate = targetServerUrl || canonicalTabServerUrl;
                const isValid = await validateSession(serverUrlToValidate, cookie.value);
                if (isValid) {
                    return {
                        sessionId: cookie.value,
                        serverUrl: serverUrlToValidate,
                        tabId: tab.id,
                    };
                }
            }
        } catch (e) {
            // Skip tab on any error and continue
        }
    }
    return;
}

// Refactored isHostMatching to use the same logic as shouldInjectScriptAsync
async function isHostMatching(url) {
    const normalizedUrl = normalizeUrlForPatternMatch(url);
    if (!normalizedUrl) return false;
    const { includePatterns, excludePatterns } = await getContentScriptPatterns();
    for (const pattern of excludePatterns) {
        if (pattern.test(normalizedUrl)) return false;
    }
    for (const pattern of includePatterns) {
        if (pattern.test(normalizedUrl)) return true;
    }
    return false;
}

const _lastSidePanelOptionsByTabId = new Map(); // tabId -> { url, ts }

const handleTabOpening = async tab => {
    // Instead of loading the configuration every time, send a message to the background job !!!

    //const configuration = utils.loadExtensionConfigFromCache();
    //const openPopupInSidePanel = configuration.openPopupInSidePanel || false;
    //console.log('handleTabOpening - openPopupInSidePanel',openPopupInSidePanel);

    try {
        if (!tab?.id || !tab?.url) return;
        const now = Date.now();
        const last = _lastSidePanelOptionsByTabId.get(tab.id);
        if (last && last.url === tab.url && now - last.ts < 750) return;

        const isSalesforceTab = await isHostMatching(tab.url);
        const path = `views/default.html?${isSalesforceTab ? 'salesforce' : 'default'}`;
        await chrome.sidePanel.setOptions({
            tabId: tab.id,
            path: path,
            enabled: true,
        });
        _lastSidePanelOptionsByTabId.set(tab.id, { url: tab.url, ts: now });
    } catch (e) {
        //console.log('Issue handleTabOpening',e);
    }
};

const openSideBar = async tab => {
    await chrome.sidePanel.open({ tabId: tab.id });
    await chrome.sidePanel.setOptions({
        tabId: tab.id,
        path: `views/default.html?salesforce`,
        enabled: true,
    });
};

// Message Listener
const wrapAsyncFunction = listener => (request, sender, sendResponse) => {
    Promise.resolve(listener(request, sender))
        .then(sendResponse)
        .catch(error => {
            sendResponse({ error: error.message });
        });
    return true;
};

/*** Context Menu Methods ***/
let _ensureContextMenuPromise = null;

async function ensureContextMenu() {
    if (_ensureContextMenuPromise) return _ensureContextMenuPromise;
    _ensureContextMenuPromise = (async () => {
        await createContextMenu();
    })().finally(() => {
        _ensureContextMenuPromise = null;
    });
    return _ensureContextMenuPromise;
}

async function createContextMenu() {
    const isEnabled = await loadSingleExtensionConfigFromCache(CACHE_CONFIG.OVERLAY_ENABLED.key);
    // Idempotent menu creation: MV3 service worker can restart, so recreate safely.
    await new Promise(resolve => {
        try {
            chrome.contextMenus.removeAll(() => resolve());
        } catch (e) {
            resolve();
        }
    });
    /* chrome.contextMenus.create({
        id: OPEN_SIDE_PANEL,
        title: 'Open Salesforce Toolkit (side panel)',
        contexts: ['page'],
    }); */

    chrome.contextMenus.create(
        {
        id: OPEN_TOOLKIT,
        title: 'Open Salesforce Toolkit (in new tab)',
        contexts: ['action'],
        enabled: true,
        visible: true,
        },
        () => { void chrome.runtime.lastError; }
    );

    chrome.contextMenus.create(
        {
        id: OVERLAY_ENABLE,
        title: OVERLAY_ENABLE_TITLE,
        contexts: ['action'],
        enabled: !isEnabled,
        visible: true,
        },
        () => { void chrome.runtime.lastError; }
    );
    chrome.contextMenus.create(
        {
        id: OVERLAY_DISABLE,
        title: OVERLAY_DISABLE_TITLE,
        contexts: ['action'],
        enabled: isEnabled,
        visible: true,
        },
        () => { void chrome.runtime.lastError; }
    );
}

const injectedConnections = new Set();
const sidePanelConnections = new Set();
const instanceConnections = new Map();

chrome.runtime.onConnect.addListener(function (port) {
    if (port.name === 'sf-toolkit-instance') {
        console.log('--> Registering instance',port.name);
        const cleanup = (identityKey) => {
            if (!identityKey) return;
            instanceConnections.delete(identityKey);
        };
        let registeredIdentityKey;
        port.onDisconnect.addListener(() => {
            cleanup(registeredIdentityKey);
        });
        port.onMessage.addListener((msg) => {
            const identityKey = canonicalizeServerUrl(msg.serverUrl); // canonical origin
            if (msg.action === 'registerInstance') {
                if (identityKey) {
                    // If the same port re-registers (e.g., connection changes), clean up the old key.
                    if (registeredIdentityKey && registeredIdentityKey !== identityKey) {
                        cleanup(registeredIdentityKey);
                    }
                    registeredIdentityKey = identityKey;
                    instanceConnections.set(identityKey, {
                        port,
                        serverUrl: identityKey,
                        alias: msg.alias,
                        username: msg.username,
                    });
                    console.log('--> Registering instance (Once is logged in)',identityKey);
                }
            } else if (msg.action === 'closeConnection') {
                cleanup(identityKey || registeredIdentityKey);
                try { port.disconnect(); } catch (e) {}
            }
        });
    } else if (port.name === 'sf-toolkit-injected') {
        console.log('--> Registering injected',port.name);
        injectedConnections.add(port);
        port.onDisconnect.addListener(() => {
            injectedConnections.delete(port);
        });
        port.onMessage.addListener((msg) => {
            if (msg.action === 'redirectToUrl') {
                handleRedirectToUrl(msg);
                /* const url = buildRedirectUrl(msg);
                if (url) {
                    chrome.tabs.create({ url });
                } */
            }
        });
    } else if (port.name === 'sf-toolkit-sidepanel') {
        console.log('--> Registering sidepanel',port.name);
        sidePanelConnections.add(port);
        port.onDisconnect.addListener(() => {
            sidePanelConnections.delete(port);
        });
        port.onMessage.addListener((msg) => {
            console.log('--> sidepanel message',msg);
            if (msg.action === 'redirectToUrl') {
                handleRedirectToUrl(msg);
                /* const url = buildRedirectUrl(msg);
                if (url) {
                    chrome.tabs.create({ url });
                } */
            }
        });
    }
});

function handleRedirectToUrl(msg) {
    console.log('handleRedirectToUrl',msg);
    const key = canonicalizeServerUrl(msg?.serverUrl);

    if (key && instanceConnections.has(key)) {
        // Send the message to the correct port/instance
        const instance = instanceConnections.get(key);
        if (instance && instance.port) {
            instance.port.postMessage({
                ...msg,
                serverUrl: key,
                action: 'redirectToUrl',
            });
            const tab = instance.port?.sender?.tab;
            if(tab && tab.windowId){
                chrome.tabs.update(tab.id, { active: true }, function(tab) {
                    // Optionally, focus the window containing the tab
                    chrome.windows.update(tab.windowId, { focused: true });
                });
            }
            //chrome.tabs.update(instance.tabId, { active: true });
            return;
        }
    }else{
        // If no port found, or no serverUrl, open a new tab
        redirectToUrlViaChrome({ ...msg, serverUrl: key || msg?.serverUrl });
    }
    
}

async function setOverlayState(isEnabled) {
    await saveSingleExtensionConfigToCache(CACHE_CONFIG.OVERLAY_ENABLED.key, isEnabled);
    updateContextMenu();
    broadcastMessageToAllInjectedInstances({ action: 'toggleOverlay', enabled: isEnabled });
}

async function updateContextMenu() {
    // Ensure menus exist (and avoid creation races) before updating.
    await ensureContextMenu().catch(() => {});
    const isEnabled = await loadSingleExtensionConfigFromCache(CACHE_CONFIG.OVERLAY_ENABLED.key);
    try { chrome.contextMenus.update(OVERLAY_ENABLE, { enabled: !isEnabled }, () => {}); } catch (e) {}
    try { chrome.contextMenus.update(OVERLAY_DISABLE, { enabled: isEnabled }, () => {}); } catch (e) {}
}

// In-memory cache of compiled include/exclude regex patterns
let _contentScriptPatternsCache = null;
let _contentScriptPatternsCachePromise = null;

// Parse patterns from string (one regex per line)
function parsePatterns(patternString, fallback) {
    let arr = [];
    if (!patternString) {
        arr = fallback;
    } else {
        arr = patternString.split('\n');
    }

    return arr
        .map(line => {
            try {
                const trimmed = line.trim().replace(/^\/+/g, '').replace(/\/+$/g, '');
                if (!trimmed) return null;
                return new RegExp(trimmed);
            } catch (e) {
                return null;
            }
        })
        .filter(Boolean);
}

async function refreshContentScriptPatternsCache() {
    const data = await chrome.storage.local.get([
        'content_script_include_patterns',
        'content_script_exclude_patterns',
    ]);
    const includePatterns = parsePatterns(
        data.content_script_include_patterns,
        DEFAULT_INCLUDE_PATTERNS
    );
    const excludePatterns = parsePatterns(
        data.content_script_exclude_patterns,
        DEFAULT_EXCLUDE_PATTERNS
    );
    _contentScriptPatternsCache = { includePatterns, excludePatterns };
    return _contentScriptPatternsCache;
}

// Get cached patterns (loads once per service-worker lifetime, refreshed via storage.onChanged)
async function getContentScriptPatterns() {
    if (_contentScriptPatternsCache) return _contentScriptPatternsCache;
    if (_contentScriptPatternsCachePromise) return _contentScriptPatternsCachePromise;
    _contentScriptPatternsCachePromise = refreshContentScriptPatternsCache().finally(() => {
        _contentScriptPatternsCachePromise = null;
    });
    return _contentScriptPatternsCachePromise;
}

/**
 * Normalize a URL for pattern matching.
 * - Only allow http/https pages (never inject into chrome-extension://, chrome://, etc.)
 * - Ignore querystring and hash to avoid false positives (e.g. serverUrl=...lightning.force.com)
 */
function normalizeUrlForPatternMatch(rawUrl) {
    try {
        const u = new URL(rawUrl);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        return `${u.origin}${u.pathname}`;
    } catch (e) {
        return null;
    }
}

// Async version of shouldInjectScript
async function shouldInjectScriptAsync(url) {
    const normalizedUrl = normalizeUrlForPatternMatch(url);
    if (!normalizedUrl) return false;
    const { includePatterns, excludePatterns } = await getContentScriptPatterns();
    // Exclude first
    for (const pattern of excludePatterns) {
        if (pattern.test(normalizedUrl)) return false;
    }
    // Then include
    for (const pattern of includePatterns) {
        if (pattern.test(normalizedUrl)) return true;
    }
    return false;
}

// Refresh cached patterns when settings change
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (
        Object.prototype.hasOwnProperty.call(changes, 'content_script_include_patterns') ||
        Object.prototype.hasOwnProperty.call(changes, 'content_script_exclude_patterns')
    ) {
        refreshContentScriptPatternsCache().catch(() => {});
    }
});

function injectToolkit(tabId) {
    // Inject CSS files first
    chrome.scripting.insertCSS(
        {
            target: { tabId: tabId },
            files: [
                'styles/slds-sf-toolkit.css',
                'styles/inject.css',
                'styles/extension.css',
                'styles/web.css',
            ],
        },
        () => {
            // Then inject the JS content script, and set the injected flag
            chrome.scripting.executeScript(
                {
                    target: { tabId: tabId },
                    files: ['scripts/inject_salesforce.js'],
                },
                () => {
                    chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        func: () => {
                            window.__SF_TOOLKIT_SCRIPT_INJECTED = true;
                        },
                    });
                }
            );
        }
    );
}

/** Action Button  */
/* chrome.action.onClicked.addListener(async tab => {
    //console.log('onClicked');
    //handleTabOpening(tab);
}); */

/*** Event Listeners ***/
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === OPEN_SIDE_PANEL) {
        chrome.sidePanel.open({ tabId: tab.id });
    } else if (info.menuItemId === OPEN_TOOLKIT) {
        chrome.tabs.create({ url: chrome.runtime.getURL('views/app.html') });
    } else if (info.menuItemId === OVERLAY_ENABLE) {
        setOverlayState(true);
    } else if (info.menuItemId === OVERLAY_DISABLE) {
        setOverlayState(false);
    }
});

chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
    if (!tabId) return;
    const tab = await chrome.tabs.get(tabId);
    try{
        await handleTabOpening(tab);
    } catch (e) {
        console.error('handleTabOpening issue: ', e);
    }
});

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
    if (!tab.url || info.status !== 'complete') return;
    if (await shouldInjectScriptAsync(tab.url)) {
        chrome.scripting.executeScript(
            {
                target: { tabId: tabId },
                func: () => window.__SF_TOOLKIT_SCRIPT_INJECTED,
            },
            results => {
                if (chrome.runtime.lastError) {
                    injectToolkit(tabId);
                } else if (!results || !results[0] || !results[0].result) {
                    injectToolkit(tabId);
                }
            }
        );
    }
    await handleTabOpening(tab);
});

// In the main message handler, delegate chrome_* actions to chromeApi.js
chrome.runtime.onMessage.addListener(
    wrapAsyncFunction(async (message, sender) => {
        if (message.action === 'launchWebAuthFlow') {
            const responseUrl = await chrome.identity.launchWebAuthFlow({
                url: message.url,
                interactive: true,
            });
            if (chrome.runtime.lastError) {
                console.error('chrome.runtime.lastError', chrome.runtime.lastError);
                return { error: chrome.runtime.lastError.message };
            }
            const url = new URL(responseUrl);
            const code = new URLSearchParams(url.search).get('code');
            return { code };
        } else if (
            ['broadcastMessageToInjected', 'broadcastMessageToSidePanel'].includes(message.action)
        ) {
            const _newMessage = { ...message.content, senderId: sender.id };
            // Debug logs
            if (message.action === 'broadcastMessageToInjected') {
                // Prefer routing to the injected port in the same tab as the sender (side panel's host tab)
                const targetTabId = message.targetTabId;
                if (targetTabId) {
                    const wasSent = sendMessageToInjectedInTab(targetTabId, _newMessage);
                    if (!wasSent) {
                        broadcastMessageToAllInjectedInstances(_newMessage);
                    }
                } else {
                    broadcastMessageToAllInjectedInstances(_newMessage);
                }
            } else if (message.action === 'broadcastMessageToSidePanel') {
                broadcastMessageToAllSidePanelInstances(_newMessage);
            }
        } else if (message.action === OPEN_SIDE_PANEL) {
            openSideBar(sender.tab);
        } else if (message.action === 'fetchCookie') {
            return await getHostAndSession(sender.tab);
        } else if (message.action === 'getDefaultContentScriptPatterns') {
            return {
                includePatterns: DEFAULT_INCLUDE_PATTERNS,
                excludePatterns: DEFAULT_EXCLUDE_PATTERNS,
            };
        } else if (message.action === 'toggleOverlay') {
            broadcastMessageToAllInjectedInstances({
                action: 'toggleOverlay',
                enabled: message.enabled,
            });
        } else if (message.action === 'findExistingSession') {
            return await findExistingSession({ alias: message.alias, instanceUrl: message.instanceUrl });
        } else if (message.action === 'smartinput_enhance_single') {
            // Restrict this endpoint to trusted senders (extension pages or injected Salesforce pages).
            const senderUrl = sender?.url || '';
            const isExtensionPageSender =
                typeof senderUrl === 'string' && senderUrl.startsWith(chrome.runtime.getURL(''));
            const isInjectedSalesforceSender =
                !isExtensionPageSender && !!sender?.tab?.url && (await shouldInjectScriptAsync(sender.tab.url));
            if (!isExtensionPageSender && !isInjectedSalesforceSender) {
                return { error: 'Untrusted sender' };
            }

            const prompt = typeof message?.prompt === 'string' ? message.prompt : '';
            const trimmedPrompt = prompt.trim();
            if (!trimmedPrompt) return { error: 'Missing prompt' };
            if (trimmedPrompt.length > 4000) return { error: 'Prompt too long' };

            const sanitizeBaseUrl = (raw) => {
                const fallback = 'https://api.openai.com/v1';
                const value = (raw || '').trim();
                if (!value) return fallback;
                try {
                    const u = new URL(value);
                    if (u.username || u.password) return fallback;
                    if (u.protocol !== 'https:' && u.protocol !== 'http:') return fallback;
                    if (u.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(u.hostname)) {
                        return fallback;
                    }
                    u.search = '';
                    u.hash = '';
                    u.pathname = (u.pathname || '').replace(/\/+$/, '');
                    return u.toString();
                } catch (e) {
                    return fallback;
                }
            };

            // Read OpenAI config
            const data = await chrome.storage.local.get(['openai_key', 'openai_url']);
            const apiKey = data.openai_key;
            const baseUrl = sanitizeBaseUrl(data.openai_url);
            if (!apiKey) return { error: 'Missing OpenAI key' };
            try {
                const body = {
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: 'You are Smart Input Assistant. Return one concise realistic value suitable for a Salesforce form input. No explanations.' },
                        { role: 'user', content: trimmedPrompt },
                    ],
                    temperature: 0.5,
                    n: 1,
                };
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 20000);
                let resp;
                try {
                    resp = await fetch(`${baseUrl}/chat/completions`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`,
                        },
                        body: JSON.stringify(body),
                        signal: controller.signal,
                    });
                } finally {
                    clearTimeout(timeoutId);
                }
                if (!resp.ok) {
                    const t = await resp.text();
                    return { error: `OpenAI error: ${t}` };
                }
                const json = await resp.json();
                const suggestion = (json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) || '';
                return { suggestion: (suggestion || '').trim() };
            } catch (e) {
                return { error: e.message };
            }
        } else if(message.action.startsWith('chrome_')){
            // Delegate all chrome_* actions to chromeApi.js
            return await handleChromeInteraction(message);
        }
    })
);

/*** On Startup Event (MV3) ***/
chrome.runtime.onStartup.addListener(() => {
    // Service worker can restart; ensure menus exist.
    ensureContextMenu().catch(() => {});
});

/*** On Install/Update Event ***/
chrome.runtime.onInstalled.addListener(async details => {
    console.log('--> onInstalled',details);
    const currentVersion = chrome.runtime.getManifest().version;
    const previousVersion = details.previousVersion;
    const reason = details.reason;
    if (reason === 'install') {
        await chrome.storage.local.set({ installedVersion: currentVersion });
        chrome.tabs.create({
            url: `https://sf-toolkit.com/install?redirect_url=${encodeURIComponent(chrome.runtime.getURL('views/app.html'))}`,
        });
    } else if (
        reason === 'update' &&
        previousVersion &&
        currentVersion &&
        compareMajorMinor(previousVersion, currentVersion)
    ) {
        chrome.tabs.create({ url: 'https://sf-toolkit.com/app?applicationName=release' });
    }
    /* const isEnabled = await loadSingleExtensionConfigFromCache(CACHE_CONFIG.OVERLAY_ENABLED.key);
    if (!data.hasOwnProperty(OVERLAY_ENABLED_VAR)) {
        await saveSingleExtensionConfigToCache(CACHE_CONFIG.OVERLAY_ENABLED.key, true);
    } */
    await ensureContextMenu();
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
        const currentTab = tabs[0];
        chrome.sidePanel.setOptions({
            tabId: currentTab.id,
            path: 'views/default.html',
            enabled: true,
        });
    }
    const data = await chrome.storage.local.get([
        'content_script_include_patterns',
        'content_script_exclude_patterns',
    ]);
    if (!data.content_script_include_patterns) {
        await chrome.storage.local.set({
            content_script_include_patterns: DEFAULT_INCLUDE_PATTERNS.join('\n'),
        });
    }
    if (!data.content_script_exclude_patterns) {
        await chrome.storage.local.set({
            content_script_exclude_patterns: DEFAULT_EXCLUDE_PATTERNS.join('\n'),
        });
    }
    await refreshContentScriptPatternsCache();
});

/*** Commands ***/
chrome.commands.onCommand.addListener((command, tab) => {
    console.log('command',command);
    if (command === OVERLAY_TOGGLE) {
        loadSingleExtensionConfigFromCache(CACHE_CONFIG.OVERLAY_ENABLED.key).then(isEnabled => {
            setOverlayState(!isEnabled);
        });
    } else if (command === OPEN_OVERLAY_SEARCH) {
    } else if (command === OPEN_SIDE_PANEL) {
        chrome.sidePanel.open({ tabId: tab.id });
    }
});

/***** Initialization *****/
const init = async () => {
    chrome.sidePanel
        .setPanelBehavior({ openPanelOnActionClick: true })
        .catch(error => console.error(error));
    // Ensure context menus are available even after service worker restarts.
    ensureContextMenu().catch(() => {});
    refreshContentScriptPatternsCache().catch(() => {});
};

chrome.runtime.setUninstallURL('https://forms.gle/cd8SkEPe5RGTVijJA');

init();

function broadcastMessageToAllInjectedInstances(message) {
    for (const port of injectedConnections) {
        try {
            port.postMessage(message);
        } catch (e) {
            try { injectedConnections.delete(port); } catch (_) {}
        }
    }
}

function broadcastMessageToAllSidePanelInstances(message) {
    for (const port of sidePanelConnections) {
        try {
            port.postMessage(message);
        } catch (e) {
            try { sidePanelConnections.delete(port); } catch (_) {}
        }
    }
}

// Send to only the injected connection that matches the provided tabId. Returns true if a port was found and messaged.
function sendMessageToInjectedInTab(tabId, message) {
    let sent = false;
    try { console.log('[BG] Attempting to send to injected in tab', tabId, 'message.action=', message?.action); } catch (e) {}
    for (const port of injectedConnections.values()) {
        const portTabId = port && port.sender && port.sender.tab && port.sender.tab.id;
        if (portTabId === tabId) {
            try { console.log('[BG] Found injected port for tab', tabId, '- sending message'); } catch (e) {}
            try {
                port.postMessage(message);
            } catch (e) {
                try { injectedConnections.delete(port); } catch (_) {}
                break;
            }
            sent = true;
            break;
        }
    }
    if (!sent) { try { console.log('[BG] No injected port matched tab', tabId); } catch (e) {} }
    return sent;
}