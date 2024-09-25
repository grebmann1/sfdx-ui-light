/** STATIC **/
const OVERLAY_ENABLE = 'overlay_enable';
const OVERLAY_DISABLE = 'overlay_disable';
const OVERLAY_ENABLE_TITLE = 'Enable Overlay';
const OVERLAY_DISABLE_TITLE = 'Disable Overlay';
const OVERLAY_ENABLED_VAR = 'overlayEnabled';
const OVERLAY_TOGGLE  = 'overlay_toggle';
// Opening Actions
const OPEN_OVERLAY_SEARCH = 'open_overlay_search';
const OPEN_SIDE_PANEL = 'open_side_panel';

/** Variables */

const getCurrentTabCookieStoreId = async (tabId) => {
    const stores = await chrome.cookies.getAllCookieStores();
    const currentStore = stores.find(obj => {
        return obj.tabIds.includes(tabId);
    });
    return currentStore.tabIds[tabId];
};

const getHostAndSession = async (tab) => {
    try{
        let cookieStoreId = await getCurrentTabCookieStoreId(tab.id);
        let url = new URL(tab.url);
        let cookieDetails = {
            name: "sid",
            url: url.origin,
            storeId: cookieStoreId,
        };
        //console.log('tab',tab);
        const cookie = await chrome.cookies.get(cookieDetails);
        if (!cookie) {
            return;
        }

        // try getting all secure cookies from salesforce.com and find the one matching our org id
        // (we may have more than one org open in different tabs or cookies from past orgs/sessions)

        let [orgId] = cookie.value.split("!");
        let secureCookieDetails = {
            name: "sid",
            secure: true,
            storeId: cookieStoreId,
            domain: "salesforce.com"
            //url:`https:${url.host}` // Investigate if it's better
        };

        const cookies = await chrome.cookies.getAll(secureCookieDetails);
        //console.log('cookies',cookies);
        let sessionCookie = cookies.find((c) => c.value.startsWith(orgId + "!"));
        console.log('sessionCookie',sessionCookie);
        if (!sessionCookie) {
            return;
        }
        return {
            domain: sessionCookie.domain,
            session: sessionCookie.value,
        };
    }catch(e){
        console.log('getHostAndSession issue: ',e);
        return;
    }
};

const isHostMatching = (url) => {
    // This should be optimized in the futur !
    const hosts = ['my.salesforce.com', 'lightning.force.com', 'cloudforce.com', 'lightning.force.com.mcas.ms'];
    return hosts.reduce((previous, host) => url.host.endsWith(host) || previous, false) || url.href.includes(`${url.host}/s/`);
    //return url.host.endsWith('lightning.force.com') || url.host.endsWith('salesforce.com') || url.host.endsWith('cloudforce.com');
};

const handleTabOpening = async (tab) => {

    // Instead of loading the configuration every time, send a message to the background job !!!

    //const configuration = utils.loadExtensionConfigFromCache();
    //const openPopupInSidePanel = configuration.openPopupInSidePanel || false;
    //console.log('handleTabOpening - openPopupInSidePanel',openPopupInSidePanel);

    try {
        const url = new URL(tab.url);

        const existingOptions = await chrome.sidePanel.getOptions({tabId: tab.id});
        /** Remove by default **/
        if (!existingOptions.enabled) {
            await chrome.sidePanel.setOptions({
                tabId: tab.id,
                enabled: false
            });
        }


        /**  Filter Tabs **/
        await chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true});
        await chrome.sidePanel.setOptions({
            tabId: tab.id,
            path: `views/default.html?${isHostMatching(url) ? 'salesforce' : 'default'}`,
            enabled: true
        });
    } catch (e) {
        //console.log('Issue handleTabOpening',e);
    }
};

const openSideBar = async (tab) => {
    await chrome.sidePanel.open({ tabId: tab.id });
    await chrome.sidePanel.setOptions({
        tabId: tab.id,
        path: `views/default.html?salesforce`,
        enabled: true
    });
};

/** On Install Event */
chrome.runtime.onInstalled.addListener(async () => {

    // Create Menu based on configuration & if variable already exist
    const data = chrome.storage.sync.get(OVERLAY_ENABLED_VAR);
    if(!data.hasOwnProperty(OVERLAY_ENABLED_VAR)){
        await chrome.storage.sync.set({ overlayEnabled: true });
    }
    createContextMenu();

    // Update tabs
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if(tabs.length > 0){
        console.log('enable for current tab');
        const currentTab = tabs[0];
        chrome.sidePanel.setOptions({
            tabId: currentTab.id,
            path: 'views/default.html',
            enabled: true
        });
    }

});


/** Commands **/

chrome.commands.onCommand.addListener((command,tab) => {
    if (command === OVERLAY_TOGGLE) {
        chrome.storage.sync.get(OVERLAY_ENABLED_VAR, (data) => {
            // toggle the value
            setOverlayState(!data.overlayEnabled);
        })
    }else if(command === OPEN_OVERLAY_SEARCH){
        console.log('-----> Open Search !!!')
    }else if(command === OPEN_SIDE_PANEL){
        console.log('-----> Open Panel !!!');
        chrome.sidePanel.open({tabId: tab.id});
    }
});




/** Context Menus **/
async function createContextMenu() {
    const data = await chrome.storage.sync.get(OVERLAY_ENABLED_VAR);
    const isEnabled = data.overlayEnabled;

    // Create Launcher via right click
    chrome.contextMenus.create({
        id: OPEN_SIDE_PANEL,
        title: 'Open Salesforce Toolkit',
        contexts: ['page']
    });

    // Add Enable Feature menu item
    chrome.contextMenus.create({
        id: OVERLAY_ENABLE,
        title: OVERLAY_ENABLE_TITLE,
        contexts: ["action"],
        enabled: !isEnabled,
        visible: true
    });

    // Add Disable Feature menu item
    chrome.contextMenus.create({
        id: OVERLAY_DISABLE,
        title: OVERLAY_DISABLE_TITLE,
        contexts: ["action"],
        enabled: isEnabled,
        visible: true
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

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === OPEN_SIDE_PANEL) {
        // This will open the panel in all the pages on the current window.
        chrome.sidePanel.open({tabId: tab.id});
    }else if (info.menuItemId === OVERLAY_ENABLE) {
        setOverlayState(true);
    } else if (info.menuItemId === OVERLAY_DISABLE) {
        setOverlayState(false);
    }
});

/** Action Button  */
chrome.action.onClicked.addListener(async (tab) => {
    //console.log('onClicked');
    //handleTabOpening(tab);
});

/** Event Listener */

chrome.runtime.onConnect.addListener((port) => {
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

chrome.tabs.onActivated.addListener(async ({tabId, windowId}) => {
    if (!tabId) return;
    const tab = await chrome.tabs.get(tabId);
    handleTabOpening(tab);

});
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
    if (!tab.url || info.status !== 'complete') return;
    handleTabOpening(tab);
});

// Message Listener
/*chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "launchWebAuthFlow") {
        chrome.identity.launchWebAuthFlow({
            'url': message.url,
            'interactive': true
        }, (responseUrl) => {
            if (chrome.runtime.lastError) {
                sendResponse({error: chrome.runtime.lastError.message});
                return;
            }
            const url = new URL(responseUrl);
            const code = (new URLSearchParams(url.search)).get('code'); // Simplified for example
            sendResponse({code});
        });
        return true;
    } else if (message.action === 'broadcastMessage') {
        // Broadcast the message to all other components
        message.senderId = sender.id;
        chrome.runtime.sendMessage(message);
    }else if(message.action === OPEN_SIDE_PANEL){
        openSideBar(sender);
    }else if(message.action === 'fetchCookie'){
        const tab = await chrome.tabs.get(tabId);
        sendResponse(getHostAndSession(sender.id));
    }
});*/
const wrapAsyncFunction = (listener) => (request,sender,sendResponse) => {
    Promise.resolve(listener(request,sender)).then(sendResponse);
    return true;
}
chrome.runtime.onMessage.addListener(wrapAsyncFunction(async (message, sender) => {
    if (message.action === "launchWebAuthFlow") {
        const responseUrl = await chrome.identity.launchWebAuthFlow({
            'url': message.url,
            'interactive': true
        });
        console.log('responseUrl',responseUrl);
        if (chrome.runtime.lastError) {
            return {error: chrome.runtime.lastError.message};
        }
        const url = new URL(responseUrl);
        const code = (new URLSearchParams(url.search)).get('code'); // Simplified for example
        return {code};
    } else if (message.action === 'broadcastMessage') {
        // Broadcast the message to all other components
        message.senderId = sender.id;
        chrome.runtime.sendMessage(message);
    }else if(message.action === OPEN_SIDE_PANEL){
        openSideBar(sender.tab);
    }else if(message.action === 'fetchCookie'){
        return await getHostAndSession(sender.tab);
    }
}));


/***********************************************/
/***********************************************/
/***********************************************/
/***********************************************/
/***********************************************/


const init = async () => {
    chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true}).catch((error) => console.error(error));
};


/***********************************************/
/***********************************************/
/***********************************************/
/******************** Init *********************/

init();
//# sourceMappingURL=background.js.map
