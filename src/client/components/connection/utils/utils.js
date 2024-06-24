import { isNotUndefinedOrNull,isUndefinedOrNull } from 'shared/utils';
import { isElectronApp } from 'shared/utils';
import constant from "global/constant";
import { Connector } from './mapping';
import * as webInterface from './web';
import * as electronInterface from './electron';
import { store,store_application } from 'shared/store';

export * from './chrome';
export * from './mapping';

const PROXY_EXCLUSION = [];

export function extractConfig(config){
    // Regular expression pattern to match the required parts
    const regex = /force:\/\/([^:]+)::([^@]+)@(.+)/;
    
    // Extracting variables using regex
    const matches = config.match(regex);
    if (matches && matches.length === 4) {
        // Destructuring matches to extract variables
        const [,clientId, refreshToken, instanceUrl] = matches;
        
        // Returning the extracted variables
        return { clientId, refreshToken, instanceUrl };
    }
    return null;
}

export async function connect({alias,settings,disableEvent = false, directStorage = false}){
    console.log('--> connect',alias,settings);
    if(isUndefinedOrNull(settings) && isUndefinedOrNull(alias)){
        throw new Error('You need to provide the alias or the connection');
    }
    

    if(alias){
        console.log('before - getConnection')
        let _settings = await getConnection(alias);
        if(_settings){
            settings = _settings;
        }
        console.log('loaded settings',settings);
    }else{
        alias = settings.alias; 
    }
    
    let params = {
        instanceUrl : settings.instanceUrl,
        accessToken : settings.accessToken,
        proxyUrl    : window.jsforceSettings.proxyUrl, // For chrome extension, we run without proxy
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

    /** Assign Latest Version **/
    await assignLatestVersion(connection);
   

    const header = await generateHeader({alias,connection});
    /** Handler Connection Error and save it */
    if(header._hasError){
        console.log('alias',alias,connection.alias,header);
        await webInterface.setConnection(connection.alias,header);
        return null;
    }


    if(directStorage){
        await webInterface.setConnection(connection.alias,header);
    }
    
    connection.on("refresh", async function(accessToken, res) {
        console.log('refresh !!!',settings.accessToken,accessToken);
        /*let newHeader = {
            ...header,
            accessToken
        };*/
        //await webInterface.setConnection(connection.alias,newHeader);
    });
    
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


export async function getConnection(alias){
    //console.log('getConnection (isElectronApp)',isElectronApp());
    let connection =   isElectronApp()?await electronInterface.getConnection(alias):await webInterface.getConnection(alias);
    if(connection){
        let nameArray = (connection.alias || '').split('-');
        let company = nameArray.length > 1 ?nameArray.shift() : '';
        let name    = nameArray.join('-');
    
        return {
            ...connection,
            company,
            name,
        }
    }
    return null;
    
}

export async function setAllConnection(params){
    return webInterface.setAllConnection(params);
}

export async function renameConnection(params){
    return await isElectronApp()?electronInterface.renameConnection(params):webInterface.renameConnection(params);
}

export async function removeConnection(alias){
    return await isElectronApp()?electronInterface.removeConnection(alias):webInterface.removeConnection(alias);
}

export async function getAllConnection(){
    let connections =  isElectronApp()?await electronInterface.getAllConnection():await webInterface.getAllConnection();
    //console.log('connections',connections);
    // To be removed, only for testing
    /*if(connections == null || connections.length == 0){
        console.log('FAKE Connections')
        return [1,2,3,4,5,7,8,9,10].map(x => ({
            alias:`Test-${x}-Prod`,
            company:`Test-${x}`,
            name:'Prod',
            id:`Test-${x}-Prod`,
            username:`Test-${x}-Prod@salesforce.com`
        }));
    }*/
    return connections.map(x => {
        let nameArray = (x.alias || '').split('-');
        let company = nameArray.length > 1 ?nameArray.shift() : '';
        let name    = nameArray.join('-');
        return {
            ...x,
            company,
            name,
            id:x.alias, // To investigate in case of issues
            _connectVariant:x._hasError?'brand-outline':'brand',
            _connectLabel:x._hasError?'Authorize':'Connect',
            _connectAction:x._hasError?'authorize':'login'
        }
    })
}


export async function getExistingSession(){
    if(sessionStorage.getItem("currentConnection")){
        try{
            // Don't use settings for now, to avoid issues with electron js (see-details need to be called)
            console.log('sessionStorage.getItem("currentConnection")',JSON.parse(sessionStorage.getItem("currentConnection")));
            const settings = JSON.parse(sessionStorage.getItem("currentConnection"));
            // Using {alias,...settings} before, see if it's better now
            return isElectronApp()?await connect({alias:settings.alias}):await connect({settings});
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


export async function oauth_chrome({alias,loginUrl},callback,callbackErrorHandler){

    const oauth2 = new window.jsforce.OAuth2({
        clientId : window.jsforceSettings.clientId,
        redirectUri : chrome.identity.getRedirectURL(),
        loginUrl : loginUrl
    });

    const finalUrl = oauth2.getAuthorizationUrl({ prompt:'login consent',scope : 'id api web openid sfap_api refresh_token' });  
    chrome.runtime.sendMessage({
        action: "launchWebAuthFlow",
        url:finalUrl
    },async (response) => {
        const { code } = response;
        //console.log('code',code);
        if(isUndefinedOrNull(code)) return;
        
        const connection = new window.jsforce.Connection({ oauth2 });
        try{
            const userInfo = await connection.authorize(code);
            //console.log('userInfo',userInfo);
            oauth_extend({alias,connection},callback);
        }catch(e){
            callbackErrorHandler(e);
        }
        

    });
}

export async function oauth({alias,loginUrl},callback,callbackErrorHandler){
    
    window.jsforce.browserClient = new window.jsforce.browser.Client(Date.now()); // Reset
    //console.log('window.jsforceSettings',window.jsforceSettings);
    window.jsforce.browserClient.init(window.jsforceSettings);
    window.jsforce.browserClient.on('connect', async (connection) =>{
        oauth_extend({alias,connection},callback);
    });

    window.jsforce.browserClient.login({
        ...window.jsforceSettings,
        loginUrl,
        version:constant.apiVersion,
        scope:'id api web openid sfap_api refresh_token'
    },(_,res) => {
        console.log('res',res);
        if(res.status === 'cancel'){
            //this.close(null)
            callback(null);
        }
    });
}

async function generateHeader({alias,connection}){
    console.log('generateHeader');
    
    let nameArray = alias.split('-');
    let companyName = nameArray.length > 1 ?nameArray.shift() : '';
    let name = nameArray.join('-');
    let header = {
        id:alias,
        alias:alias,
        company:companyName.toUpperCase(),
        name:name,
    };

    if(connection){
        const {
            accessToken,instanceUrl,loginUrl,refreshToken,version,username,orgId,userInfo,
            _isInjected
        } = connection;
        header = {
            ...header,
            username,orgId,userInfo,
            accessToken,instanceUrl,loginUrl,refreshToken,version,
            _isInjected,
            sfdxAuthUrl:`force://${window.jsforceSettings.clientId}::${refreshToken}@${(new URL(instanceUrl)).host}`
        }

        /** Get Username **/
        try{
            let identity = await connection.identity();
            if(isNotUndefinedOrNull(identity)){
                header.username = identity.username;
                header.orgId    = identity.organization_id;
                header.userInfo = identity;
            }
        }catch(e){
            console.log('Identity Fetch Error',e);
            header._hasError = true;
            header._errorMessage = e.message;
        }
        
    }
    return header;
}

export async function setRedirectCredential({alias,redirectUrl},callback){
    console.log('redirect_credential');
    const header = await generateHeader({alias});
          header.redirectUrl = redirectUrl;

    await webInterface.setConnection(alias,header);
    callback();
        
}

async function oauth_extend({alias,connection},callback){
    console.log('oauth_extend');
    const header = await generateHeader({alias,connection});
    await webInterface.setConnection(alias,header);
    let connector = new Connector(header,connection);
    callback({alias,connector});//this.close({alias:alias,connection});
}

export async function directConnect(sessionId,serverUrl){
    console.log('directConnect');
    let params = {
        //oauth2      : {...window.jsforceSettings},
        sessionId   : sessionId,
        serverUrl   : serverUrl,
        proxyUrl    : window.jsforceSettings?.proxyUrl || 'https://sf-toolkit.com/proxy/', // variable initialization might be too slow 
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
        header.alias    = identity.username; // Replacing the alias to take advantage of the cache
    }
    // Dispatch Login Event
    var connector = new Connector(header,connection);
    store.dispatch(store_application.login(connector));
    return connector;
}