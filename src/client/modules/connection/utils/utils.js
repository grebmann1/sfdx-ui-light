import { isNotUndefinedOrNull } from 'shared/utils';
import { isElectronApp } from 'shared/utils';

import * as webInterface from './web';
import * as electronInterface from './electron';
import {Connector} from './mapping';

export * from './mapping';


export async function connect({alias,settings}){
    // Only connect via the web interface
   let connection = await webInterface.connect({alias,settings});

   console.log('connection',connection);
   /** Get Username **/
   let identity = await connection.identity();
   let header = {};
   if(isNotUndefinedOrNull(identity)){
       header.username = identity.username;
       header.orgId    = identity.organization_id;
       header.userInfo = identity;
   }

   return new Connector(header,connection)
}

export async function getConnection(alias){
    let connection =   isElectronApp()?await electronInterface.getConnection(alias):await webInterface.getConnection(alias);

    let nameArray = (connection.alias || '').split('-');
    let company = nameArray.length > 1 ?nameArray.shift() : '';
    let name    = nameArray.join('-');

    return {
        ...connection,
        company,
        name,
    }
}

export async function addConnection(data,connection){
   if(isElectronApp()) throw new Error ('Only working for Web');
   return await webInterface.addConnection(data,connection);
}

export async function renameConnection(params){
    return await isElectronApp()?electronInterface.renameConnection(params):webInterface.renameConnection(params);
}

export async function removeConnection(alias){
    return await isElectronApp()?electronInterface.removeConnection(alias):webInterface.removeConnection(alias);
}

export async function getAllConnection(){
    let connections =  isElectronApp()?await electronInterface.getAllConnection():await webInterface.getAllConnection();
    console.log('connections',connections);
    return connections.map(x => {
        let nameArray = (x.alias || '').split('-');
        let company = nameArray.length > 1 ?nameArray.shift() : '';
        let name    = nameArray.join('-');
        return {
            ...x,
            company,
            name,
        }
    })
}


export async function getExistingSession(){
    if(sessionStorage.getItem("currentConnection")){
        try{
            let settings = JSON.parse(sessionStorage.getItem("currentConnection"));

            return await connect({settings});
        }catch(e){
            console.error(e);
            return null;
        }
    }
    return null;
}

export async function saveSession(value){
    sessionStorage.setItem("currentConnection",JSON.stringify(value));
}

export async function removeSession(value){
    sessionStorage.removeItem("currentConnection");
}


/** Session Connection **/

export async function oauth(){
    
}

export async function directConnection(sessionId,serverUrl){
    console.log('sessionId,serverUrl',sessionId,serverUrl);
    let params = {
        //oauth2      : {...window.jsforceSettings},
        sessionId   : sessionId,
        serverUrl   : serverUrl,
        proxyUrl    : `${window.location.origin}/proxy/`,
        version     : '55.0'
    }
    
    let connection = await new window.jsforce.Connection(params);

    console.log('connection',connection);
    /** Get Username **/
    let identity = await connection.identity();
    let header = {};
    if(isNotUndefinedOrNull(identity)){
        header.username = identity.username;
        header.orgId    = identity.organization_id;
        header.userInfo = identity;
    }
    console.log('directConnection',header,connection);

    return new Connector(header,connection);
}