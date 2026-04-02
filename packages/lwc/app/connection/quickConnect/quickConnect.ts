import Toast from 'lightning/toast';
import { credentialStrategies, OAUTH_TYPES } from 'core/connector';
import { store, APPLICATION } from 'core/store';
import LOGGER from 'shared/logger';
import type { ConnectorLike } from 'core/connector';

type QuickConnectOptions = {
    setLoading?: (message: string) => void;
    resetLoading?: () => void;
    onSuccess?: (connector: ConnectorLike) => void;
    onError?: (error: Error) => void;
};

export async function runQuickConnect({
    setLoading,
    resetLoading,
    onSuccess,
    onError,
}: QuickConnectOptions = {}) {
    if (typeof setLoading === 'function') {
        setLoading('Starting direct OAuth connection...');
    }

    try {
        const loginUrl = window?.jsforceSettings?.loginUrl || 'https://login.salesforce.com';
        const alias = `direct-session-${Date.now()}`;
        const connector: ConnectorLike = await credentialStrategies[OAUTH_TYPES.OAUTH].connect(
            { alias, loginUrl },
            { bypass: true, persist: false }
        );

        if (connector?.hasError) {
            throw new Error(connector.errorMessage || 'Unable to establish direct connection');
        }

        store.dispatch(APPLICATION.reduxSlice.actions.login({ connector }));

        if (typeof onSuccess === 'function') {
            onSuccess(connector);
        }

        Toast.show({
            label: 'Direct connection established',
            message: 'Session is active but not saved in your org list.',
            variant: 'success',
            mode: 'dismissible',
        });

        return connector;
    } catch (e) {
        LOGGER.error('runQuickConnect error', e);
        if (typeof onError === 'function') {
            onError(e);
        }
        Toast.show({
            label: 'Direct connection failed',
            message: e?.message || String(e),
            variant: 'error',
            mode: 'dismissible',
        });
        throw e;
    } finally {
        if (typeof resetLoading === 'function') {
            resetLoading();
        }
    }
}
