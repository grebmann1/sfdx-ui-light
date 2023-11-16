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

export async function getAllOrgs(){
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

export function isEmpty(x){
    return x == undefined || x == '';
}