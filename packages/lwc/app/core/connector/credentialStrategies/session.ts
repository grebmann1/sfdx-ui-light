// session.js
import LOGGER from 'shared/logger';
import { isEmpty } from 'shared/utils';

import { Connector } from '../connectorClass';
import { getCurrentPlatform, PLATFORM } from '../platformService';
import { normalizeConnection } from '../base';
import { getMatchingConfiguration } from '../connectionRegistry';
import type { ConnectorLike } from '../../connector';

import { OAUTH_TYPES } from './oauthTypes';

export async function connect({
    sessionId,
    serverUrl,
    extra = {},
    alias,
}: {
    sessionId?: string;
    serverUrl?: string;
    extra?: Record<string, any>;
    alias?: string;
}): Promise<ConnectorLike> {
    try {
        LOGGER.debug('connect', { hasSessionId: Boolean(sessionId), serverUrl });
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

        if (isEmpty(sessionId)) {
            throw new Error('SessionId is required');
        }
        if (isEmpty(serverUrl)) {
            throw new Error('ServerUrl is required');
        }
        // Persist to sessionStorage for this tab
        sessionStorage.setItem('sfSessionId', sessionId);
        sessionStorage.setItem('sfServerUrl', serverUrl);
        const jsforceWindow = window as JsforceWindow;
        let params = {
            sessionId,
            serverUrl: formattedServerUrl,
            instanceUrl: formattedServerUrl,
            loginUrl: formattedServerUrl,
            version: jsforceWindow.jsforceSettings?.apiVersion,
            logLevel: null,
        };
        const connection = new jsforceWindow.jsforce.Connection(
            normalizeConnection(OAUTH_TYPES.SESSION, params, platform, extra)
        );

        /** TODO : Match alias with existing hosts  */
        const matchingConfiguration = await getMatchingConfiguration(connection);
        LOGGER.debug('matchingConfiguration', matchingConfiguration);
        /* if(existingHosts.includes(formattedServerUrl)){
            throw new Error('ServerUrl already connected');
        } */

        // Build configuration using generateConfiguration
        const connector: ConnectorLike = await Connector.createConnector({
            alias: matchingConfiguration?.alias || alias,
            connection,
            credentialType: OAUTH_TYPES.SESSION,
            isEnrichDisabled,
        });

        LOGGER.debug('connector --> ', connector);
        // Return a Connector instance
        return connector;
    } catch (e) {
        throw new Error(`SessionId Connect Error: ${e.message}`);
    }
}
