import { isNotUndefinedOrNull } from 'shared/utils';
import { isElectronApp } from 'shared/utils';
import constant from "global/constant";
import * as webInterface from './web';
import * as electronInterface from './electron';
import {Connector} from './mapping';

export * from './mapping';


export async function connect({alias,settings}){
    // Only connect via the web interface
    
   let connection = await webInterface.connect({alias,settings});
   /** Get Username & First connection **/
   let identity = await connection.identity();
   let header = {};
   if(isNotUndefinedOrNull(identity)){
        header.alias    = connection.alias;
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

export async function oauth({alias,loginUrl},callback){
    
    window.jsforce.browserClient = new window.jsforce.browser.Client(Date.now()); // Reset
    window.jsforce.browserClient.init(window.jsforceSettings);
    window.jsforce.browserClient.on('connect', async (connection) =>{
        const {accessToken,instanceUrl,loginUrl,refreshToken,version} = connection;
        let nameArray = alias.split('-');
        let companyName = nameArray.length > 1 ?nameArray.shift() : '';
        let name = nameArray.join('-');
        let header = {
            accessToken,instanceUrl,loginUrl,refreshToken,version,
            id:alias,
            alias:alias,
            company:companyName.toUpperCase(),
            name:name,
            sfdxAuthUrl:instanceUrl+'/secur/frontdoor.jsp?sid='+accessToken,
        };

        /** Get Username **/
        let identity = await connection.identity();
        if(isNotUndefinedOrNull(identity)){
            header.username = identity.username;
            header.orgId    = identity.organization_id;
            header.userInfo = identity;
        }
        await addConnection(header,connection);
        let connector = new Connector(header,connection);
        callback({alias,connector})//this.close({alias:alias,connection});
    });

    window.jsforce.browserClient.login({
        ...window.jsforceSettings,
        loginUrl,
        version:constant.apiVersion,
        scope:'id api web openid sfap_api refresh_token'
    },(_,res) => {
        if(res.status === 'cancel'){
            //this.close(null)
            callback(null);
        }
    });
}

export async function directConnection(sessionId,serverUrl){
    console.log('sessionId,serverUrl',sessionId,serverUrl);
    let params = {
        //oauth2      : {...window.jsforceSettings},
        sessionId   : sessionId,
        serverUrl   : serverUrl,
        proxyUrl    : `${window.location.origin}/proxy/`,
        version     : constant.apiVersion
    }
    
    let connection = await new window.jsforce.Connection(params);

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