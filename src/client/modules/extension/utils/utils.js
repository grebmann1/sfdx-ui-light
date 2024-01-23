export async function getCurrentTab(){
    let queryOptions = { active: true, lastFocusedWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

export function getRecordId(href) {
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
	return null;
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
				reject(err);
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
				reject(err);
			}else{
				resolve(record)
			}
		});
	});
}
