// oauth.js
import { getCurrentPlatform, PLATFORM, getConfiguration } from '../platformService';
import { getSalesforceURL, normalizeConnection } from '../utils';
import { OAUTH_TYPES } from './index';
import { saveConfiguration } from '../web';
import { Connector } from '../connectorClass';
import LOGGER from 'shared/logger';
import { isUndefinedOrNull,isNotUndefinedOrNull } from 'shared/utils';

const FULL_SCOPE = 'id api web openid sfap_api einstein_gpt_api refresh_token';

export async function directConnect(configuration) {
    const platform = getCurrentPlatform();
    const connectionParams = normalizeConnection(OAUTH_TYPES.OAUTH, configuration, platform);
    LOGGER.log('connectionParams', connectionParams);
    const connection = await new window.jsforce.Connection(connectionParams);
    const connector = await Connector.createConnector({
        alias: configuration.alias,
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

export async function connect({ alias, loginUrl }, settings = {}) {
    const { bypass = false, saveFullConfiguration = false } = settings;

    const platform = getCurrentPlatform();    

    // Check for existing configuration first
    const configuration = await getConfiguration(alias);
    if (configuration && configuration.refreshToken && !bypass) {
        // Try to connect using the existing configuration
        // (Assume refreshToken is sufficient for OAuth reconnect)
        const connectionParams = normalizeConnection(OAUTH_TYPES.OAUTH, configuration, platform);
        LOGGER.log('connectionParams -> ',connectionParams);
        const connection = await new window.jsforce.Connection(connectionParams);
        LOGGER.log('connection -->',connection);
        const connector = await Connector.createConnector({
            alias,
            connection,
            configuration,
            credentialType: OAUTH_TYPES.OAUTH,
        });

        if (isNotUndefinedOrNull(connection.refreshToken) && isUndefinedOrNull(connection.accessToken)) {
            await connector.generateAccessToken();
        }
        LOGGER.log('connector -> ',connector);
        if (connector.hasError) {
            throw new Error(connector.errorMessage);
        }
        LOGGER.log('connect -> connector',connector);
        return connector;
    }

    
    const normalizedUrl = getSalesforceURL(loginUrl || 'https://login.salesforce.com');
    LOGGER.log('normalizedUrl -> ',normalizedUrl);

    if (platform === PLATFORM.CHROME) {
        LOGGER.log('Chrome OAuth');
        // Chrome extension OAuth
        return new Promise((resolve, reject) => {
            const oauth2 = new window.jsforce.OAuth2({
                clientId: window.jsforceSettings.clientId,
                redirectUri: chrome.identity.getRedirectURL(),
                loginUrl: normalizedUrl,
            });
            const finalUrl = oauth2.getAuthorizationUrl({
                prompt: 'consent',
                scope: FULL_SCOPE,
            });
            chrome.runtime.sendMessage(
                { action: 'launchWebAuthFlow', url: finalUrl },
                async response => {
                    const { code } = response || {};
                    if (!code) return reject(new Error('OAuth flow canceled'));
                    const connection = new window.jsforce.Connection({ oauth2 });
                    try {
                        await connection.authorize(code);
                        const connector = await Connector.createConnector({
                            alias,
                            connection,
                            credentialType: OAUTH_TYPES.OAUTH,
                        });
                        if (saveFullConfiguration) {
                            await saveConfiguration(alias, connector.configuration);
                        }
                        resolve(connector);
                    } catch (e) {
                        LOGGER.error('Chrome OAuth Error', e);
                        reject(e);
                    }
                }
            );
        });
    } else if (platform === PLATFORM.WEB) {
        LOGGER.log('Web OAuth');
        // Web OAuth
        return new Promise((resolve, reject) => {
            window.jsforce.browserClient = new window.jsforce.BrowserClient(Date.now());
            window.jsforce.browserClient.init({
                ...window.jsforceSettings,
                loginUrl: normalizedUrl,
                version: window.jsforceSettings.apiVersion,
            });

            window.jsforce.browserClient.on('connect', async connection => {
                const connector = await Connector.createConnector({
                    alias,
                    connection,
                    credentialType: OAUTH_TYPES.OAUTH,
                });
                if (saveFullConfiguration) {
                    await saveConfiguration(alias, connector.configuration);
                }
                resolve(connector);
            });
            window.jsforce.browserClient
                .login({ scope: FULL_SCOPE })
                .then(res => {
                    if (res.status === 'cancel') {
                        resolve(null);
                    }
                })
                .catch(e => {
                    LOGGER.error('Web OAuth Error', e);
                    reject(e);
                });
        });
    } else {
        throw new Error('OAuth connect is not implemented for this platform');
    }
}
