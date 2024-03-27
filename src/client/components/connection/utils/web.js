import {isUndefinedOrNull} from 'shared/utils';



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


export async function renameConnection({oldAlias,newAlias,username}){
    let connections = await window.defaultStore.getItem('connections') || [];

    // Switch Name
    connections.forEach(conn => {
        if(conn.alias === oldAlias){
            conn.alias = newAlias;
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
        // fix data issues
        if(!x.instanceUrl.startsWith('http')){
            x.instanceUrl = `https://${x.instanceUrl}`; 
        }
        return {
            ...x,
            sfdxAuthUrl:`force://${window.jsforceSettings.clientId}::${x.refreshToken}@${(new URL(x.instanceUrl)).host}`,
        }
    })

    return connections;
}