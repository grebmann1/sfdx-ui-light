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
    console.log('debugMode',debugMode);
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