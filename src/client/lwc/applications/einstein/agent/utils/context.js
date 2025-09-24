import { isNotUndefinedOrNull, isChromeExtension } from 'shared/utils';
import LOGGER from 'shared/logger';
// Accept store and LOGGER as arguments for all context functions

async function getCurrentGlobalContext(store) {
    const state = store.getState();
    const connector = state?.application?.connector;
    const currentApplication = state?.application?.currentApplication;
    const isLoggedIn = isNotUndefinedOrNull(connector);
    let email = 'Not available';
    let displayName = 'Not available';
    let instanceUrl = 'Not available';
    let alias = 'Not available';
    if (isLoggedIn && connector?.configuration) {
        const userInfo = connector.configuration.userInfo || {};
        email = userInfo.email || 'Not available';
        displayName = userInfo.display_name || 'Not available';
        instanceUrl = connector.configuration.instanceUrl || 'Not available';
        alias = connector.configuration.alias || 'Not available';
    }
    let contextText = `## SF Toolkit (Saleforce Context)`;
    contextText += `\nUser is logged in: ${isLoggedIn}`;
    contextText += `\nUser: ${displayName} (${email})`;
    contextText += `\nOrg Alias: ${alias}`;
    contextText += `\nInstance URL: ${instanceUrl}`;
    contextText += `\nCurrent Application: ${currentApplication}`;
    if (isChromeExtension()) {
        contextText += `\n${await chromeContext()}`;
    }
    return contextText;
}

function getCurrentApplicationContext(store) {
    const state = store.getState();
    const currentApplication = state?.application?.currentApplication;
    switch(currentApplication){
        case 'soql/app':
            return soqlContext(store);
        case 'anonymousApex/app':
            return apexContext(store);
        case 'api/app':
            return apiContext(store);
        case 'agent': // Limited mode
            return sidePanelContext();
        default:
            return '';
    }
}

function apexContext(store) {
    const apex = store.getState().apex;
    LOGGER.log('apex',apex);
    const currentTab = apex?.currentTab;
    let contextText = `Current Apex Tab: ${currentTab?.id}`;
    contextText += `\n${JSON.stringify(currentTab)}`;
    const tabs = apex?.tabs;
    if(tabs?.length > 0){
        contextText += `\nAll Apex Tabs: ${tabs.length}`;
        contextText += `\n${JSON.stringify(tabs)}`;
    }
    return contextText;
}

function soqlContext(store) {
    const soql = store.getState().soql;
    LOGGER.log('soql',soql);
    let contextText = `Current SOQL Tab: ${soql?.currentTab?.id}`;
    contextText += `\n${JSON.stringify(soql?.currentTab)}`;
    const tabs = soql?.tabs;
    if(tabs?.length > 0){
        contextText += `\nAll SOQL Tabs: ${tabs.length}`;
        contextText += `\n${JSON.stringify(tabs)}`;
    }
    return contextText;
}

function apiContext(store) {
    const api = store.getState().api;
    LOGGER.log('api',api);
    let contextText = `Current API Tab: ${api?.currentTab?.id}`;
    contextText += `\n${JSON.stringify(api?.currentTab)}`;
    const tabs = api?.tabs;
    if(tabs?.length > 0){
        contextText += `\nAll API Tabs: ${tabs.length}`;
        contextText += `\n${JSON.stringify(tabs)}`;
    }
    return contextText;
}

function sidePanelContext() {
    let contextText = 'You are working in the side panel of the Salesforce Toolkit.';
    contextText += `\nYou are working in Limited mode.`;
    return contextText;
}

async function chromeContext() {
    if (!isChromeExtension()) {
        return 'Chrome API is not available in this environment.';
    }
    try {
        const currentWindow = await window.chrome.windows.getCurrent({ populate: true });
        const tabs = await window.chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs && tabs[0] ? tabs[0] : null;
        let contextText = '## Chrome Context:';
        if (currentWindow) {
            contextText += `\nCurrent Window: ${JSON.stringify({
                id: currentWindow.id,
                incognito: currentWindow.incognito,
                tabs: currentWindow.tabs.map(t => ({
                    id: t.id,
                    title: t.title,
                    url: t.url,
                    groupId: t.groupId,
                })),
                totalTabs: currentWindow.tabs.length,
            })}`;
        }
        if (currentTab) {
            contextText += `\nCurrent Tab: ${JSON.stringify({
                id: currentTab.id,
                title: currentTab.title,
                url: currentTab.url,
            })}`;
        }
        if (!currentWindow && !currentTab) {
            contextText += '\nNo active window or tab found.';
        }
        return contextText;
    } catch (err) {
        return `Error retrieving Chrome context: ${err.message}`;
    }
}

const Context = {
    getCurrentGlobalContext,
    getCurrentApplicationContext,
    apexContext,
    soqlContext,
    apiContext,
    sidePanelContext,
    chromeContext
};

export default Context;
