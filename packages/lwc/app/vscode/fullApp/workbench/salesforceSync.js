import { fetchAndPopulateWorkspace } from '../extensions/metadata/runtime/workspaceSync.js';

import { DEFAULT_SOURCE_API_VERSION, normalizeSfApiVersion } from './sfdxProject.js';
import {
    isAuthError,
    refreshStoredConnection,
    resolveStoredConnection,
} from './sharedConnection.js';

function getEffectiveProxyUrl(app) {
    return app.sfUseProxy ? app.sfProxyUrl?.trim() || window.location.origin : undefined;
}

function createAppToolingClient(app, createToolingClient, connection) {
    return createToolingClient({
        instanceUrl: connection.instanceUrl,
        accessToken: connection.accessToken,
        apiVersion: normalizeSfApiVersion(
            connection.apiVersion || app.sfApiVersion,
            DEFAULT_SOURCE_API_VERSION
        ),
        proxyUrl: getEffectiveProxyUrl(app),
    });
}

function getAppConnection(app) {
    const currentConnection = app?._buildCurrentConnection?.();
    if (
        currentConnection?.sharedAlias ||
        (currentConnection?.instanceUrl && currentConnection?.accessToken)
    ) {
        return currentConnection;
    }

    return {
        instanceUrl: app.sfInstanceUrl,
        accessToken: app.sfAccessToken,
        apiVersion: normalizeSfApiVersion(app.sfApiVersion, DEFAULT_SOURCE_API_VERSION),
        authType: '',
        sharedAlias: '',
        username: app.orgContext?.username || '',
        userId: '',
        orgId: app.orgContext?.orgId || '',
        organizationName: app.orgContext?.organizationName || '',
        organizationType: app.orgContext?.organizationType || '',
        isSandbox: app.orgContext?.isSandbox,
        workspaceRoot: app?._workspaceRoot || '',
    };
}

async function resolveAppConnection(app) {
    const current = getAppConnection(app);
    const resolved = await resolveStoredConnection(current).catch(() => current);
    app._applyActiveConnection?.(resolved);
    return resolved;
}

async function withAuthedToolingClient(app, createToolingClient, fn) {
    const current = await resolveAppConnection(app);

    try {
        return await fn(createAppToolingClient(app, createToolingClient, current), current);
    } catch (error) {
        if (!isAuthError(error)) {
            throw error;
        }
        const refreshed = await refreshStoredConnection(current).catch(() => null);
        if (!refreshed) {
            throw error;
        }
        app._applyActiveConnection?.(refreshed);
        return await fn(createAppToolingClient(app, createToolingClient, refreshed), refreshed);
    }
}

async function ensureWorkspaceFileServiceReady(app) {
    await app._seedWorkspaceFiles();
    if (!app._vscode?.workspace?.fs) {
        throw new Error('Workbench filesystem is not ready yet.');
    }
    if (!app._fsProvider || !app._fsOverlayDisposable) {
        throw new Error('Workbench filesystem overlay is not mounted yet.');
    }
    if (!app._workbenchFilesService?.hasOverlayRegistration?.()) {
        throw new Error('Workbench file service helper is unavailable.');
    }
}

export async function refreshSalesforceMetadataForApp(app, { createToolingClient }) {
    if (!app?.sfConnected) {
        throw new Error('Not connected.');
    }
    if (app._metadataRefreshPromise) {
        return await app._metadataRefreshPromise;
    }

    const refreshPromise = (async () => {
        await ensureWorkspaceFileServiceReady(app);
        await withAuthedToolingClient(
            app,
            createToolingClient,
            async (client, resolvedConnection) => {
                app._applyActiveConnection?.({
                    ...resolvedConnection,
                    apiVersion: normalizeSfApiVersion(
                        resolvedConnection.apiVersion || app.sfApiVersion,
                        DEFAULT_SOURCE_API_VERSION
                    ),
                });
                await fetchAndPopulateWorkspace(app._vscode, client);
            }
        );
    })();

    app._metadataRefreshPromise = refreshPromise;
    try {
        return await refreshPromise;
    } finally {
        if (app._metadataRefreshPromise === refreshPromise) {
            app._metadataRefreshPromise = null;
        }
    }
}
