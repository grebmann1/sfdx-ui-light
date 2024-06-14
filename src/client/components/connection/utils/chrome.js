const getCurrentTab = async () => {
    let queryOptions = { active: true, lastFocusedWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}


const getHostAndSession = async () => {
    try{
        let tab = await getCurrentTab();
        let url = new URL(tab.url);
        let cookieStoreId = await getCurrentTabCookieStoreId(tab.id);
        
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
        //console.log('secureCookieDetails',secureCookieDetails);
        const cookies = await chrome.cookies.getAll(secureCookieDetails);
        //console.log('cookies',cookies);
        let sessionCookie = cookies.find((c) => c.value.startsWith(orgId + "!"));


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
}



const getCurrentTabCookieStoreId = async (tabId) => {
    chrome.cookies.getAllCookieStores((stores) => {
        var currentStore = stores.find(obj => {
            return obj.tabIds.includes(tabId);
        });
        return currentStore.tabIds[tabId];
    });
}



export {getHostAndSession,getCurrentTab};

