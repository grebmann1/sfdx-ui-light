// session.js
import { getCurrentPlatform, PLATFORM } from '../platformService';
import { normalizeConnection } from '../utils';
import { OAUTH_TYPES } from './index';
import { Connector } from '../connectorClass';
import LOGGER from 'shared/logger';

export async function connect({ sessionId, serverUrl, extra = {}, alias }) {
    const platform = getCurrentPlatform();
    const {
        isProxyDisabled = false,
        isAliasMatchingDisabled = false,
        isEnrichDisabled = false,
    } = extra;
    const formattedServerUrl = serverUrl.startsWith('https://')
        ? serverUrl
        : `https://${serverUrl}`;
    let params = {
        sessionId,
        serverUrl: formattedServerUrl,
        instanceUrl: formattedServerUrl,
        loginUrl: formattedServerUrl,
        version: window.jsforceSettings?.apiVersion,
        logLevel: null,
    };
    try {
        const connection = new window.jsforce.Connection(
            normalizeConnection(OAUTH_TYPES.SESSION, params, platform, extra)
        );
        // Build configuration using generateConfiguration
        const connector = await Connector.createConnector({
            alias,
            connection,
            credentialType: OAUTH_TYPES.SESSION,
            isEnrichDisabled,
        });
        // Return a Connector instance
        return connector;
    } catch (e) {
        throw new Error(`SessionId Connect Error: ${e.message}`);
    }
}
