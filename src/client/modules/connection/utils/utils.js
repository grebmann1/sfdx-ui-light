import constant from 'core/constant';
import {
    isNotUndefinedOrNull,
    isUndefinedOrNull,
    isElectronApp,
    isObject,
    isChromeExtension,
} from 'shared/utils';

import * as electronInterface from './electron';
import { Connector } from './mapping';
import * as webInterface from './web';

export * as BASIC from './basic';
import { store, APPLICATION } from 'core/store';
import LOGGER from 'shared/logger';
export * from './chrome';
export * from './mapping';

const PROXY_EXCLUSION = [];
const FULL_SCOPE = 'id api web openid sfap_api einstein_gpt_api refresh_token';

function extractName(alias) {
    let nameArray = (alias || '').split('-');
    return {
        company: nameArray.length > 1 ? nameArray.shift() : '',
        name: nameArray.join('-'),
    };
}

export function extractConfig(config) {
    // Regular expression pattern to match the required parts
    const regex = /force:\/\/([^:]+)::([^@]+)@(.+)/;
    // Extracting variables using regex
    const matches = config.match(regex);
    if (matches && matches.length === 4) {
        // Destructuring matches to extract variables
        const [, clientId, refreshToken, instanceUrl] = matches;
        // Returning the extracted variables
        return { clientId, refreshToken, instanceUrl };
    }
    return null;
}

export async function connect({ alias, settings, disableEvent = false, directStorage = false }) {
    //LOGGER.log('--> connect',alias,settings);
    if (isUndefinedOrNull(settings) && isUndefinedOrNull(alias)) {
        throw new Error('You need to provide the alias or the connection');
    }

    if (alias) {
        //LOGGER.log('before - getConfiguration')
        let _settings = await getConfiguration(alias);
        if (_settings) {
            settings = _settings;
        }
        //LOGGER.log('loaded settings',settings);
    } else {
        alias = settings?.alias;
    }

    // Prevent issue
    if (settings.version === '42.0') {
        settings.version = constant.apiVersion;
    }

    let params = {
        instanceUrl: settings.instanceUrl,
        accessToken: settings.accessToken,
        proxyUrl: window.jsforceSettings.proxyUrl, // For chrome extension, we run without proxy
        version: settings.version || constant.apiVersion, // This might need to be refactored

        //logLevel:'DEBUG',
        logLevel: null, //'DEBUG',
    };

    // Handle Refresh Token
    if (settings.refreshToken) {
        params.refreshToken = settings.refreshToken;
        params.oauth2 = {
            ...window.jsforceSettings,
            loginUrl: settings.instanceUrl,
        };
    }
    //LOGGER.log('params',params);
    const connection = await new window.jsforce.Connection(params);
    connection.alias = alias || settings.alias;
    /** Assign Latest Version **/
    //await assignLatestVersion(connection);

    //LOGGER.log('{alias,connection}',{alias,connection});
    const configuration = await generateConfiguration({ alias, connection });
    /** Handler Connection Error and save it */
    if (configuration._hasError) {
        await webInterface.saveConfiguration(connection.alias, configuration);
        return null;
    }

    if (directStorage) {
        await webInterface.saveConfiguration(connection.alias, configuration);
    }

    // Dispatch Login Event
    const connector = new Connector(configuration, connection);
    if (!disableEvent) {
        store.dispatch(async (dispatch, getState) => {
            await dispatch(APPLICATION.reduxSlice.actions.logout());
            await dispatch(APPLICATION.reduxSlice.actions.login({ connector }));
        });
    }
    return connector;
}

export async function getConfiguration(alias) {
    //LOGGER.log('getConfiguration (isElectronApp)',isElectronApp());
    let connection = isElectronApp()
        ? await electronInterface.getConfiguration(alias)
        : await webInterface.getConfiguration(alias);
    if (connection) {
        const { name, company } = extractName(alias);
        return {
            ...connection,
            company,
            name,
        };
    }
    return null;
}

export async function setConfigurations(params) {
    return webInterface.setConfigurations(params);
}

export async function renameConfiguration(params) {
    return (await isElectronApp())
        ? electronInterface.renameConfiguration(params)
        : webInterface.renameConfiguration(params);
}

export async function removeConfiguration(alias) {
    return (await isElectronApp())
        ? electronInterface.removeConfiguration(alias)
        : webInterface.removeConfiguration(alias);
}

export async function getConfigurations() {
    let connections = isElectronApp()
        ? await electronInterface.getConfigurations()
        : await webInterface.getConfigurations();
    //LOGGER.log('connections',connections);
    // To be removed, only for testing
    /*if(connections == null || connections.length == 0){
        //LOGGER.log('FAKE Connections')
        return [1,2,3,4,5,7,8,9,10].map(x => ({
            alias:`Test-${x}-Prod`,
            company:`Test-${x}`,
            name:'Prod',
            id:`Test-${x}-Prod`,
            username:`Test-${x}-Prod@salesforce.com`
        }));
    }*/
    return connections.map(x => {
        const { name, company } = extractName(x.alias);
        return {
            ...x,
            company,
            name,
            id: x.alias, // To investigate in case of issues
            _connectVariant: x._hasError ? 'brand-outline' : 'brand',
            _connectLabel: x._hasError ? 'Authorize' : 'Connect',
            _connectAction: x._hasError ? 'authorize' : 'login',
        };
    });
}

export async function getExistingSession() {
    //LOGGER.log('getExistingSession');
    if (sessionStorage.getItem('currentConnection')) {
        try {
            // Don't use settings for now, to avoid issues with electron js (see-details need to be called)
            //LOGGER.log('sessionStorage.getItem("currentConnection")',JSON.parse(sessionStorage.getItem("currentConnection")));
            const settings = JSON.parse(sessionStorage.getItem('currentConnection'));
            settings.logLevel = null;
            //LOGGER.log('settings',settings);
            // Using {alias,...settings} before, see if it's better now
            return isElectronApp()
                ? await connect({ alias: settings.alias })
                : await connect({ settings });
        } catch (e) {
            LOGGER.error(e);
            return null;
        }
    }
    return null;
}

export async function saveSession(value) {
    sessionStorage.setItem('currentConnection', JSON.stringify(value));
}

export async function removeSession(value) {
    sessionStorage.removeItem('currentConnection');
}

/** Session Connection **/

export async function oauth_chrome({ alias, loginUrl }, callback, callbackErrorHandler) {
    const oauth2 = new window.jsforce.OAuth2({
        clientId: window.jsforceSettings.clientId,
        redirectUri: chrome.identity.getRedirectURL(),
        loginUrl: loginUrl,
    });

    const finalUrl = oauth2.getAuthorizationUrl({ prompt: 'consent', scope: FULL_SCOPE });
    LOGGER.debug('finalUrl', finalUrl);
    const response = await chrome.runtime.sendMessage({
        action: 'launchWebAuthFlow',
        url: finalUrl,
    });
    //LOGGER.log('response',response);
    const { code } = response;
    //LOGGER.log('code',code);
    if (isUndefinedOrNull(code)) return;

    const connection = new window.jsforce.Connection({ oauth2 });
    try {
        await connection.authorize(code);
        //LOGGER.log('userInfo',userInfo);
        oauth_extend({ alias, connection }, callback);
    } catch (e) {
        callbackErrorHandler(e);
    }
}

export async function oauth({ alias, loginUrl }, callback, callbackErrorHandler) {
    //LOGGER.log('oauth');
    window.jsforce.browserClient = new window.jsforce.BrowserClient(Date.now()); // Reset
    //LOGGER.log('window.jsforceSettings',window.jsforceSettings);
    window.jsforce.browserClient.init({
        ...window.jsforceSettings,
        loginUrl,
        version: constant.apiVersion,
    });
    window.jsforce.browserClient.on('connect', async connection => {
        //LOGGER.log('new connection',connection)
        oauth_extend({ alias, connection }, callback);
    });

    window.jsforce.browserClient
        .login({
            scope: FULL_SCOPE,
        })
        .then(res => {
            //LOGGER.log('res',res);
            if (res.status === 'cancel') {
                //this.close(null)
                callback(null);
            }
        });
}

async function generateConfiguration({ alias, connection, redirectUrl }) {
    const { name, company } = extractName(alias);
    let configuration = {
        id: alias,
        alias,
        company: company.toUpperCase(),
        name,
        redirectUrl,
    };
    if (connection) {
        const {
            accessToken,
            instanceUrl,
            loginUrl,
            refreshToken,
            version,
            username,
            orgId,
            userInfo,
            _isInjected,
        } = connection;

        Object.assign(configuration, {
            username,
            orgId,
            userInfo,
            accessToken,
            instanceUrl,
            loginUrl,
            refreshToken,
            version,
            _isInjected,
            sfdxAuthUrl: `force://${window.jsforceSettings.clientId}::${refreshToken}@${
                new URL(instanceUrl).host
            }`,
        });

        /** Get Username,Version .... this is also usefull to verify if the token is still valid !!!!! **/
        try {
            /** Get Username & Version **/
            await enrichConnector({ connection, configuration }, false);
        } catch (e) {
            LOGGER.error(e);
            Object.assign(configuration, {
                _hasError: true,
                _errorMessage: e.message,
            });
        }
    }
    return configuration;
}

export async function setRedirectCredential({ alias, redirectUrl }, callback) {
    //LOGGER.log('redirect_credential');
    const configuration = await generateConfiguration({ alias, redirectUrl });
    await webInterface.saveConfiguration(alias, configuration);

    callback();
}

async function oauth_extend({ alias, connection }, callback) {
    //LOGGER.log('oauth_extend');
    const configuration = await generateConfiguration({ alias, connection });
    await webInterface.saveConfiguration(alias, configuration);
    const connector = new Connector(configuration, connection);
    callback({ alias, connector }); //this.close({alias:alias,connection});
}

export async function directConnect(sessionId, serverUrl, extra) {
    const isProxyDisabled = extra?.isProxyDisabled || false;
    const isAliasMatchingDisabled = extra?.isAliasMatchingDisabled || false;
    const isEnrichDisabled = extra?.isEnrichDisabled || false;
    const formattedServerUrl = serverUrl.startsWith('https://')
        ? serverUrl
        : `https://${serverUrl}`;
    let params = {
        //oauth2      : {...window.jsforceSettings},
        sessionId: sessionId,
        serverUrl: formattedServerUrl,
        instanceUrl: formattedServerUrl,
        proxyUrl:
            isProxyDisabled || isChromeExtension()
                ? null
                : window.jsforceSettings?.proxyUrl || 'https://sf-toolkit.com/proxy/', // variable initialization might be too slow
        version: constant.apiVersion,
        logLevel: null, //'DEBUG',
    };

    const standardDirectConnect = async () => {
        LOGGER.log('--> Direct connect (Standard)');
        // no existing org, so use sessionId
        connection.on('sessionExpired', async function (accessToken, res) {
            LOGGER.log('--> sessionExpired <--');
            store.dispatch(
                APPLICATION.reduxSlice.actions.sessionExpired({ sessionHasExpired: true })
            );
        });
        /** Get Username & Version **/
        const connector = isEnrichDisabled
            ? new Connector({}, connection)
            : await enrichConnector({ configuration: {}, connection }, true);
        // Dispatch Login Event
        store.dispatch(async (dispatch, getState) => {
            //await dispatch(APPLICATION.reduxSlice.actions.logout());
            await dispatch(APPLICATION.reduxSlice.actions.login({ connector }));
        });
        return connector;
    };

    const aliasDirectConnect = async alias => {
        LOGGER.log('--> Direct connect (Alias)');
        // Link connection to existing org
        return await connect({ alias });
    };

    let connection = await new window.jsforce.Connection(params);
    if (!isAliasMatchingDisabled) {
        let identity = await connection.identity();
        const configurations = await getConfigurations();
        const matchingConfigurations = configurations.filter(
            x => x.orgId == identity.organization_id && x.userInfo.user_id == identity.user_id
        );
        // Listen to session expired for direct connect
        // Todo : replace with alias connection whener it's possible
        if (matchingConfigurations.length > 0) {
            return aliasDirectConnect(matchingConfigurations[0].alias);
        }
    }

    return standardDirectConnect();
}

async function enrichConnector({ connection, configuration }, dispathUpdate) {
    // Todo: the entire enrichConnector, Connector, etc need to be refactored to have something easier to maintain !!!!
    const [identity, versions] = await Promise.all([
        connection.identity(),
        //connection.request('/services/oauth2/userinfo'),
        connection.request('/services/data/'),
    ]);

    if (isNotUndefinedOrNull(identity)) {
        // Using preferred_username as username
        /*Object.assign(identity,{
            username:identity.preferred_username,
        });*/

        Object.assign(configuration, {
            username: identity.username,
            orgId: identity.organization_id,
            userInfo: identity,
            alias: configuration.alias || identity.username, // Replacing the alias to take advantage of the cache
            id: configuration.id || identity.username,
        });

        // Add alias to the connection to be able to use it with a direct connect !!!
        Object.assign(connection, {
            alias: configuration.alias,
        });
    }
    const versionRecord = versions.sort((a, b) => b.version.localeCompare(a.version))[0];
    connection.version = versionRecord.version;
    configuration.versionDetails = versionRecord;

    const connector = new Connector(configuration, connection);
    if (dispathUpdate) {
        store.dispatch(APPLICATION.reduxSlice.actions.updateConnector({ connector }));
    }
    return connector;
}

/* 
export function formatForLimitedCacheStorage(configuration){
    return {
        id:configuration.id,
        name:configuration.name,
        company:configuration.company,
        alias:configuration.alias,
        username:configuration.username,
        orgId:configuration.orgId,
        refreshToken:configuration.refreshToken,
        redirectUrl:configuration.redirectUrl,
    };
} */
