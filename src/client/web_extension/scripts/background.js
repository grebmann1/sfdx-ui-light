"use strict";

const getCurrentTab = async () => {
    let queryOptions = { active: true, lastFocusedWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

const isHostMatching = (url) => {
    return url.host.endsWith('lightning.force.com') || url.host.endsWith('salesforce.com') || url.host.endsWith('cloudforce.com');
}

const handleTabOpening = async (tab) => {
    const url = new URL(tab.url);

    /** Remove by default **/
    await chrome.sidePanel.setOptions({
        tabId:tab.id,
        enabled: false
    });

    /**  Filter Tabs **/
    if (isHostMatching(url)) {
        // Salesforce website, ensure the popup is set
        //console.log('onActivated - chrome.action.setPopup');
        //await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
        chrome.action.setPopup({tabId: tab.id, popup: 'views/popup.html'});
    }else{
        //await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
        await chrome.sidePanel.setOptions({
            tabId:tab.id,
            path: 'views/side.html',
            enabled: true
        });
    }
}

/** Init **/
//chrome.action.disable();
/** On Install Event */

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'openSidePanel',
        title: 'Open Salesforce Toolkit',
        contexts: ['all']
    });
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
      console.log(
        `Storage key "${key}" in namespace "${namespace}" changed.`,
        `Old value was "${oldValue}", new value is "${newValue}".`
      );
    }
});


//chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));


/** Event Listener */

chrome.runtime.onConnect.addListener( (port) => {
    //console.log('port',port);
    if(port.name === 'side-panel-connection'){
        port.onDisconnect.addListener(async () => {
            const tab = await getCurrentTab();
            if(isHostMatching(new URL(tab.url))){
                await chrome.sidePanel.setOptions({
                    tabId:tab.id,
                    enabled: false
                });
            }
            
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
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === "launchWebAuthFlow") {
        chrome.identity.launchWebAuthFlow({
            'url': request.url,
            'interactive': true
        }, (responseUrl) => {
            if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError.message });
                return;
            }
            const url   = new URL(responseUrl);
            const code  = (new URLSearchParams(url.search)).get('code'); // Simplified for example
            sendResponse({ code });
        });
        return true;
	}
});

/** Context Menus **/

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'openSidePanel') {
        // This will open the panel in all the pages on the current window.
        chrome.sidePanel.open({ tabId: tab.id });
    }
});

/** Action Button  */
chrome.action.onClicked.addListener((tab) => {
    console.log('on action clicked');
});






/**
chrome.action.onClicked.addListener(async (tab) => {
    console.log('tab',tab);
    const tabId = tab.id;
    const url = new URL(tab.url).origin;
    let cookieStoreId = await chrome.cookies.getAllCookieStores((stores) => {
      var currentStore = stores.find(obj => {
          return obj.tabIds.includes(tabId);
      });
      return currentStore.tabIds[tabId];
  });
    
    let cookieDetails = {
        name: "sid",
        url: url,
        storeId: cookieStoreId,
    };
    
    const cookie = await chrome.cookies.get(cookieDetails);
    console.log('cookie',cookie);
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
    };
    const cookies = await chrome.cookies.getAll(secureCookieDetails);
    console.log('cookies',cookies);
    let sessionCookie = cookies.find((c) => c.value.startsWith(orgId + "!"));
    console.log('sessionCookie',sessionCookie);
    if (!sessionCookie) {
        return;
    }
    chrome.tabs.create({ 
      url: 'https://sf-toolkit.com/extension?sessionId=' + sessionCookie.value+'&serverUrl=https://'+sessionCookie.domain 
    }, tab => { });
});
**/