/* eslint-disable import/no-unresolved -- Rollup resolves core/connector alias */
import { buildConnectionFromConnector } from './connector';

import { DEFAULT_WORKSPACE_ROOT } from '../configuration/constants';
import {
    DEFAULT_SOURCE_API_VERSION,
    normalizeSfApiVersion,
    normalizeWorkspaceRoot as normalizeWorkspaceRootPath,
} from '../workspace/sfdxProject';
import {
    deriveWorkspaceRootFromConnection,
    resolveWorkspaceRootForConnection,
} from '../workspace/workspaceBootstrap';

export { normalizeWorkspaceRoot } from '../workspace/sfdxProject';

/**
 * Derive the workspace root path for a given Salesforce connection.
 */
export function deriveConnectionWorkspaceRoot(
    connection: Parameters<typeof deriveWorkspaceRootFromConnection>[0],
    workspaceBasePath?: string
) {
    return normalizeWorkspaceRootPath(
        deriveWorkspaceRootFromConnection(connection, workspaceBasePath || DEFAULT_WORKSPACE_ROOT)
    );
}

export function hasExpiredConnection(
    connection: { sessionHasExpired?: boolean } | null | undefined
) {
    return Boolean(connection?.sessionHasExpired);
}

export function hasConnectionIssue(
    connection: { hasError?: boolean; sessionHasExpired?: boolean } | null | undefined
) {
    return Boolean(connection?.hasError || hasExpiredConnection(connection));
}

/**
 * Returns true when the connection can be used to make Salesforce API calls.
 */
export function hasUsableConnection(
    connection:
        | {
              instanceUrl?: unknown;
              accessToken?: unknown;
              sessionHasExpired?: boolean;
              hasError?: boolean;
          }
        | null
        | undefined
) {
    return Boolean(
        connection?.instanceUrl && connection?.accessToken && !hasConnectionIssue(connection)
    );
}
