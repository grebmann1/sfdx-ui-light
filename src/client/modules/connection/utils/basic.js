import constant from 'core/constant';
import { isUndefinedOrNull } from 'shared/utils';

import { getConfiguration } from './utils';
import * as webInterface from './web';

export const generateAccessToken = async ({ alias }) => {
    let { conn, configuration } = await basicConnection({ alias });
    try {
        const jwt = await conn.oauth2.refreshToken(conn.refreshToken);
        return {
            ...jwt,
            frontDoorUrl: jwt.instance_url + '/secur/frontdoor.jsp?sid=' + jwt.access_token,
        };
    } catch (e) {
        Object.assign(configuration, {
            _hasError: true,
            _errorMessage: e.message,
        });
        await webInterface.saveConfiguration(alias, configuration);
    }
    return null;
};

export const basicConnection = async ({ alias }) => {
    //console.log('--> connect',alias,settings);
    if (isUndefinedOrNull(alias)) {
        throw new Error('You need to provide the alias or the connection');
    }

    let settings = await getConfiguration(alias);

    let params = {
        instanceUrl: settings.instanceUrl,
        accessToken: settings.accessToken,
        proxyUrl: window.jsforceSettings.proxyUrl, // For chrome extension, we run without proxy
        version: settings.version || constant.apiVersion, // This might need to be refactored
        //logLevel:'DEBUG',
    };
    // Handle Refresh Token
    if (settings.refreshToken) {
        params.refreshToken = settings.refreshToken;
        params.oauth2 = {
            ...window.jsforceSettings,
            loginUrl: settings.instanceUrl,
        };
    }

    return {
        conn: new window.jsforce.Connection(params),
        configuration: settings,
    };
};
