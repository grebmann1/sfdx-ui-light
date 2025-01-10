export async function getCurrentTab() {
    let queryOptions = {active: true, lastFocusedWindow: true};
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

export function isEmpty(str) {
    return (!str || str.length === 0);
}

export function getSobject(href) {
    let url = new URL(href);
    if (url.pathname && url.pathname.endsWith("/list")) {
        let sobject = url.pathname.substring(0, url.pathname.lastIndexOf("/list"));
        sobject = sobject.substring(sobject.lastIndexOf("/") + 1);
        return sobject;
    }
    return null;
}

export function getSfPathFromUrl(href) {
    let url = new URL(href);
    if (url.protocol.endsWith("-extension:")) {
        return "/";
    }
    return url.pathname;
}

export function getCurrentObjectType(conn, recordId) {
    return new Promise((resolve, reject) => {
        conn.tooling.executeAnonymous("ID a='" + recordId + "';Integer.valueOf(String.valueOf(a.getSObjectType()));")
            .then(res => {
                let _sobjectString = res.exceptionMessage.replace(/^.* (.*)$/, '$1');
                resolve(_sobjectString == 'null' ? null : _sobjectString);
            })
            .catch(e => {
                console.err(err);
                reject(err);
            })
    })
}


export function loadConfiguration(text) {
    var result = {};

    //console.log('text',text);
    try {
        if (!isEmpty(text)) {
            result = JSON.parse(text);
            // Add method to reformat the config in case of config issue
        }
    } catch (e) {
        console.error('Wrong format for the config !', e);
    }
    return result;
}

export const PANELS = {
    SALESFORCE: 'salesforce',
    DEFAULT: 'default'
};

export const chromeOpenInWindow = async (targetUrl, groupName, incognito = false, newWindow = false) => {
    const windows = await chrome.windows.getAll({populate: false, windowTypes: ['normal']});
    for (let w of windows) {
        if ((w.incognito && incognito || !incognito) && !newWindow) {
            // Use this window.
            let tab = await chrome.tabs.create({url: targetUrl, windowId: w.id});
            let groups = await chrome.tabGroups.query({windowId: w.id}) || [];
            let group = groups.find(g => g.title === groupName);
            if (group) {
                // Group exists, add the tab to this group
                chrome.tabs.group({groupId: group.id, tabIds: tab.id}, () => {
                    //console.log(`Tab added to existing group '${groupName}'`);
                });
            } else {
                // Group does not exist, create a new group with this tab
                chrome.tabs.group({createProperties: {}, tabIds: tab.id}, (newGroupId) => {
                    chrome.tabGroups.update(newGroupId, {title: groupName}, () => {
                        //console.log(`New group '${groupName}' created and tab added`);
                    });
                });
            }
            return;
        }
    }
    const new_window = await chrome.windows.create({url: targetUrl, incognito: incognito});
    if (new_window) {
        chrome.tabs.query({windowId: new_window.id}, async (tabs) => {
            // There should be only one tab in the new window
            const tabId = tabs[0].id;
            const newGroupId = await chrome.tabs.group({createProperties: {windowId: new_window.id}, tabIds: tabId});
            chrome.tabGroups.update(newGroupId, {title: groupName}, () => {
                //console.log(`New group '${groupName}' created and tab added`);
            });
        });
    } else {
        console.warning('You need to Authorize the extension to have access to Incognito');
    }
};
