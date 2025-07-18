// session.js
import { getCurrentPlatform, PLATFORM } from '../platformService';
import { normalizeConnection } from '../utils';
import { OAUTH_TYPES } from './index';
import { Connector } from '../connectorClass';
import { isEmpty } from 'shared/utils';
import LOGGER from 'shared/logger';

export async function connect({ sessionId, serverUrl, extra = {}, alias }) {
    try {
        LOGGER.debug('connect', sessionId, serverUrl);
        // Retrieve from sessionStorage if not provided
        if (!sessionId) {
            const storedSessionId = sessionStorage.getItem('sfSessionId');
            if (storedSessionId) {
                sessionId = storedSessionId;
            }
        }
        if (!serverUrl) {
            const storedServerUrl = sessionStorage.getItem('sfServerUrl');
            if (storedServerUrl) {
                serverUrl = storedServerUrl;
            }
        }
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
        // Persist to sessionStorage for this tab
        sessionStorage.setItem('sfSessionId', sessionId);
        sessionStorage.setItem('sfServerUrl', serverUrl);
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
