import {isUndefinedOrNull,isEmpty} from 'shared/utils';



const formatConnectionItem = (item) => {
    return item; // Keep for now
    /*const { accessToken,instanceUrl,loginUrl,refreshToken,version } = item;
    return { 
        accessToken,
        instanceUrl,
        loginUrl,
        refreshToken,
        //version
    };*/
}

const formatConnections = (connections) => {
    return connections.map(x => formatConnectionItem(x));
}


export async function getConnection(alias){
    let connections = await window.defaultStore.getItem('connections') || [];
    return connections.find(x => x.alias === alias);
}

export async function setConnection(alias,connection){
    let connections = await window.defaultStore.getItem('connections') || [];
    let index = connections.findIndex(x => x.alias === alias);
    if(index >= 0){
        connections[index] = connection;
    }else{
        connections.push(connection);
    }
    // Order Connections
    connections = connections.sort((a, b) => a.alias.localeCompare(b.alias));

    await window.defaultStore.setItem('connections',formatConnections(connections));
}

export async function setAllConnection(connections){
    await window.defaultStore.setItem('connections',formatConnections(connections));
}

export async function renameConnection({oldAlias,newAlias,username,redirectUrl}){
    let connections = await window.defaultStore.getItem('connections') || [];

    // Switch Name
    connections.forEach(conn => {
        if(conn.alias === oldAlias){
            conn.alias = newAlias;
            conn.redirectUrl = redirectUrl;
        }
    })
    // Order Connections
    connections = connections.sort((a, b) => a.alias.localeCompare(b.alias));

    await window.defaultStore.setItem('connections',formatConnections(connections));
}

export async function removeConnection(alias){
    let connections = await window.defaultStore.getItem('connections') || [];
    // Remove the alias
    connections = connections.filter(x => x.alias !== alias);

    await window.defaultStore.setItem('connections',formatConnections(connections));
}

export async function getAllConnection(){
    let connections = await window.defaultStore.getItem('connections') || [];
    // Mapping
    connections = connections.map(x => {
        let instanceUrl = x.instanceUrl && !x.instanceUrl.startsWith('http')? `https://${x.instanceUrl}`:x.instanceUrl;
        let sfdxAuthUrl = x.refreshToken && x.instanceUrl?`force://${window.jsforceSettings.clientId}::${x.refreshToken}@${(new URL(x.instanceUrl)).host}`:null;
        let _isRedirect = !isEmpty(x.redirectUrl);

       return {
            ...x,
            ...{
                instanceUrl,
                sfdxAuthUrl,
                _isRedirect
            }
       }
    });

    //console.log('connections',connections);

    return connections;
}