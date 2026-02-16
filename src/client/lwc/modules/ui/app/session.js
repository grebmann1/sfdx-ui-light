import { isNotUndefinedOrNull, isElectronApp } from 'shared/utils';
import { credentialStrategies, OAUTH_TYPES, getConfiguration } from 'connection/utils';
import { navigate } from 'lwr/navigation';
import { store, APPLICATION } from 'core/store';
import { handleRedirect } from './utils';
import LOGGER from 'shared/logger';
import LightningAlert from 'lightning/alert';

/**
 * Session management helpers for app initialization
 */

/**
 * Load limited mode (Extension/Electron org window)
 * @param {Object} context - Component context with alias, sessionId, serverUrl, redirectUrl, navContext, targetPage
 * @param {Function} handleNavigation - Handler for navigation after load
 */
export async function loadLimitedMode(context) {
    const { alias, sessionId, serverUrl, redirectUrl, navContext, targetPage, handleNavigation } = context;
    
    try {
        let connector;
        LOGGER.debug('load_limitedMode - alias', alias);
        LOGGER.debug('load_limitedMode - sessionId', sessionId);
        LOGGER.debug('load_limitedMode - serverUrl', serverUrl);
        
        if (isNotUndefinedOrNull(alias)) {
            LOGGER.debug('load_limitedMode - OAUTH');
            let configuration = await getConfiguration(alias);
            if (configuration && configuration.credentialType === OAUTH_TYPES.OAUTH) {
                connector = await credentialStrategies.OAUTH.connect({ alias });
            } else if (configuration && configuration.credentialType === OAUTH_TYPES.USERNAME) {
                connector = await credentialStrategies.USERNAME.connect({
                    username: configuration.username,
                    password: configuration.password,
                    loginUrl: configuration.instanceUrl,
                    alias,
                });
            } else {
                connector = null;
                throw new Error('No configuration found');
            }
        } else if (isNotUndefinedOrNull(sessionId) && isNotUndefinedOrNull(serverUrl)) {
            LOGGER.debug('load_limitedMode - SESSION');
            connector = await credentialStrategies.SESSION.connect({
                sessionId,
                serverUrl,
            });
        } else {
            LOGGER.debug('load_limitedMode - NO CREDENTIALS');
            connector = null;
            throw new Error('No credentials found');
        }

        store.dispatch(APPLICATION.reduxSlice.actions.login({ connector }));

        if (isElectronApp()) {
            LOGGER.debug('load_limitedMode - ELECTRON - channel : ', window.electron.getChannel());
            window.electron.send(window.electron.getChannel(), {
                isLoggedIn: true,
                username: connector.configuration.username,
            });
        }

        if (redirectUrl) {
            handleRedirect(navContext, redirectUrl);
        } else {
            navigate(navContext, {
                type: 'application',
                state: { applicationName: 'org' },
            });
        }
        
        return { success: true, connector };
    } catch (e) {
        LOGGER.error(e);
        if (isElectronApp()) {
            LOGGER.debug('load_limitedMode - ELECTRON - channel : ', window.electron.getChannel());
            window.electron.send(window.electron.getChannel(), {
                isLoggedIn: false,
                message: e.message,
            });
        }
        await LightningAlert.open({
            message: e.message,
            theme: 'error',
            label: 'Error!',
        });
        return { success: false, error: e };
    }
}

/**
 * Load full mode (Website & Electron)
 * @param {Object} context - Component context with sessionId, serverUrl, redirectUrl, navContext, targetPage, loadModule
 * @param {Function} handleNavigation - Handler for navigation after load
 */
export async function loadFullMode(context) {
    const { sessionId, serverUrl, redirectUrl, navContext, targetPage, loadModule, handleNavigation } = context;
    
    if (isNotUndefinedOrNull(sessionId) && isNotUndefinedOrNull(serverUrl)) {
        let connector = await credentialStrategies.SESSION.connect({
            sessionId,
            serverUrl,
        });
        store.dispatch(APPLICATION.reduxSlice.actions.login({ connector }));
    } else {
        // New logic inspired by old getExistingSession
        const currentConnectionRaw = sessionStorage.getItem('currentConnection');
        if (currentConnectionRaw) {
            try {
                const settings = JSON.parse(currentConnectionRaw);
                settings.logLevel = null;
                let connector;
                if (settings.sessionId && settings.serverUrl) {
                    connector = await credentialStrategies.SESSION.connect({
                        sessionId: settings.sessionId,
                        serverUrl: settings.serverUrl,
                    });
                } else if (
                    settings.credentialType &&
                    credentialStrategies[settings.credentialType || 'OAUTH']
                ) {
                    connector = await credentialStrategies[settings.credentialType].connect(settings);
                }
                if (connector) {
                    store.dispatch(APPLICATION.reduxSlice.actions.login({ connector }));
                }
            } catch (e) {
                LOGGER.error('load_fullMode Error -->', e);
            }
        }
    }

    if (redirectUrl) {
        handleRedirect(navContext, redirectUrl);
    } else {
        loadModule('home/app', true);
    }
    
    return { success: true };
}
