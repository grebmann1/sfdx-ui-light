import { deriveWorkspaceRootFromConnection } from '../workspace/workspaceBootstrap';

import { getCurrentConnection } from './currentConnection';

function normalizeComparableUrl(value: unknown) {
    return String(value || '')
        .trim()
        .replace(/\/+$/, '')
        .toLowerCase();
}

export function isAuthError(err: { status?: number; message?: string } | null | undefined) {
    const status = err?.status;
    if (status === 401) return true;
    const msg = String(err?.message || '').toUpperCase();
    return (
        msg.includes('INVALID_SESSION_ID') ||
        msg.includes('INVALID_SESSION') ||
        msg.includes('(401)')
    );
}

function getConnectionIdentity(connection: Record<string, unknown> = {}) {
    return {
        instanceUrl: normalizeComparableUrl(connection?.instanceUrl),
        accessToken: String(connection?.accessToken || connection?.sessionId || '').trim(),
    };
}

function connectorMatchesConnection(
    connector: Record<string, unknown> | null,
    connection: Record<string, unknown>
) {
    if (!connector || !connection) {
        return false;
    }
    const configuration = (connector?.configuration as Record<string, unknown>) || {};
    const conn = connector?.conn as { instanceUrl?: string; accessToken?: string } | undefined;
    const currentInstanceUrl = normalizeComparableUrl(
        conn?.instanceUrl || configuration.instanceUrl
    );
    const currentAccessToken = String(conn?.accessToken || configuration.accessToken || '').trim();
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

function getProviderContext(): Record<string, unknown> | null {
    const context = getCurrentConnection();
    return context && typeof context === 'object' ? context : null;
}

function getProviderConnector(): Record<string, unknown> | null {
    const ctx = getProviderContext();
    const c = ctx?.connector;
    return c && typeof c === 'object' ? (c as Record<string, unknown>) : null;
}

function getProviderConnection(): Record<string, unknown> | null {
    const ctx = getProviderContext();
    const c = ctx?.connection;
    return c && typeof c === 'object' ? (c as Record<string, unknown>) : null;
}

function unsupportedConnectionError() {
    return new Error(
        'This workbench now depends on the injected Salesforce connector. Open it from a connected toolkit session.'
    );
}

function mergeProviderConnection(
    connection: Record<string, unknown> = {},
    options: { workspaceBasePath?: string } = {}
) {
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
        (connection?.workspaceRoot as string) ||
        (current.workspaceRoot as string) ||
        options.workspaceBasePath ||
        '';
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

export async function resolveConnectionRecord(
    connection: Record<string, unknown>,
    options: { workspaceBasePath?: string } = {}
) {
    const normalized = mergeProviderConnection(connection, options);
    if (!normalized?.instanceUrl || !normalized?.accessToken) {
        throw unsupportedConnectionError();
    }
    return normalized;
}

export async function refreshConnectionRecord(
    connection: Record<string, unknown>,
    options: { workspaceBasePath?: string } = {}
) {
    return await resolveConnectionRecord(connection, options);
}
