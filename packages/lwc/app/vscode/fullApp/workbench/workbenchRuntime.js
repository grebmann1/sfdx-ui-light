import { buildConnectionFromConnector } from 'core/connector';
import { DEFAULT_WORKSPACE_ROOT } from './constants.js';
import { DEFAULT_SOURCE_API_VERSION, normalizeSfApiVersion } from './sfdxProject.js';
import { deriveWorkspaceRootFromConnection } from './workspaceBootstrap.js';

/**
 * Normalize an arbitrary workspace path string to an absolute unix path.
 */
export function normalizeWorkspaceRoot(value, defaultRoot = DEFAULT_WORKSPACE_ROOT) {
    const raw = String(value ?? '').trim();
    if (!raw) return defaultRoot;
    const normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
    return normalized ? `/${normalized}` : defaultRoot;
}

/**
 * Derive the workspace root path for a given Salesforce connection.
 */
export function deriveConnectionWorkspaceRoot(connection, workspaceBasePath) {
    return normalizeWorkspaceRoot(
        deriveWorkspaceRootFromConnection(
            connection,
            workspaceBasePath || DEFAULT_WORKSPACE_ROOT
        )
    );
}

/**
 * Build the enriched connection object used throughout the workbench.
 * Returns null when no connector is available.
 */
export function buildWorkbenchConnection(connector, {
    sfApiVersion = DEFAULT_SOURCE_API_VERSION,
    workspaceRoot = DEFAULT_WORKSPACE_ROOT,
    workspaceBasePath,
    sessionHasExpired = false,
    connectorHasError = false,
    connectorErrorMessage = null,
} = {}) {
    const connection = buildConnectionFromConnector(connector, sfApiVersion);
    if (!connection) return null;

    const resolvedRoot = normalizeWorkspaceRoot(
        workspaceRoot || deriveConnectionWorkspaceRoot(connection, workspaceBasePath)
    );

    return {
        ...connection,
        apiVersion: normalizeSfApiVersion(connection.apiVersion, DEFAULT_SOURCE_API_VERSION),
        workspaceRoot: resolvedRoot,
        hasConnection: Boolean(
            connection.instanceUrl &&
                connection.accessToken &&
                !sessionHasExpired &&
                !connectorHasError
        ),
        hasError: connectorHasError,
        errorMessage: connectorErrorMessage,
        sessionHasExpired,
    };
}

/**
 * Returns true when the connection can be used to make Salesforce API calls.
 */
export function hasUsableConnection(connection) {
    return Boolean(
        connection?.instanceUrl &&
            connection?.accessToken &&
            !connection?.sessionHasExpired &&
            !connection?.hasError
    );
}
