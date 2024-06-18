export async function getCurrentTab(){
    let queryOptions = { active: true, lastFocusedWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

export function isEmpty(str) {
    return (!str || str.length === 0 );
}

function extractRecordId(href){
	if(!href) return null;
	try{
		let url = new URL(href);
		// Find record ID from URL
		let searchParams = new URLSearchParams(url.search.substring(1));
		// Salesforce Classic and Console
		if (url.hostname.endsWith(".salesforce.com") || url.hostname.endsWith(".salesforce.mil")) {
			let match = url.pathname.match(/\/([a-zA-Z0-9]{3}|[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})(?:\/|$)/);
			if (match) {
				let res = match[1];
				if (res.includes("0000") || res.length == 3) {
					return match[1];
				}
			}
		}

		// Lightning Experience and Salesforce1
		if (url.hostname.endsWith(".lightning.force.com") || url.hostname.endsWith(".lightning.force.mil") || url.hostname.endsWith(".lightning.crmforce.mil")) {
			let match;

			if (url.pathname == "/one/one.app") {
				// Pre URL change: https://docs.releasenotes.salesforce.com/en-us/spring18/release-notes/rn_general_enhanced_urls_cruc.htm
				match = url.hash.match(/\/sObject\/([a-zA-Z0-9]+)(?:\/|$)/);
			} else {
				match = url.pathname.match(/\/lightning\/[r|o]\/[a-zA-Z0-9_]+\/([a-zA-Z0-9]+)/);
			}
			if (match) {
				return match[1];
			}
		}
		// Visualforce
		{
			let idParam = searchParams.get("id");
			if (idParam) {
				return idParam;
			}
		}
		// Visualforce page that does not follow standard Visualforce naming
		for (let [, p] of searchParams) {
			if (p.match(/^([a-zA-Z0-9]{3}|[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})$/) && p.includes("0000")) {
				return p;
			}
		}
		
	}catch(e){
		console.errror('Error while extracting the recordId')
	}
	return null;
}

export function getRecordId(href) {
	const recordId = extractRecordId(href);
	return recordId && recordId.match(/^([a-zA-Z0-9]{3}|[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})$/)?recordId:null;
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

export function getCurrentObjectType(conn,recordId){
    return new Promise( (resolve,reject) => {
        conn.tooling.executeAnonymous("ID a='" + recordId + "';Integer.valueOf(String.valueOf(a.getSObjectType()));", (err, res) => {
            if (err) { 
                console.err(err);
                reject(err); 
            }else{
                let _sobjectString = res.exceptionMessage.replace(/^.* (.*)$/,'$1');
                resolve(_sobjectString == 'null'?null:_sobjectString);
            }
           
          });
    }) 
}

export function fetch_metadata(conn,sobjectName){
	return new Promise((resolve,reject) => {
		conn.sobject(sobjectName).describe((err, meta) => {
			if (err) {
				console.error(err);
				resolve(null);
			}else{
				resolve(meta)
			}
		});
	});
}

export function fetch_data(conn,sobjectName,recordId){
	return new Promise((resolve,reject) => {
		conn.sobject(sobjectName).retrieve(recordId, (err, record) =>{
			if (err) {
				console.error(err);
				resolve(null);
			}else{
				resolve(record)
			}
		});
	});
}

export function loadConfiguration(text){
	var result = {};

	console.log('text',text);
	try{
		if(!isEmpty(text)){
			result = JSON.parse(text);
			// Add method to reformat the config in case of config issue
		}
	}catch(e){
		console.error('Wrong format for the config !',e);
	}
	return result;
}

export async function loadExtensionConfigFromCache(keys){
	const configuration = {};
	for await (const key of keys){
		configuration[key] = await window.defaultStore.getItem(key);
	}
	return configuration;
}

export async function saveExtensionConfigToCache(config){
	const keys = Object.keys(config);
	for await (const key of keys){
		await window.defaultStore.setItem(key,config[key]);
	}
}

export const PANELS = {
	SALESFORCE : 'salesforce',
	DEFAULT : 'default'
}



export function getObjectSetupLink({host, sobjectName, durableId, isCustomSetting}) {
	if(sobjectName.endsWith("__mdt")) {
		return getCustomMetadataLink(durableId);
	} else if(isCustomSetting) {
		return `${host}/lightning/setup/CustomSettings/page?address=%2F${durableId}?setupid=CustomSettings`;
	} else if(sobjectName.endsWith("__c")) {
		return `${host}/lightning/setup/ObjectManager/${durableId}/Details/view`;
	} else {
		return `${host}/lightning/setup/ObjectManager/${sobjectName}/Details/view`;
	}
}

export function getCustomMetadataLink(durableId) {
	return `${host}/lightning/setup/CustomMetadata/page?address=%2F${durableId}%3Fsetupid%3DCustomMetadata`;
}

export function getObjectFieldsSetupLink({host, sobjectName, durableId, isCustomSetting}) {
    if(sobjectName.endsWith("__mdt")) {
      	return getCustomMetadataLink(durableId);
    } else if(isCustomSetting) {
      	return `${host}/lightning/setup/CustomSettings/page?address=%2F${durableId}?setupid=CustomSettings`;
    } else if(sobjectName.endsWith("__c") || sobjectName.endsWith("__kav")) {
      	return `${host}/lightning/setup/ObjectManager/${durableId}/FieldsAndRelationships/view`;
    } else {
      	return `${host}/lightning/setup/ObjectManager/${sobjectName}/FieldsAndRelationships/view`;
    }
}
export function getObjectListLink({host, sobjectName, keyPrefix, isCustomSetting}) {
    if(sobjectName.endsWith("__mdt")) {
      	return `${host}/lightning/setup/CustomMetadata/page?address=%2F${keyPrefix}`;
    } else if(isCustomSetting) {
      	return `${host}/lightning/setup/CustomSettings/page?address=%2Fsetup%2Fui%2FlistCustomSettingsData.apexp?id=${keyPrefix}`;
    } else {
      	return `${host}/lightning/o/${sobjectName}/list`;
    }
}
export function getRecordTypesLink({host, sobjectName, durableId}) {
    if(sobjectName.endsWith("__c") || sobjectName.endsWith("__kav")) {
      	return `${host}/lightning/setup/ObjectManager/${durableId}/RecordTypes/view`;
    } else {
      	return `${host}/lightning/setup/ObjectManager/${sobjectName}/RecordTypes/view`;
    }
}
export function getObjectDocLink(sobjectName,isUsingToolingApi){
    if(isUsingToolingApi){
      	return `https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/tooling_api_objects_${sobjectName.toLowerCase()}.htm`;
    }
    return `https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_${sobjectName.toLowerCase()}.htm`;
}

export const chromeOpenInWindow = async (targetUrl,groupName,incognito = false,newWindow = false) => {
	const windows = await chrome.windows.getAll({populate: false, windowTypes: ['normal']});
	for (let w of windows) {
		if ((w.incognito && incognito || !incognito) && !newWindow) {
			// Use this window.
			let tab = await chrome.tabs.create({url: targetUrl, windowId: w.id});
			let groups = await chrome.tabGroups.query({windowId:w.id}) || [];
			let group = groups.find(g => g.title === groupName);
			if (group) {
				// Group exists, add the tab to this group
				chrome.tabs.group({groupId: group.id, tabIds: tab.id}, () => {
					console.log(`Tab added to existing group '${groupName}'`);
				});
			} else {
				// Group does not exist, create a new group with this tab
				chrome.tabs.group({createProperties: {}, tabIds: tab.id}, (newGroupId) => {
					chrome.tabGroups.update(newGroupId, {title: groupName}, () => {
						console.log(`New group '${groupName}' created and tab added`);
					});
				});
			}
			return;
		}
	}
	const new_window = await chrome.windows.create({url: targetUrl, incognito: incognito});
	if(new_window){
		chrome.tabs.query({windowId: new_window.id}, async (tabs) => {
			// There should be only one tab in the new window
			const tabId = tabs[0].id;
			const newGroupId = await chrome.tabs.group({createProperties: {windowId:new_window.id},tabIds: tabId});
			chrome.tabGroups.update(newGroupId, {title: groupName}, () => {
				console.log(`New group '${groupName}' created and tab added`);
			});
		});
	}else{
		console.warning('You need to Authorize the extension to have access to Incognito');
	}
	
}

export const CACHE_CONFIG = {
	CONFIG_POPUP:'openAsPopup',
	OPENAI_ASSISTANT_ID:'openai_assistant_id',
	OPENAI_KEY:'openai_key',
	SHORTCUT_RECORDID:'shortcut_recordid',
	SHORTCUT_INJECTION_ENABLED:'shortcut_injection_enabled',
	EXPERIENCE_CLOUD_LOGINAS_INCOGNITO:'experienceCloudLoginAsIncognito'
}
