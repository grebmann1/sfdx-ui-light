import { isNotUndefinedOrNull,isUndefinedOrNull } from 'shared/utils';
import { isElectronApp,isObject,isChromeExtension } from 'shared/utils';
import constant from "core/constant";
import { Connector } from './mapping';
import * as webInterface from './web';
import * as electronInterface from './electron';
import { store,APPLICATION } from 'core/store';

export * from './chrome';
export * from './mapping';

const PROXY_EXCLUSION = [];
const FULL_SCOPE = 'id api web openid sfap_api einstein_gpt_api refresh_token';

function extractName(alias){
    let nameArray = (alias || '').split('-');
    return {
        company:nameArray.length > 1 ?nameArray.shift() : '',
        name:nameArray.join('-')
    }
}

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
    //console.log('--> connect',alias,settings);
    if(isUndefinedOrNull(settings) && isUndefinedOrNull(alias)){
        throw new Error('You need to provide the alias or the connection');
    }
    

    if(alias){
        //console.log('before - getConfiguration')
        let _settings = await getConfiguration(alias);
        if(_settings){
            settings = _settings;
        }
        //console.log('loaded settings',settings);
    }else{
        alias = settings?.alias; 
    }

    // Prevent issue
    if(settings.version === '42.0'){
        settings.version = constant.apiVersion;
    }
    
    let params = {
        instanceUrl : settings.instanceUrl,
        accessToken : settings.accessToken,
        proxyUrl    : window.jsforceSettings.proxyUrl, // For chrome extension, we run without proxy
        version     : settings.version || constant.apiVersion, // This might need to be refactored 

        //logLevel:'DEBUG',
        logLevel: null//'DEBUG',
    }

    // Handle Refresh Token
    if(settings.refreshToken){
        params.refreshToken = settings.refreshToken;
        params.oauth2 = { 
            ...window.jsforceSettings,
            loginUrl:settings.instanceUrl
        }
    }
    //console.log('params',params);
    const connection = await new window.jsforce.Connection(params);
        connection.alias = alias || settings.alias;
    /** Assign Latest Version **/
    //await assignLatestVersion(connection);
   
    console.log('{alias,connection}',{alias,connection});
    const configuration = await generateConfiguration({alias,connection});
    /** Handler Connection Error and save it */
    if(configuration._hasError){
        await webInterface.saveConfiguration(connection.alias,configuration);
        return null;
    }

    if(directStorage){
        await webInterface.saveConfiguration(connection.alias,configuration);
    }
    
    connection.on("refresh", async function(accessToken, res) {
        //console.log('refresh !!!',settings.accessToken,accessToken);
    });
    
    // Dispatch Login Event
    const connector = new Connector(configuration,connection);
    if(!disableEvent){
        store.dispatch(APPLICATION.reduxSlice.actions.login({connector}));
    }
    
    return connector;
}



export async function getConfiguration(alias){
    //console.log('getConfiguration (isElectronApp)',isElectronApp());
    let connection = isElectronApp()?await electronInterface.getConfiguration(alias):await webInterface.getConfiguration(alias);
    if(connection){
        const {name,company} = extractName(alias);
        return {
            ...connection,
            company,
            name,
        }
    }
    return null;
    
}

export async function setConfigurations(params){
    return webInterface.setConfigurations(params);
}

export async function renameConfiguration(params){
    return await isElectronApp()?electronInterface.renameConfiguration(params):webInterface.renameConfiguration(params);
}

export async function removeConfiguration(alias){
    return await isElectronApp()?electronInterface.removeConfiguration(alias):webInterface.removeConfiguration(alias);
}


export async function getConfigurations(){
    let connections =  isElectronApp()?await electronInterface.getConfigurations():await webInterface.getConfigurations();
    //console.log('connections',connections);
    // To be removed, only for testing
    /*if(connections == null || connections.length == 0){
        //console.log('FAKE Connections')
        return [1,2,3,4,5,7,8,9,10].map(x => ({
            alias:`Test-${x}-Prod`,
            company:`Test-${x}`,
            name:'Prod',
            id:`Test-${x}-Prod`,
            username:`Test-${x}-Prod@salesforce.com`
        }));
    }*/
    return connections.map(x => {
        const {name,company} = extractName(x.alias);
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
            //console.log('sessionStorage.getItem("currentConnection")',JSON.parse(sessionStorage.getItem("currentConnection")));
            const settings = JSON.parse(sessionStorage.getItem("currentConnection"));
                settings.logLevel = null;
                console.log('settings',settings);
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
        loginUrl : loginUrl,
    });

    const finalUrl = oauth2.getAuthorizationUrl({ prompt:'consent',scope : FULL_SCOPE });  
    chrome.runtime.sendMessage({
        action: "launchWebAuthFlow",
        url:finalUrl
    },async (response) => {
        const { code } = response;
        //console.log('code',code);
        if(isUndefinedOrNull(code)) return;
        
        const connection = new window.jsforce.Connection({ oauth2 });
        try{
            await connection.authorize(code);
            //console.log('userInfo',userInfo);
            oauth_extend({alias,connection},callback);
        }catch(e){
            callbackErrorHandler(e);
        }
    });
}

export async function oauth({alias,loginUrl},callback,callbackErrorHandler){
    //console.log('oauth');
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
        scope:FULL_SCOPE
    },(_,res) => {
        //console.log('res',res);
        if(res.status === 'cancel'){
            //this.close(null)
            callback(null);
        }
    });
}

async function generateConfiguration({alias,connection,redirectUrl}){
    
    const {name,company} = extractName(alias);
    let configuration = {
        id:alias,
        alias,
        company:company.toUpperCase(),
        name,
        redirectUrl
    };
    if(connection){
        const {
            accessToken,instanceUrl,loginUrl,refreshToken,version,username,orgId,userInfo,
            _isInjected
        } = connection;

        Object.assign(configuration,{
            username,
            orgId,
            userInfo,
            accessToken,
            instanceUrl,
            loginUrl,
            refreshToken,
            version,
            _isInjected,
            sfdxAuthUrl:`force://${window.jsforceSettings.clientId}::${refreshToken}@${(new URL(instanceUrl)).host}`
        });
        
        /** Get Username **/
        try{
            let identity = await connection.identity();
            if(isNotUndefinedOrNull(identity)){
                Object.assign(configuration,{
                    username :identity.username,
                    orgId: identity.organization_id,
                    userInfo: identity
                });
            }
        }catch(e){
            console.error(e);
            Object.assign(configuration,{
                _hasError :true,
                _errorMessage:  e.message
            });
        }
        
    }
    return configuration;
}

export async function setRedirectCredential({alias,redirectUrl},callback){
    //console.log('redirect_credential');
    const configuration = await generateConfiguration({alias,redirectUrl});
    await webInterface.saveConfiguration(alias,configuration);

    callback();
}

async function oauth_extend({alias,connection},callback){
    //console.log('oauth_extend');
    const configuration = await generateConfiguration({alias,connection});
    await webInterface.saveConfiguration(alias,configuration);
    const connector = new Connector(configuration,connection);
    callback({alias,connector});//this.close({alias:alias,connection});
}

export async function directConnect(sessionId,serverUrl){
    console.log('window.jsforceSettings?.proxyUrl',window.jsforceSettings?.proxyUrl);
    let params = {
        //oauth2      : {...window.jsforceSettings},    
        sessionId   : sessionId,
        serverUrl   : serverUrl,
        proxyUrl    : isChromeExtension()?null:(window.jsforceSettings?.proxyUrl || 'https://sf-toolkit.com/proxy/'), // variable initialization might be too slow 
        version     : constant.apiVersion,
        logLevel    : null//'DEBUG',
    }
    console.log('params',params);
    
    let connection = await new window.jsforce.Connection(params);

    const connector = new Connector({},connection);

    /** Get Username **/
    await enrichConnector(connector);

    // Dispatch Login Event
    store.dispatch(APPLICATION.reduxSlice.actions.login({connector}));
    return connector;
}

async function enrichConnector(connector){
    const [identity,versions] = await Promise.all([
        connector.conn.identity(),
        connector.conn.request('/services/data/')
    ]);
    
    if(isNotUndefinedOrNull(identity)){
        Object.assign(connector.configuration,{
            username:identity.username,
            orgId:identity.organization_id,
            userInfo:identity,
            alias:identity.username // Replacing the alias to take advantage of the cache
        });
    }
    const _version = versions.sort((a, b) => b.version.localeCompare(a.version));
    connector.conn.version = _version[0].version;
    connector.configuration.versionDetails = _version[0];

    store.dispatch(APPLICATION.reduxSlice.actions.updateConnector(connector));
}