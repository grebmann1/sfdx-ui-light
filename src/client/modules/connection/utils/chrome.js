import { getCurrentTab, isEmpty } from 'shared/utils';
/*const getCurrentTab = async () => {
    let queryOptions = { active: true, lastFocusedWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}*/

const getHostAndSession = async () => {
    try {
        let tab = await getCurrentTab();
        let url = new URL(tab.url);
        let cookieStoreId = await getCurrentTabCookieStoreId(tab.id);

        let cookieDetails = {
            name: 'sid',
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

        let [orgId] = cookie.value.split('!');
        let secureCookieDetails = {
            name: 'sid',
            secure: true,
            storeId: cookieStoreId,
            domain: 'salesforce.com',
            //url:`https:${url.host}` // Investigate if it's better
        };
        //console.log('secureCookieDetails',secureCookieDetails);
        const cookies = await chrome.cookies.getAll(secureCookieDetails);
        // Might hold an expired cookie, so we need to filter it out (TODO)
        let sessionCookie = cookies.find(c => c.value.startsWith(orgId + '!'));

        if (!sessionCookie) {
            return;
        }

        return {
            domain: `${sessionCookie.domain}${isEmpty(url.port) ? '' : `:${url.port}`}`,
            session: sessionCookie.value,
        };
    } catch (e) {
        console.log('getHostAndSession issue: ', e);
        /** To be removed, only for development **/
        /*return {
            session:'00DHr0000074EN7!ARYAQC.svEahDG8iLsqkAf5Aj2qlceiBVRiELevf5hTUTDKVCAzJBkCsHcRlVbJeihSQ9MHj7zHuXBhW47janaeP7IZZWLVv',
            domain:'storm-454b5500dfa9a9.my.salesforce.com'
        }*/
        return;
    }
};

const getCurrentTabCookieStoreId = async tabId => {
    chrome.cookies.getAllCookieStores(stores => {
        var currentStore = stores.find(obj => {
            return obj.tabIds.includes(tabId);
        });
        return currentStore.tabIds[tabId];
    });
};

export { getHostAndSession, getCurrentTab };
