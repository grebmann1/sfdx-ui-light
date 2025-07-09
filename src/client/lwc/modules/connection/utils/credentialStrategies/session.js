// session.js
import { getCurrentPlatform, PLATFORM } from '../platformService';
import { normalizeConnection } from '../utils';
import { OAUTH_TYPES } from './index';
import { Connector } from '../connectorClass';
import LOGGER from 'shared/logger';

export async function connect({ sessionId, serverUrl, extra = {}, alias }) {
    try {
        const platform = getCurrentPlatform();
        const {
            isProxyDisabled = false,
            isAliasMatchingDisabled = false,
            isEnrichDisabled = false,
        } = extra;
        const formattedServerUrl = serverUrl?.startsWith('https://')
            ? serverUrl
            : `https://${serverUrl}`;
        if(isEmpty(sessionId)){
            throw new Error('SessionId is required');
        }
        if(isEmpty(serverUrl)){
            throw new Error('ServerUrl is required');
        }
        let params = {
            sessionId,
            serverUrl: formattedServerUrl,
            instanceUrl: formattedServerUrl,
            loginUrl: formattedServerUrl,
            version: window.jsforceSettings?.apiVersion,
            logLevel: null,
        };
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
