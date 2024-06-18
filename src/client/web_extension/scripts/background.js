"use strict";
//import * as utils from './utils.js';

/** Variables */
const CONFIG_POPUP = 'openAsPopup';
//var config = {};

/** Methods */

/*const getCurrentTab = async () => {
    let queryOptions = { active: true, lastFocusedWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}*/

const isHostMatching = (url) => {
    // This should be optimized in the futur !
    const hosts = ['my.salesforce.com','lightning.force.com','cloudforce.com','lightning.force.com.mcas.ms'];
    return hosts.reduce((previous,host) => url.host.endsWith(host) || previous,false) || url.href.includes(`${url.host}/s/`);
    //return url.host.endsWith('lightning.force.com') || url.host.endsWith('salesforce.com') || url.host.endsWith('cloudforce.com');
}

const handleTabOpening = async (tab) => {
    
    //const config = loadConfiguration();
    // Instead of loading the configuration every time, send a message to the background job !!!

    //const configuration = utils.loadExtensionConfigFromCache();
    //const openPopupInSidePanel = configuration.openPopupInSidePanel || false;
    //console.log('handleTabOpening - openPopupInSidePanel',openPopupInSidePanel);
    const openAsPopup = false;//config[CONFIG_POPUP];
    //console.log('openAsPopup',config,openAsPopup);
    try{
        const url = new URL(tab.url);

        const existingOptions = await chrome.sidePanel.getOptions({tabId:tab.id});
        /** Remove by default **/
        if(!existingOptions.enabled){
            await chrome.sidePanel.setOptions({
                tabId:tab.id,
                enabled: false
            });
        }
        

        /**  Filter Tabs **/
        if (isHostMatching(url)) {
            if(openAsPopup){
                // Popup Panel ### Deprecated for now !
                await chrome.sidePanel.setOptions({
                    tabId:tab.id,
                    enabled: false
                });
                await chrome.action.setPopup({tabId: tab.id, popup: 'views/popup.html?panel=salesforce'});
            }else{
                // Side Panel
                await chrome.sidePanel.setOptions({
                    tabId:tab.id,
                    path: 'views/side.html?panel=salesforce',
                    enabled: true
                });
                await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
            }
            
        }else{
            await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
            await chrome.sidePanel.setOptions({
                tabId:tab.id,
                path: 'views/side.html?panel=default',
                enabled: true
            });
        }
    }catch(e){
        console.log('Issue handleTabOpening',e);
    }
}


const loadConfiguration = async () => {
    const items = [CONFIG_POPUP];
    const data = await chrome.storage.local.get(items);
    const configuration = {};
    items.forEach(item => {
        configuration[item] = data[item];
    })
    console.log('loadConfiguration',configuration);
    return configuration;
}



/** On Install Event */
chrome.runtime.onInstalled.addListener(() => {
    // Create Menu
    chrome.contextMenus.create({
        id: 'openSidePanel',
        title: 'Open Salesforce Toolkit',
        contexts: ['all']
    });
    // Update tabs
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        chrome.sidePanel.setOptions({
            tabId:currentTab.id,
            path: 'views/side.html',
            enabled: true
        });
    });
});




/** Event Listener */
/*
chrome.storage.onChanged.addListener((changes, namespace) => {
    for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
      console.log(
        `Storage key "${key}" in namespace "${namespace}" changed.`,
        `Old value was "${oldValue}", new value is "${newValue}".`
      );
    }
});
*/
  
chrome.runtime.onConnect.addListener( (port) => {
    //console.log('port',port);
    if(port.name === 'side-panel-connection'){
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
chrome.action.onClicked.addListener(async (tab) => {
    console.log('onClicked');
    //handleTabOpening(tab);
});

/***********************************************/
/***********************************************/
/***********************************************/
/***********************************************/
/***********************************************/



const init = async () => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));
    //config = await loadConfiguration();
}


/***********************************************/
/***********************************************/
/***********************************************/
/******************** Init *********************/

init();
