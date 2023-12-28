"use strict";
chrome.runtime.onInstalled.addListener(() => {
  // disable the action by default
  chrome.action.disable();

  // remove existing rules so only ours are applied
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    // add a custom rule
    chrome.declarativeContent.onPageChanged.addRules([
      {
        // define the rule's conditions
        conditions: [
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostSuffix: 'lightning.force.com', schemes: ['https'] }
          }),
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostSuffix: 'salesforce.com', schemes: ['https'] }
          }),
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostSuffix: 'cloudforce.com', schemes: ['https'] }
          }),
        ],
        // show the action when conditions are met
        actions: [new chrome.declarativeContent.ShowAction()],
      },
    ]);
  });
});


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

    let sessionCookie = cookies.find((c) => c.value.startsWith(orgId + "!"));
    if (!sessionCookie) {
        return;
    }
    chrome.tabs.create({ url: 'https://sf-toolkit.com/extension?sessionId=' + sessionCookie.value+'&serverUrl=https://'+sessionCookie.domain }, tab => { });
});
