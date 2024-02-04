import {isUndefinedOrNull} from 'shared/utils';

export async function getSettings(alias){
    let connections = await window.defaultStore.getItem('connections');
    if(isUndefinedOrNull(connections)){
        connections = [];
    }
    return connections.find(x => x.alias === alias);
}

export async function setSettings(alias,settings){
    let connections = await window.defaultStore.getItem('connections');
    let index = connections.findIndex(x => x.alias === alias);
    connections[index] = settings;
    await window.defaultStore.setItem('connections',connections);
}

export async function addConnection(data,connection){
    let connections = await window.defaultStore.getItem('connections') || [];
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

export async function renameConnection({oldAlias,newAlias,username}){
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
    return connections;
}