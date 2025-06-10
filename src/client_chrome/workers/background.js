/** STATIC **/
const OVERLAY_ENABLE = 'overlay_enable';
const OVERLAY_DISABLE = 'overlay_disable';
const OVERLAY_ENABLE_TITLE = 'Enable Overlay';
const OVERLAY_DISABLE_TITLE = 'Disable Overlay';
const OVERLAY_ENABLED_VAR = 'overlayEnabled';
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
        Object.entries(navigation.state).forEach(([key, value]) => {
            redirectUrl.append(key, value);
        });
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

const getHostAndSession = async tab => {
    try {
        if (!tab.url) return;
        // 1. Get the canonical Salesforce URL for the tab
        let url = getSalesforceURL(tab.url);
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

// Refactored isHostMatching to use the same logic as shouldInjectScriptAsync
async function isHostMatching(url) {
    const { includePatterns, excludePatterns } = await getContentScriptPatterns();
    for (const pattern of excludePatterns) {
        if (pattern.test(url)) return false;
    }
    for (const pattern of includePatterns) {
        if (pattern.test(url)) return true;
    }
    return false;
}

const handleTabOpening = async tab => {
    // Instead of loading the configuration every time, send a message to the background job !!!

    //const configuration = utils.loadExtensionConfigFromCache();
    //const openPopupInSidePanel = configuration.openPopupInSidePanel || false;
    //console.log('handleTabOpening - openPopupInSidePanel',openPopupInSidePanel);

    try {
        const url = new URL(tab.url);
        const path = `views/default.html?${isHostMatching(url) ? 'salesforce' : 'default'}`;
        const existingOptions = await chrome.sidePanel.getOptions({ tabId: tab.id });
        /** Remove by default **/
        if (!existingOptions.enabled) {
            await chrome.sidePanel.setOptions({
                tabId: tab.id,
                enabled: false,
            });
        }

        /**  Filter Tabs **/
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
        await chrome.sidePanel.setOptions({
            tabId: tab.id,
            path: path,
            enabled: true,
        });
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
async function createContextMenu() {
    const data = await chrome.storage.sync.get(OVERLAY_ENABLED_VAR);
    const isEnabled = data.overlayEnabled;
    /* chrome.contextMenus.create({
        id: OPEN_SIDE_PANEL,
        title: 'Open Salesforce Toolkit (side panel)',
        contexts: ['page'],
    }); */

    chrome.contextMenus.create({
        id: OPEN_TOOLKIT,
        title: 'Open Salesforce Toolkit (in new tab)',
        contexts: ['action'],
        enabled: true,
        visible: true,
    });

    chrome.contextMenus.create({
        id: OVERLAY_ENABLE,
        title: OVERLAY_ENABLE_TITLE,
        contexts: ['action'],
        enabled: !isEnabled,
        visible: true,
    });
    chrome.contextMenus.create({
        id: OVERLAY_DISABLE,
        title: OVERLAY_DISABLE_TITLE,
        contexts: ['action'],
        enabled: isEnabled,
        visible: true,
    });
}

const injectedConnections = new Set();
const sidePanelConnections = new Set();
const instanceConnections = new Map();

chrome.runtime.onConnect.addListener(function (port) {
    if (port.name === 'sf-toolkit-instance') {
        const cleanup = (identityKey) => instanceConnections.delete(identityKey);
        port.onMessage.addListener((msg) => {
            let identityKey = msg.serverUrl;//msg.alias || msg.username;
            if (msg.action === 'registerInstance') {
                if (identityKey) {
                    instanceConnections.set(identityKey, {
                        port,
                        serverUrl: msg.serverUrl,
                        alias: msg.alias,
                        username: msg.username,
                    });
                    port.onDisconnect.addListener(() => {
                        if(instanceConnections.has(identityKey)) {
                            cleanup(identityKey);
                        }
                    });
                }
            } else if (msg.action === 'closeConnection') {
                cleanup(identityKey);
                try { port.disconnect(); } catch (e) {}
            }
        });
    } else if (port.name === 'sf-toolkit-injected') {
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
        sidePanelConnections.add(port);
        port.onDisconnect.addListener(() => {
            sidePanelConnections.delete(port);
        });
    }
});

function handleRedirectToUrl(msg) {
    const { serverUrl } = msg;

    if (serverUrl && instanceConnections.has(serverUrl)) {
        // Send the message to the correct port/instance
        const instance = instanceConnections.get(serverUrl);
        if (instance && instance.port) {
            instance.port.postMessage({
                ...msg,
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
        redirectToUrlViaChrome(msg);
    }
    
}

async function setOverlayState(isEnabled) {
    await chrome.storage.sync.set({ overlayEnabled: isEnabled });
    updateContextMenu();
    broadcastMessageToAllInjectedInstances({ action: 'toggleOverlay', enabled: isEnabled });
}

async function updateContextMenu() {
    const data = await chrome.storage.sync.get(OVERLAY_ENABLED_VAR);
    chrome.contextMenus.update(OVERLAY_ENABLE, { enabled: !data.overlayEnabled });
    chrome.contextMenus.update(OVERLAY_DISABLE, { enabled: data.overlayEnabled });
}

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

// Async version to get patterns from storage
async function getContentScriptPatterns() {
    return new Promise(resolve => {
        chrome.storage.local.get(
            ['content_script_include_patterns', 'content_script_exclude_patterns'],
            async data => {
                let includePatterns = parsePatterns(
                    data.content_script_include_patterns,
                    DEFAULT_INCLUDE_PATTERNS
                );
                let excludePatterns = parsePatterns(
                    data.content_script_exclude_patterns,
                    DEFAULT_EXCLUDE_PATTERNS
                );
                resolve({ includePatterns, excludePatterns });
            }
        );
    });
}

// Async version of shouldInjectScript
async function shouldInjectScriptAsync(url) {
    const { includePatterns, excludePatterns } = await getContentScriptPatterns();
    // Exclude first
    for (const pattern of excludePatterns) {
        if (pattern.test(url)) return false;
    }
    // Then include
    for (const pattern of includePatterns) {
        if (pattern.test(url)) return true;
    }
    return false;
}

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
chrome.action.onClicked.addListener(async tab => {
    //console.log('onClicked');
    //handleTabOpening(tab);
});

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
        handleTabOpening(tab);
    } catch (e) {
        console.error('handleTabOpening issue: ', e);
    }
});

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
    if (!tab.url || info.status !== 'complete') return;
    if (info.status === 'complete' && tab.url) {
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
    }
    handleTabOpening(tab);
});

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
            if (message.action === 'broadcastMessageToInjected') {
                broadcastMessageToAllInjectedInstances(_newMessage);
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
        }
    })
);

/*** On Install/Update Event ***/
chrome.runtime.onInstalled.addListener(async details => {
    const currentVersion = chrome.runtime.getManifest().version;
    const previousVersion = details.previousVersion;
    const reason = details.reason;
    if (reason === 'install') {
        await chrome.storage.local.set({ installedVersion: currentVersion });
        chrome.tabs.create({
            url: `https://sf-toolkit.com/install?redirect_url=${encodeURIComponent(chrome.runtime.getURL('views/default.html'))}`,
        });
    } else if (
        reason === 'update' &&
        previousVersion &&
        currentVersion &&
        compareMajorMinor(previousVersion, currentVersion)
    ) {
        chrome.tabs.create({ url: 'https://sf-toolkit.com/app?applicationName=release' });
    }
    const data = chrome.storage.sync.get(OVERLAY_ENABLED_VAR);
    if (!data.hasOwnProperty(OVERLAY_ENABLED_VAR)) {
        await chrome.storage.sync.set({ overlayEnabled: true });
    }
    createContextMenu();
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
        const currentTab = tabs[0];
        chrome.sidePanel.setOptions({
            tabId: currentTab.id,
            path: 'views/default.html',
            enabled: true,
        });
    }
    chrome.storage.local.get(
        ['content_script_include_patterns', 'content_script_exclude_patterns'],
        async data => {
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
        }
    );
});

/*** Commands ***/
chrome.commands.onCommand.addListener((command, tab) => {
    if (command === OVERLAY_TOGGLE) {
        chrome.storage.sync.get(OVERLAY_ENABLED_VAR, data => {
            setOverlayState(!data.overlayEnabled);
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
};

chrome.runtime.setUninstallURL('https://forms.gle/cd8SkEPe5RGTVijJA');

init();

function broadcastMessageToAllInjectedInstances(message) {
    for (const [tabId, port] of injectedConnections.entries()) {
        port.postMessage(message);
    }
}

function broadcastMessageToAllSidePanelInstances(message) {
    for (const [tabId, port] of sidePanelConnections.entries()) {
        port.postMessage(message);
    }
}

function sendMessageToInstance(identityKey, message) {
    const port = instanceConnections.get(identityKey);
    if (port) {
        port.postMessage(message);
    }
}

function getPortByIdentityKey(identityKey) {
    // Search for a port by alias or username
    if (!identityKey) return null;
    // Direct match (most common case)
    if (instanceConnections.has(identityKey)) {
        return instanceConnections.get(identityKey).port;
    }
    // Fallback: search by alias or username in the value
    for (const [key, value] of instanceConnections.entries()) {
        if (value.alias === identityKey || value.username === identityKey) {
            return value.port;
        }
    }
    return null;
}
