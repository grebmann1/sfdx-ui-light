import { buildConnectionFromConnector } from 'core/connector';

import {
    deriveWorkspaceRootFromConnection,
    resolveWorkspaceRootForConnection,
} from '../workspace/workspaceBootstrap';

import { getCurrentConnectionContext } from './currentConnection';

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
    const context = getCurrentConnectionContext();
    return context && typeof context === 'object' ? context : null;
}

function getProviderConnector(): Record<string, unknown> | null {
    const ctx = getProviderContext();
    const c = ctx?.connector;
    return c && typeof c === 'object' ? (c as Record<string, unknown>) : null;
}

function getProviderConnection(): Record<string, unknown> | null {
    const ctx = getProviderContext();
    const getConnectionRecord = ctx?.getConnectionRecord;
    if (typeof getConnectionRecord === 'function') {
        try {
            const record = getConnectionRecord();
            if (record && typeof record === 'object') {
                return record as Record<string, unknown>;
            }
        } catch {
            // ignore
        }
    }

    const connector = getProviderConnector();
    const rawConnection = ctx?.connection;
    const fallbackApiVersion =
        typeof ctx?.apiVersion === 'string' ? String(ctx.apiVersion) : undefined;
    const normalized = buildConnectionFromConnector(connector, fallbackApiVersion);

    if (normalized) {
        const fallbackWorkspaceRoot =
            typeof ctx?.workspaceRoot === 'string' ? String(ctx.workspaceRoot) : '';
        return {
            ...normalized,
            workspaceRoot:
                fallbackWorkspaceRoot ||
                deriveWorkspaceRootFromConnection(normalized, fallbackWorkspaceRoot),
            sessionHasExpired: Boolean(ctx?.sessionHasExpired),
            hasError: Boolean(ctx?.hasError),
            errorMessage: typeof ctx?.errorMessage === 'string' ? ctx.errorMessage : null,
        };
    }

    return rawConnection && typeof rawConnection === 'object'
        ? (rawConnection as Record<string, unknown>)
        : null;
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
        workspaceRoot: resolveWorkspaceRootForConnection({
            connection: current,
            workspaceRoot: fallbackWorkspaceRoot,
            workspaceBasePath: options.workspaceBasePath,
        }),
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
    const normalized = mergeProviderConnection(connection, options) as Record<
        string,
        unknown
    > | null;
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
