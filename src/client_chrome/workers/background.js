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

/** Variables */

// Code is duplicated in the shared module, but we need to keep it here for now !!!

const getCurrentTabCookieStoreId = async tabId => {
    const stores = await chrome.cookies.getAllCookieStores();

    const currentStore = stores.find(obj => {
        return obj.tabIds.includes(tabId);
    });
    return currentStore.id;
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
        console.log('getHostAndSession issue: ', e);
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
    Promise.resolve(listener(request, sender)).then(sendResponse);
    return true;
};

/** Context Menus **/
async function createContextMenu() {
    const data = await chrome.storage.sync.get(OVERLAY_ENABLED_VAR);
    const isEnabled = data.overlayEnabled;

    // Create Launcher via right click
    chrome.contextMenus.create({
        id: OPEN_SIDE_PANEL,
        title: 'Open Salesforce Toolkit',
        contexts: ['page'],
    });

    // Add Enable Feature menu item
    chrome.contextMenus.create({
        id: OVERLAY_ENABLE,
        title: OVERLAY_ENABLE_TITLE,
        contexts: ['action'],
        enabled: !isEnabled,
        visible: true,
    });

    // Add Disable Feature menu item
    chrome.contextMenus.create({
        id: OVERLAY_DISABLE,
        title: OVERLAY_DISABLE_TITLE,
        contexts: ['action'],
        enabled: isEnabled,
        visible: true,
    });
}

async function setOverlayState(isEnabled) {
    await chrome.storage.sync.set({ overlayEnabled: isEnabled });
    updateContextMenu();
}

async function updateContextMenu() {
    const data = await chrome.storage.sync.get(OVERLAY_ENABLED_VAR);
    // Update the visibility of context menu items
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

/** Event Listener */

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === OPEN_SIDE_PANEL) {
        // This will open the panel in all the pages on the current window.
        chrome.sidePanel.open({ tabId: tab.id });
    } else if (info.menuItemId === OVERLAY_ENABLE) {
        setOverlayState(true);
    } else if (info.menuItemId === OVERLAY_DISABLE) {
        setOverlayState(false);
    }
});

chrome.runtime.onConnect.addListener(port => {
    //console.log('port',port);
    if (port.name === 'side-panel-connection') {
        port.onDisconnect.addListener(async () => {
            //console.log('disconnect listener')
            /*const tab = await getCurrentTab();
            if(isHostMatching(new URL(tab.url))){
                await chrome.sidePanel.setOptions({
                    tabId:tab.id,
                    enabled: false
                });
            }*/
        });
    }
});

chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
    if (!tabId) return;
    const tab = await chrome.tabs.get(tabId);
    handleTabOpening(tab);
});

// Update injection logic to use async version
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
    if (!tab.url || info.status !== 'complete') return;

    if (info.status === 'complete' && tab.url) {
        if (await shouldInjectScriptAsync(tab.url)) {
            // Prevent multiple injections: check if already injected
            chrome.scripting.executeScript(
                {
                    target: { tabId: tabId },
                    func: () => window.__SF_TOOLKIT_SCRIPT_INJECTED,
                },
                results => {
                    if (chrome.runtime.lastError) {
                        // If error (e.g., no results), proceed with injection
                        injectToolkit(tabId);
                    } else if (!results || !results[0] || !results[0].result) {
                        injectToolkit(tabId);
                    } else {
                        // Already injected, do nothing
                    }
                }
            );
        }
    }
    // Handle tab opening
    handleTabOpening(tab);
});

chrome.runtime.onMessage.addListener(
    wrapAsyncFunction(async (message, sender) => {
        if (message.action === 'launchWebAuthFlow') {
            const responseUrl = await chrome.identity.launchWebAuthFlow({
                url: message.url,
                interactive: true,
            });
            //console.log('responseUrl',responseUrl);
            if (chrome.runtime.lastError) {
                return { error: chrome.runtime.lastError.message };
            }
            const url = new URL(responseUrl);
            const code = new URLSearchParams(url.search).get('code'); // Simplified for example
            return { code };
        } else if (message.action === 'broadcastMessage') {
            // Broadcast the message to all other components
            message.senderId = sender.id;
            chrome.runtime.sendMessage(message);
        } else if (message.action === OPEN_SIDE_PANEL) {
            openSideBar(sender.tab);
        } else if (message.action === 'fetchCookie') {
            const cookieInfo = await getHostAndSession(sender.tab);
            console.log('cookieInfo', cookieInfo);
            return cookieInfo;
        } else if (message.action === 'getDefaultContentScriptPatterns') {
            // Return the default patterns as arrays of strings
            return {
                includePatterns: DEFAULT_INCLUDE_PATTERNS,
                excludePatterns: DEFAULT_EXCLUDE_PATTERNS,
            };
        }
    })
);

/** On Install Event */
chrome.runtime.onInstalled.addListener(async details => {
    const currentVersion = chrome.runtime.getManifest().version;
    const previousVersion = details.previousVersion;
    const reason = details.reason;
    // Get the previously stored version

    if (reason === 'install') {
        // Store the current version
        await chrome.storage.local.set({ installedVersion: currentVersion });
        // Open the installation page in a new tab
        chrome.tabs.create({
            url: `https://sf-toolkit.com/install?redirect_url=${encodeURIComponent(chrome.runtime.getURL('views/default.html'))}`,
        });
    } else if (reason === 'update' && previousVersion !== currentVersion) {
        // Open the release notes page
        chrome.tabs.create({ url: 'https://sf-toolkit.com/app?applicationName=release' });
    }

    // Create Menu based on configuration & if variable already exist
    const data = chrome.storage.sync.get(OVERLAY_ENABLED_VAR);
    if (!data.hasOwnProperty(OVERLAY_ENABLED_VAR)) {
        await chrome.storage.sync.set({ overlayEnabled: true });
    }
    createContextMenu();

    // Update tabs
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
        console.log('enable for current tab');
        const currentTab = tabs[0];
        chrome.sidePanel.setOptions({
            tabId: currentTab.id,
            path: 'views/default.html',
            enabled: true,
        });
    }

    // Initialize content script patterns if not set
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

/** Commands **/

chrome.commands.onCommand.addListener((command, tab) => {
    if (command === OVERLAY_TOGGLE) {
        chrome.storage.sync.get(OVERLAY_ENABLED_VAR, data => {
            // toggle the value
            setOverlayState(!data.overlayEnabled);
        });
    } else if (command === OPEN_OVERLAY_SEARCH) {
        console.log('-----> Open Search !!!');
    } else if (command === OPEN_SIDE_PANEL) {
        console.log('-----> Open Panel !!!');
        chrome.sidePanel.open({ tabId: tab.id });
    }
});

/***********************************************/
/***********************************************/
/***********************************************/
/***********************************************/
/***********************************************/

const init = async () => {
    chrome.sidePanel
        .setPanelBehavior({ openPanelOnActionClick: true })
        .catch(error => console.error(error));
};

// Handle uninstallation
chrome.runtime.setUninstallURL('https://forms.gle/cd8SkEPe5RGTVijJA');

/***********************************************/
/***********************************************/
/***********************************************/
/******************** Init *********************/

init();
