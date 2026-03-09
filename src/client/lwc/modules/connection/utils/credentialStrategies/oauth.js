// oauth.js
import LOGGER from 'shared/logger';
import { isUndefinedOrNull, isNotUndefinedOrNull } from 'shared/utils';

import { Connector } from '../connectorClass';
import { getCurrentPlatform, PLATFORM, getConfiguration } from '../platformService';
import { getSalesforceURL, normalizeConnection } from '../utils';
import { saveConfiguration } from '../web';

import { OAUTH_TYPES } from './index';

const FULL_SCOPE = 'id api web openid sfap_api einstein_gpt_api refresh_token';

function clearOAuthError(config) {
    if (config) {
        config._hasError = false;
        config._errorMessage = null;
    }
}

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

export async function connect({ alias, loginUrl, username }, settings = {}) {
    const { bypass = false, saveFullConfiguration = false } = settings;

    const platform = getCurrentPlatform();

    // Check for existing configuration first
    const configuration = await getConfiguration(alias);
    if (configuration && configuration.refreshToken && !bypass) {
        // Try to connect using the existing configuration
        // (Assume refreshToken is sufficient for OAuth reconnect)
        const connectionParams = normalizeConnection(OAUTH_TYPES.OAUTH, configuration, platform);
        LOGGER.log('connectionParams -> ', connectionParams);
        const connection = await new window.jsforce.Connection(connectionParams);
        LOGGER.log('connection -->', connection);
        const connector = await Connector.createConnector({
            alias,
            connection,
            configuration,
            credentialType: OAUTH_TYPES.OAUTH,
        });

        if (
            isNotUndefinedOrNull(connection.refreshToken) &&
            isUndefinedOrNull(connection.accessToken)
        ) {
            await connector.generateAccessToken();
        }
        LOGGER.log('connector -> ', connector);
        if (connector.hasError) {
            throw new Error(connector.errorMessage);
        }
        // Persist any updated tokens (e.g. rotated refresh_token from Salesforce)
        Object.assign(connector.configuration, {
            refreshToken: connection.refreshToken,
            instanceUrl: connection.instanceUrl,
            accessToken: connection.accessToken,
        });
        clearOAuthError(connector.configuration);
        await saveConfiguration(alias, connector.configuration);
        LOGGER.log('connect -> connector', connector);
        return connector;
    }

    const normalizedUrl = getSalesforceURL(loginUrl || 'https://login.salesforce.com');
    LOGGER.log('normalizedUrl -> ', normalizedUrl);

    if (platform === PLATFORM.CHROME) {
        LOGGER.log('Chrome OAuth');
        // Chrome extension OAuth
        return new Promise((resolve, reject) => {
            const oauth2 = new window.jsforce.OAuth2({
                clientId: window.jsforceSettings.clientId,
                redirectUri: chrome.identity.getRedirectURL(),
                loginUrl: normalizedUrl,
            });
            const authzParams = { prompt: 'consent', scope: FULL_SCOPE };
            if (username) authzParams.login_hint = username;
            const finalUrl = oauth2.getAuthorizationUrl(authzParams);
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
                        clearOAuthError(connector.configuration);
                        await saveConfiguration(alias, connector.configuration);
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
        // Web OAuth: use authorization code flow so the server can exchange code for tokens
        // and redirect to /callback#...; jsforce's default login() uses response_type=token
        // which sends the token in the fragment so the server never receives it and redirects to /
        return new Promise((resolve, reject) => {
            const prefix = String(Date.now());
            const rand = Math.random().toString(36).substring(2);
            const stateId = [prefix, 'popup', rand].join('.');
            const redirectUri =
                typeof window !== 'undefined' && window.location
                    ? `${window.location.origin}/oauth2/callback`
                    : '';
            const stateParam =
                stateId +
                '#' +
                [
                    `redirectUri=${encodeURIComponent(redirectUri)}`,
                    `loginUrl=${encodeURIComponent(normalizedUrl)}`,
                ].join('&');
            try {
                localStorage.setItem('jsforce_state', stateId);
            } catch (e) {
                reject(new Error('localStorage not available'));
                return;
            }

            window.jsforce.browserClient = new window.jsforce.BrowserClient(prefix);
            window.jsforce.browserClient.init({
                ...window.jsforceSettings,
                loginUrl: normalizedUrl,
                version: window.jsforceSettings?.apiVersion,
            });
            window.jsforce.browserClient._removeTokens();

            window.jsforce.browserClient.on('connect', async connection => {
                const connector = await Connector.createConnector({
                    alias,
                    connection,
                    credentialType: OAUTH_TYPES.OAUTH,
                });
                clearOAuthError(connector.configuration);
                await saveConfiguration(alias, connector.configuration);
                resolve(connector);
            });

            const oauth2 = new window.jsforce.OAuth2({
                ...window.jsforceSettings,
                redirectUri,
                loginUrl: normalizedUrl,
            });
            const authzParams = {
                response_type: 'code',
                state: stateParam,
                scope: FULL_SCOPE,
            };
            if (username) authzParams.login_hint = username;
            const authzUrl = oauth2.getAuthorizationUrl(authzParams);

            const popupWidth = 912;
            const popupHeight = 513;
            const left = typeof screen !== 'undefined' ? screen.width / 2 - popupWidth / 2 : 0;
            const top = typeof screen !== 'undefined' ? screen.height / 2 - popupHeight / 2 : 0;
            const pw =
                typeof window !== 'undefined' && window.open
                    ? window.open(
                          authzUrl,
                          undefined,
                          `location=yes,toolbar=no,status=no,menubar=no,width=${popupWidth},height=${popupHeight},top=${top},left=${left}`
                      )
                    : null;

            if (!pw) {
                localStorage.removeItem('jsforce_state');
                reject(new Error('Popup blocked'));
                return;
            }

            const pid = setInterval(() => {
                try {
                    if (!pw || pw.closed) {
                        clearInterval(pid);
                        const tokens = window.jsforce.browserClient._getTokens();
                        if (tokens) {
                            const refreshToken =
                                typeof localStorage !== 'undefined'
                                    ? localStorage.getItem(
                                          window.jsforce.browserClient._prefix + '_refresh_token'
                                      )
                                    : null;
                            if (refreshToken) {
                                tokens.refreshToken = refreshToken;
                            }
                            window.jsforce.browserClient.connection._establish(tokens);
                            window.jsforce.browserClient.emit(
                                'connect',
                                window.jsforce.browserClient.connection
                            );
                        } else {
                            const err = window.jsforce.browserClient._getError();
                            if (err) {
                                reject(
                                    new Error(
                                        [err.error, err.error_description]
                                            .filter(Boolean)
                                            .join(': ')
                                    )
                                );
                            } else {
                                resolve(null);
                            }
                        }
                    }
                } catch (e) {
                    clearInterval(pid);
                    reject(e);
                }
            }, 500);
        });
    } else {
        throw new Error('OAuth connect is not implemented for this platform');
    }
}
