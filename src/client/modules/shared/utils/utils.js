
export { classSet } from './classSet';
export * from './salesforce';
export * from './normalize';

export function isUndefinedOrNull(value) {
    return value === null || value === undefined;
}

export function isNotUndefinedOrNull(value) {
    return !isUndefinedOrNull(value);
}

export function isEmpty(str) {
    return (!str || str.length === 0 );
}

export function decodeError({name, message}){
    const e = new Error(message)
        e.name = name
    return e
}

export function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }

    return (
        s4() +
        s4() +
        '-' +
        s4() +
        '-' +
        s4() +
        '-' +
        s4() +
        '-' +
        s4() +
        s4() +
        s4()
    );
}
export function groupBy(items,key){
    return items.reduce((x, y) => {
        (x[y[key]] = x[y[key]] || []).push(y);
        return x;
    }, {});
}

export function chunkArray(arr,chunkSize = 5){
    const chunks = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        const chunk = arr.slice(i, i + chunkSize);
        chunks.push(chunk);
    }
    return chunks;
}

export async function getAllOrgs(debugMode = false){
    if(debugMode){
        return [
            {
                id:'DEMO-B2C',
                username:'DEMO-B2C@test.com',
                company:'DEMO',
                name:'B2C',
                alias:'DEMO-B2C'
            }
        ] 
    }
    let res = await window.electron.ipcRenderer.invoke('org-getAllOrgs');
        res = res.sort((a, b) => a.alias.localeCompare(b.alias));
        res = res.map((item,index) => {
            return {
                ...item,
                ...{
                    id:item.alias,
                    username:item.value,
                    company:`${item.alias.split('-').length > 1?item.alias.split('-').shift():''}`.toUpperCase(),
                    name:item.alias.split('-').pop()
                }
            }
        })
    return res;
}

export function chunkPromises(arr, size, method) {
    if (!Array.isArray(arr) || !arr.length) {
        return Promise.resolve([]);
    }
  
    size = size ? size : 10;
  
    const chunks = [];
    for (let i = 0, j = arr.length; i < j; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
  
    let collector = Promise.resolve([]);
    for (const chunk of chunks) {
        collector = collector.then((results) =>
            Promise.all(chunk.map((params) => method(params))).then(
                (subResults) =>results.concat(subResults)
            )
        );
    }
    return collector;
};

const buffer = {}
export function runActionAfterTimeOut(value, action,{timeout = 300} = {}) {
    if (buffer._clearBufferId) {
        clearTimeout(buffer._clearBufferId);
    }
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    buffer._clearBufferId = setTimeout(() => {
        action(value);
    }, timeout);
}

export function timeout(interval) {
    return new Promise(resolve => {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(resolve, interval);
    });
}

export const isElectronApp = () => {
    return isNotUndefinedOrNull(window.electron);
}

export const isChromeExtension = () => {
    return isNotUndefinedOrNull(chrome?.windows);
}

export function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export function getCurrentRank(mapping,check){
    for (let i = 0; i < mapping.length; i++) {
        if(check(mapping[i])){
            return i;
        }
    }
    return mapping.length - 1;
}

export function escapeRegExp(str) {
    if (!str) return '';
    return str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}


export function basicTextFormatter(text,filter){
    var regex = new RegExp('('+filter+')','gim');
    if(regex.test(text)){
        text = text.toString().replace(regex,`<span style="font-weight:Bold; color:blue;">$1</span>`);
    }
    return text;
}

const languageMapping = {
    css: 'css',
    scss: 'scss',
    js: 'javascript',
    json: 'json',
    md: 'markdown',
    ts: 'typescript',
    txt: 'text',
    apex: 'java', // We map apex to JAVA,
    cls: 'java', // We map cls to JAVA
    xml: 'xml',
    design: 'xml', // We map cls to xml
    trigger:'apex',
    html:'html',
    page:'html',
    auradoc:'html',
    cmp:'html',
    png:'png',
    svg:'xml'
}

export function getLanguage(extension){
    return languageMapping.hasOwnProperty(extension)?languageMapping[extension]:null;
}

export function formatFiles(files){
    return [...files].map(file =>{
      const extension = file?.name.includes('.')?file?.name.split('.').pop():null;
      return { 
        ...file,
        ...{
          extension:extension, // we remove the '.' for the editor
          language:getLanguage(extension)
        }
      }
    })
}

export function sortObjectsByField(objects, field, order) {
    // Define a map for storing the order of each element
    const orderMap = {};
    order.forEach((item, index) => {
        orderMap[item] = index;
    });

    // Sort function
    return objects.sort((a, b) => {
        // Get the order index, default to a large number if the item is not in the order array
        const orderA = orderMap.hasOwnProperty(a[field]) ? orderMap[a[field]] : 999;
        const orderB = orderMap.hasOwnProperty(b[field]) ? orderMap[b[field]] : 999;

        // Compare the order indices
        return orderA - orderB;
    });
}

export function removeDuplicates(arr, prop) {
    const unique = new Set();
    const result = arr.filter((item) => {
        const val = item[prop];
        const isPresent = unique.has(val);
        unique.add(val);//always add
        return !isPresent;
    });
    return result;
}

export function getFromStorage(item,byDefault){
    try{
        const parsedItem = JSON.parse(item);
        return isUndefinedOrNull(parsedItem)?byDefault:parsedItem;
    }catch(e){
        return byDefault;
    }
}
/*
export function goToUrl(conn,redirectUrl){
    let url = conn.instanceUrl+'/secur/frontdoor.jsp?sid='+conn.accessToken;
    if(redirectUrl){
        url+=`&retURL=${encodeURIComponent(redirectUrl)}`
    }
    window.open(url,'_blank');
}
*/
export function checkIfPresent(a,b){
    return (a || '').toLowerCase().includes((b||'').toLowerCase());
}

export function isSalesforceId(str) {
    // Salesforce ID pattern
    var idPattern = /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/;

    // Check if the string matches the Salesforce ID pattern
    return idPattern.test(str);
}

export function download(data,type,filename){
    console.log('download');
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const download = document.createElement('a');
        download.href = window.URL.createObjectURL(blob);
        download.download = filename;
        download.click();
    URL.revokeObjectURL(url);
}