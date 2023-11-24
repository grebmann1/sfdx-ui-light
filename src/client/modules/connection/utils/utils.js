import {isUndefinedOrNull} from 'shared/utils';

export async function connect({alias,connection}){
    if(isUndefinedOrNull(connection) && isUndefinedOrNull(alias)){
        throw new Error('You need to provide the alias or the connection');
    }

    if(alias){
        connection = getConnection(alias);
    }
    console.log('window.jsforce',window.jsforce);
    
    let host = window.location.origin;
    const instance = await new window.jsforce.Connection({
        instanceUrl : connection.instanceUrl,
        accessToken : connection.accessToken,
        proxyUrl: `${host}/proxy/`,
        version:'55.0'
    });
    instance.alias = alias || connection.alias;
    return instance;
}

export async function getConnection(alias){
    let connections = await window.defaultStore.getItem('connections');
    if(isUndefinedOrNull(connections)){
        connections = [];
    }
    return connections.find(x => x.alias === alias);
}

export async function addConnection(data,connection){
    let connections = await window.defaultStore.getItem('connections');
    if(isUndefinedOrNull(connections)){
        connections = [];
    }
    // Remove the duplicate alias
    connections = connections.filter(x => x.alias !== data.alias);
    connections.push(data);
    // Order Connections
    connections = connections.sort((a, b) => a.alias.localeCompare(b.alias));

    window.connections[data.alias] = connection;
    await window.defaultStore.setItem('connections',connections);
}

export async function renameConnection(oldAlias,newAlias){
    let connections = await window.defaultStore.getItem('connections');
    if(isUndefinedOrNull(connections)){
        connections = [];
    }
    // Switch Name
    connections.forEach(conn => {
        if(conn.alias === oldAlias){
            conn.alias = newAlias;
        }
    })
    // Order Connections
    connections = connections.sort((a, b) => a.alias.localeCompare(b.alias));
    // Switch connector
    window.connections[newAlias] = window.connections[oldAlias];
    delete window.connections[oldAlias];

    await window.defaultStore.setItem('connections',connections);
}

export async function removeConnection(alias){
    let connections = await window.defaultStore.getItem('connections');
    if(isUndefinedOrNull(connections)){
        connections = [];
    }
    // Remove the alias
    connections = connections.filter(x => x.alias !== alias);
    // Switch connector
    delete window.connections[alias];

    await window.defaultStore.setItem('connections',connections);
}

export async function getAllConnection(){
    let connections = await window.defaultStore.getItem('connections');
    if(isUndefinedOrNull(connections)){
        connections = [];
    }
    console.log('getAllConnection',connections);
    return connections;
}