import { getConnectionAuthType } from 'core/connector';
import { getCurrentConnection } from './currentConnection.js';
import { deriveWorkspaceRootFromConnection } from './workspaceBootstrap.js';

function normalizeComparableUrl(value) {
    return String(value || '')
        .trim()
        .replace(/\/+$/, '')
        .toLowerCase();
}

export function isAuthError(err) {
    const status = err?.status;
    if (status === 401) return true;
    const msg = String(err?.message || '').toUpperCase();
    return (
        msg.includes('INVALID_SESSION_ID') ||
        msg.includes('INVALID_SESSION') ||
        msg.includes('(401)')
    );
}

function getConnectionIdentity(connection = {}) {
    return {
        instanceUrl: normalizeComparableUrl(connection?.instanceUrl),
        accessToken: String(connection?.accessToken || connection?.sessionId || '').trim(),
    };
}

function connectorMatchesConnection(connector, connection) {
    if (!connector || !connection) {
        return false;
    }
    const configuration = connector?.configuration || {};
    const currentInstanceUrl = normalizeComparableUrl(
        connector?.conn?.instanceUrl || configuration.instanceUrl
    );
    const currentAccessToken = String(
        connector?.conn?.accessToken || configuration.accessToken || ''
    ).trim();
    const identity = getConnectionIdentity(connection);
    if (
        !identity.instanceUrl ||
        !currentInstanceUrl ||
        currentInstanceUrl !== identity.instanceUrl
    ) {
        return false;
    }
    return !identity.accessToken || currentAccessToken === identity.accessToken;
}

function getProviderContext() {
    const context = getCurrentConnection();
    return context && typeof context === 'object' ? context : null;
}

function getProviderConnector() {
    return getProviderContext()?.connector || null;
}

function getProviderConnection() {
    return getProviderContext()?.connection || null;
}

function unsupportedConnectionError() {
    return new Error(
        'This workbench now depends on the injected Salesforce connector. Open it from a connected toolkit session.'
    );
}

function mergeProviderConnection(connection = {}, options = {}) {
    const current = getProviderConnection();
    const connector = getProviderConnector();
    if (!current || !connector) {
        return null;
    }
    if (
        connection &&
        Object.keys(connection).length &&
        !connectorMatchesConnection(connector, connection)
    ) {
        return null;
    }

    const fallbackWorkspaceRoot =
        connection?.workspaceRoot || current.workspaceRoot || options.workspaceBasePath || '';
    return {
        ...current,
        ...(connection && typeof connection === 'object' ? connection : {}),
        workspaceRoot:
            fallbackWorkspaceRoot ||
            deriveWorkspaceRootFromConnection(current, options.workspaceBasePath),
    };
}

export function getInjectedConnector() {
    return getProviderConnector();
}

export function getInjectedConnectionContext() {
    return getProviderContext();
}


export async function resolveConnectionRecord(connection, options = {}) {
    const normalized = mergeProviderConnection(connection, options);
    if (!normalized?.instanceUrl || !normalized?.accessToken) {
        throw unsupportedConnectionError();
    }
    return normalized;
}

export async function refreshConnectionRecord(connection, options = {}) {
    const normalized = mergeProviderConnection(connection, options);
    if (!normalized?.instanceUrl || !normalized?.accessToken) {
        throw unsupportedConnectionError();
    }
    return normalized;
}
