import { createToolingClient } from 'vscode/toolingApi';
import { fetchAndPopulateWorkspace } from '../extensions/metadata/runtime/workspaceSync';
import { getActiveSalesforceWorkbenchHost } from '../platform/workbenchHost';
import { DEFAULT_SOURCE_API_VERSION, normalizeSfApiVersion } from '../workspace/sfdxProject';

import { isAuthError, refreshConnectionRecord, resolveConnectionRecord } from './connectorRecord';

async function resolveAppConnection(app) {
    const current = app?._requireCurrentConnection?.();
    const resolved = await resolveConnectionRecord(current, {
        workspaceBasePath: app.workspaceBasePath,
    }).catch(() => current);
    app._applyActiveConnection?.(resolved);
    return resolved;
}

async function withAuthedToolingClient(app, fn) {
    const current = await resolveAppConnection(app);
    const currentConnector = app?.connector;
    if (!currentConnector?.conn) {
        throw new Error('Salesforce connection is required to open this workbench.');
    }

    try {
        return await fn(
            createToolingClient({
                connection: currentConnector.conn,
                apiVersion: normalizeSfApiVersion(
                    current.apiVersion || app.sfApiVersion,
                    DEFAULT_SOURCE_API_VERSION
                ),
            }),
            current
        );
    } catch (error) {
        if (!isAuthError(error)) {
            throw error;
        }
        const refreshed = await refreshConnectionRecord(current, {
            workspaceBasePath: app.workspaceBasePath,
        }).catch(() => null);
        if (!refreshed) {
            throw error;
        }
        app._applyActiveConnection?.(refreshed);
        const nextConnector = app?.connector;
        if (!nextConnector?.conn) {
            throw error;
        }
        return await fn(
            createToolingClient({
                connection: nextConnector.conn,
                apiVersion: normalizeSfApiVersion(
                    refreshed.apiVersion || app.sfApiVersion,
                    DEFAULT_SOURCE_API_VERSION
                ),
            }),
            refreshed
        );
    }
}

export async function refreshSalesforceMetadataForApp(app) {
    app?._requireCurrentConnection?.();
    if (app._metadataRefreshPromise) {
        return await app._metadataRefreshPromise;
    }

    const refreshPromise = (async () => {
        if (!app._vscode?.workspace?.fs) {
            throw new Error('Workbench filesystem is not ready yet.');
        }
        await withAuthedToolingClient(app, async (client, resolvedConnection) => {
            app._applyActiveConnection?.({
                ...resolvedConnection,
                apiVersion: normalizeSfApiVersion(
                    resolvedConnection.apiVersion || app.sfApiVersion,
                    DEFAULT_SOURCE_API_VERSION
                ),
            });
            await fetchAndPopulateWorkspace(app._vscode, client);
            getActiveSalesforceWorkbenchHost()?.deployTools?.invalidateToolingMap?.();
        });
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
