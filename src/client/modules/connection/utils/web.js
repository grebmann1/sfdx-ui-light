import {isUndefinedOrNull} from 'shared/utils';
import constant from "global/constant";
export async function connect({alias,settings}){
    if(isUndefinedOrNull(settings) && isUndefinedOrNull(alias)){
        throw new Error('You need to provide the alias or the connection');
    }

    if(alias){
        settings = getConnection(alias);
    }
    
    let params = {
        oauth2      : {...window.jsforceSettings},
        instanceUrl : settings.instanceUrl,
        accessToken : settings.accessToken,
        proxyUrl    : `${window.location.origin}/proxy/`,
        version     : constant.apiVersion
    }
    if(settings.refreshToken){
        params.refreshToken = settings.refreshToken;
    }
    
    const connection = await new window.jsforce.Connection(params);
          connection.alias = alias || settings.alias;
          connection.on("refresh", function(accessToken, res) {
            // Refresh event will be fired when renewed access token
            // to store it in your storage for next request
            console.log('refresh token',accessToken,res)
          });
    return connection;
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
    console.log('getAllConnection',connections);
    return connections;
}