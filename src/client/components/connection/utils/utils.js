import { isNotUndefinedOrNull,isUndefinedOrNull } from 'shared/utils';
import { isElectronApp } from 'shared/utils';
import constant from "global/constant";
import { Connector } from './mapping';
import * as webInterface from './web';
import * as electronInterface from './electron';
import { store,store_application } from 'shared/store';

export * from './chrome';
export * from './mapping';


export async function connect({alias,settings,disableEvent = false}){
    console.log('--> connect',alias,settings);
    //console.log('util.connect',{alias,settings});
    if(isUndefinedOrNull(settings) && isUndefinedOrNull(alias)){
        throw new Error('You need to provide the alias or the connection');
    }
    

    if(alias){
        console.log('before - getSettings')
        settings = await getSettings(alias);
        console.log('loaded settings',settings);
    }
    
    let params = {
        instanceUrl : settings.instanceUrl,
        accessToken : settings.accessToken,
        proxyUrl    : `${window.location.origin}/proxy/`,
        //version     : settings.instanceApiVersion || constant.apiVersion // This might need to be refactored 
    }

    // Handle Refresh Token
    if(settings.refreshToken){
        params.refreshToken = settings.refreshToken;
        params.oauth2 = { 
            ...window.jsforceSettings,
            loginUrl:settings.instanceUrl
        }
    }

    //console.log('util.connect.connection',params,settings);
    const connection = await new window.jsforce.Connection(params);
          connection.alias = alias || settings.alias;
          connection.on("refresh", async function(accessToken, res) {
                console.log('refresh !!!',settings.accessToken,accessToken);
                let newSettings = {...settings,accessToken};
                await webInterface.setSettings(connection.alias,newSettings);
          });
          
    /** Assign Latest Version **/
    await assignLatestVersion(connection);
    /** Get Username & First connection **/
    const header = await getHeader(connection);
    
    // Dispatch Login Event
    var connector = new Connector(header,connection);

    if(!disableEvent){
        store.dispatch(store_application.login(connector));
    }
    
    
    return connector;
}

async function assignLatestVersion(connection){
    const versions = (await connection.request('/services/data/')).sort((a, b) => b.version.localeCompare(a.version));
    // Initialize;
    connection.version = versions[0].version;
}

async function getHeader(connection){
    const {accessToken,instanceUrl,loginUrl,refreshToken,version} = connection;
    const identity = await connection.identity();
    const header = {
        accessToken,instanceUrl,loginUrl,refreshToken,version,
        id:connection.alias,
        alias:connection.alias,
        sfdxAuthUrl:instanceUrl+'/secur/frontdoor.jsp?sid='+accessToken,
    };

    if(isNotUndefinedOrNull(identity)){
            header.username = identity.username;
            header.orgId    = identity.organization_id;
            header.userInfo = identity;       
    }

    return header;
}


export async function getSettings(alias){
    //console.log('getSettings (isElectronApp)',isElectronApp());
    let connection =   isElectronApp()?await electronInterface.getSettings(alias):await webInterface.getSettings(alias);

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
            // Don't use settings for now, to avoid issues with electron js (see-details need to be called)
            const {alias,...settings} = JSON.parse(sessionStorage.getItem("currentConnection"));
            return await connect({alias});
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

export async function directConnect(sessionId,serverUrl){
    //console.log('sessionId,serverUrl',sessionId,serverUrl);
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
    // Dispatch Login Event
    var connector = new Connector(header,connection);
    store.dispatch(store_application.login(connector));
    return connector;
}