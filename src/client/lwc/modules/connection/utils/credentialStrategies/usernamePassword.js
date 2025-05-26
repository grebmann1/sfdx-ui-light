// usernamePassword.js
import { getCurrentPlatform, PLATFORM } from '../platformService';
import { processHost,normalizeConnection } from '../utils';
import { saveConfiguration } from '../web';
import { OAUTH_TYPES } from './index';
import { Connector } from '../connectorClass';
import LOGGER from 'shared/logger';
import { isUndefinedOrNull } from 'shared/utils';

export async function directConnect({username,password,loginUrl,alias}) {
    const platform = getCurrentPlatform();
    const normalizedUrl = processHost(loginUrl);
    const connectionParams = normalizeConnection(OAUTH_TYPES.USERNAME,{ 
        instanceUrl: normalizedUrl,
        proxyUrl: window.jsforceSettings?.proxyUrl || 'https://sf-toolkit.com/proxy/',
    },platform);
    const connection = new window.jsforce.Connection(connectionParams);
    console.log('connectionParams2222',connectionParams);
    await connection.login(username, password);
    if(isUndefinedOrNull(connection.accessToken)){
        console.log('connection error',connection);
        throw new Error('No access token found');
    }
    const connector = await Connector.createConnector({ alias, connection,credentialType:OAUTH_TYPES.USERNAME });
    if(connector.hasError){
        throw new Error(connector.errorMessage);
    }
    return connector;
}

export async function connect({ username, password, loginUrl, alias },settings = {}) {
    const {saveFullConfiguration = false} = settings;
    const platform = getCurrentPlatform();
    if (![PLATFORM.WEB,PLATFORM.CHROME].includes(platform)) {
        throw new Error('Username/Password connect is only supported on Web for now');
    }

    const normalizedUrl = processHost(loginUrl);
    try {
        const connection = new window.jsforce.Connection({
            loginUrl: normalizedUrl,
            proxyUrl: window.jsforceSettings?.proxyUrl || 'https://sf-toolkit.com/proxy/',
        });
        await connection.login(username, password);
        // Build configuration using normalizeConfiguration
        Object.assign(connection,{ username, password});
        const connector = await Connector.createConnector({ alias, connection,credentialType:OAUTH_TYPES.USERNAME });
        // Save configuration after successful connection
        if(saveFullConfiguration){
            await saveConfiguration(alias, connector.configuration);
        }
        // Return a Connector instance  
        return connector;
    } catch (e) {
        throw new Error(`Username/Password Error: ${e.message}`);
    }
}
