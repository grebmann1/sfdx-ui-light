import { getConfiguration, saveSession, credentialStrategies, OAUTH_TYPES } from 'connection/utils';
import LOGGER from 'shared/logger';
import { store, APPLICATION } from 'core/store';

export async function connectToOrg({ alias, sessionId, instanceUrl }) {
    try {
        // Connect by alias (preferred)
        if (alias) {
            // Fetch configuration for the alias
            const config = await getConfiguration(alias);
            const strategy = credentialStrategies[config.credentialType || 'OAUTH'];
            if (!strategy)
                throw new Error(`No strategy for credential type: ${config.credentialType}`);

            // Connect using the strategy
            const connector = await strategy.connect({ ...config, alias, disableEvent: false });

            // Electron-specific: open instance if in Electron
            if (window.electron && (config.credentialType === OAUTH_TYPES.OAUTH || config.credentialType === OAUTH_TYPES.USERNAME)) {
                const params = {
                    alias: config.alias,
                    username: config.username,
                    sessionId: connector?.conn?.accessToken,
                    serverUrl: connector?.conn?.instanceUrl,
                };
                await window.electron.invoke('OPEN_INSTANCE', params);
            }

            // Optionally save session
            await saveSession(connector?.configuration || config);

            store.dispatch(APPLICATION.reduxSlice.actions.login({ connector }));

            return { status: 'connected', type: 'alias', connector, config };
        }

        // Connect by sessionId + instanceUrl
        if (sessionId && instanceUrl) {
            const connector = await credentialStrategies.SESSION.createConnector({
                sessionId,
                instanceUrl,
            });
            await saveSession(connector.configuration);
            store.dispatch(APPLICATION.reduxSlice.actions.login({ connector }));
            return { status: 'connected', type: 'session', connector };
        }

        throw new Error('Either alias or sessionId + instanceUrl must be provided.');
    } catch (error) {
        LOGGER.error('[connectToOrg] Error connecting:', error);
        return { status: 'error', error: error.message || error };
    }
}

export async function disconnectFromOrg() {
    await removeSession();
    await store.dispatch(APPLICATION.reduxSlice.actions.logout());
    return { status: 'disconnected' };
}
