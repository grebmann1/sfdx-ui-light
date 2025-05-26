// sfdx.js
import { getCurrentPlatform, PLATFORM, getConfiguration } from '../platformService';
import { OAUTH_TYPES } from './index';
import { normalizeConnection } from '../utils';
import { Connector } from '../connectorClass';
import { isUndefinedOrNull } from 'shared/utils';
import LOGGER from 'shared/logger';

export async function connect({ alias }, settings = {}) {
    const platform = getCurrentPlatform();
    if (platform !== PLATFORM.ELECTRON) {
        throw new Error('SFDX connect is only supported on Electron for now');
    }

    // Check for existing configuration first
    const configuration = await getConfiguration(alias);
    const connectionParams = normalizeConnection(OAUTH_TYPES.OAUTH, configuration, platform);
    const connection = await new window.jsforce.Connection(connectionParams);
    if (isUndefinedOrNull(connection.accessToken)) {
        console.log('connection error', connection);
        throw new Error('No access token found');
    }
    const connector = await Connector.createConnector({
        alias,
        connection,
        configuration,
        credentialType: OAUTH_TYPES.OAUTH,
    });
    await connector.generateAccessToken();
    if (connector.hasError) {
        throw new Error(connector.errorMessage);
    }
    return connector;
}

// NOTE: When implementing SFDX connect, ensure configuration is only saved after successful connection and always normalized.

// When implementing, return a Connector instance with configuration and connection, as in other strategies.
