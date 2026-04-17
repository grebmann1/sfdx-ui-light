// Host-side helpers used exclusively by the `fullApp` LWC to build workbench
// connection records, derive the workspace root, seed the in-browser workspace
// and render the org banner. Nothing here runs inside the embedded VSCode
// iframe; the iframe consumes the resulting connection through the bridge.

import { WORKSPACE_TEMPLATE_FILES } from './workspaceTemplate';

export const DEFAULT_SOURCE_API_VERSION = '66.0';

const DEFAULT_METADATA_DIRECTORIES = [
    'applications',
    'aura',
    'classes',
    'contentassets',
    'flexipages',
    'layouts',
    'lwc',
    'objects',
    'permissionsets',
    'staticresources',
    'tabs',
    'triggers',
];

// ── General helpers ──────────────────────────────────────────────────────────

function toStringValue(value: unknown) {
    return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function toBooleanOrNull(value: unknown) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (value == null || value === '') {
        return null;
    }
    return String(value).toLowerCase() === 'true';
}

function normalizeText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeOrganizationType(value: unknown) {
    const normalized = toStringValue(value).trim();
    return normalized || 'Unknown';
}

function normalizeScratchValue(value: unknown) {
    return toBooleanOrNull(value);
}

function normalizeSandboxValue(value: unknown) {
    return toBooleanOrNull(value);
}

function getOrgHost(connection: Record<string, unknown> | null | undefined) {
    const instanceUrl = toStringValue(connection?.instanceUrl);
    if (!instanceUrl) {
        return '';
    }
    try {
        return new URL(instanceUrl).host;
    } catch {
        return instanceUrl.replace(/^https?:\/\//, '');
    }
}

function sanitizeSegment(value: unknown) {
    const raw = String(value || '').trim();
    if (!raw) {
        return '';
    }
    return raw
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeWorkspacePath(value: unknown, fallback = '') {
    const raw = String(value || fallback || '')
        .trim()
        .replace(/\\/g, '/');
    if (!raw) {
        return fallback || '';
    }
    return `/${raw.replace(/^\/+/, '').replace(/\/+$/, '')}`;
}

// ── Workspace root derivation ────────────────────────────────────────────────

export function normalizeWorkspaceRoot(
    workspaceRoot: unknown = '/workspace',
    defaultRoot = '/workspace'
) {
    const raw = String(workspaceRoot || '').trim();
    if (!raw) {
        return defaultRoot;
    }
    const normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
    return normalized ? `/${normalized}` : defaultRoot;
}

export function normalizeSfApiVersion(
    apiVersion: unknown,
    fallback = DEFAULT_SOURCE_API_VERSION
) {
    const normalizedFallback =
        String(fallback ?? DEFAULT_SOURCE_API_VERSION).trim() || DEFAULT_SOURCE_API_VERSION;
    const normalizedValue = String(apiVersion ?? '').trim();
    return normalizedValue || normalizedFallback;
}

function deriveWorkspaceBaseRoot(value = '/workspace/orgs') {
    const raw = String(value || '')
        .trim()
        .replace(/\\/g, '/');
    if (!raw) {
        return '/workspace/orgs';
    }
    const normalized = `/${raw.replace(/^\/+/, '').replace(/\/+$/, '')}`;
    if (normalized === '/workspace') {
        return '/workspace/orgs';
    }
    const marker = '/workspaces/';
    if (normalized.includes(marker)) {
        return normalized.slice(0, normalized.indexOf(marker) + marker.length - 1);
    }
    return normalized;
}

function deriveWorkspaceRootFromConnection(
    connection: { orgId?: unknown; instanceUrl?: unknown } | null | undefined,
    workspaceBasePath = '/workspace/orgs'
) {
    const baseRoot = deriveWorkspaceBaseRoot(workspaceBasePath);
    let segment = sanitizeSegment(getOrgHost(connection as Record<string, unknown>));
    if (!segment) {
        segment = 'org';
    }
    return `${baseRoot}/${segment}`;
}

function resolveWorkspaceRootForConnection({
    connection,
    workspaceRoot,
    workspaceBasePath = '/workspace/orgs',
    defaultWorkspaceRoot = '/workspace',
}: {
    connection: { orgId?: unknown; instanceUrl?: unknown } | null | undefined;
    workspaceRoot?: unknown;
    workspaceBasePath?: string;
    defaultWorkspaceRoot?: string;
}) {
    const derivedRoot = normalizeWorkspacePath(
        deriveWorkspaceRootFromConnection(connection, workspaceBasePath),
        defaultWorkspaceRoot
    );
    const currentWorkspaceRoot = normalizeWorkspacePath(workspaceRoot, defaultWorkspaceRoot);
    const normalizedDefaultRoot = normalizeWorkspacePath(defaultWorkspaceRoot, '/workspace');
    if (!currentWorkspaceRoot || currentWorkspaceRoot === normalizedDefaultRoot) {
        return derivedRoot;
    }
    return getOrgHost(connection as Record<string, unknown>) ? derivedRoot : currentWorkspaceRoot;
}

export function deriveConnectionWorkspaceRoot(
    connection: { orgId?: unknown; instanceUrl?: unknown } | null | undefined,
    workspaceBasePath?: string
) {
    return normalizeWorkspaceRoot(
        deriveWorkspaceRootFromConnection(connection, workspaceBasePath || '/workspace')
    );
}

// ── Connection record ────────────────────────────────────────────────────────

function buildConnectionFromConnector(
    connector: { conn?: Record<string, unknown>; configuration?: Record<string, unknown> } | null | undefined,
    fallbackApiVersion = DEFAULT_SOURCE_API_VERSION
) {
    const liveConnection = (connector?.conn as Record<string, unknown>) ?? null;
    if (!liveConnection) {
        return null;
    }

    const configuration = (connector?.configuration as Record<string, unknown>) ?? {};
    const userInfo =
        ((configuration.userInfo ?? liveConnection.userInfo) as Record<string, unknown>) ?? {};

    const instanceUrl = toStringValue(liveConnection.instanceUrl || configuration.instanceUrl);
    const accessToken = toStringValue(
        liveConnection.accessToken || liveConnection.sessionId || configuration.accessToken
    );
    const username = toStringValue(
        liveConnection.username || configuration.username || userInfo.username
    );
    const orgId = toStringValue(
        liveConnection.orgId || configuration.orgId || userInfo.organization_id
    );
    const userId = toStringValue(
        liveConnection.userId || userInfo.user_id || userInfo.id || configuration.userId
    );
    const organizationName = toStringValue(
        liveConnection.organizationName ||
            configuration.organizationName ||
            (configuration.orgName as unknown) ||
            userInfo.organization_name
    );
    const organizationType = normalizeOrganizationType(
        liveConnection.organizationType ||
            configuration.organizationType ||
            configuration.orgType
    );
    const apiVersion = toStringValue(
        liveConnection.version ||
            liveConnection.apiVersion ||
            configuration.version ||
            fallbackApiVersion
    );
    const authType = toStringValue(liveConnection.authType).toLowerCase() || 'session';
    const isSandbox =
        normalizeSandboxValue(liveConnection.isSandbox) ??
        normalizeSandboxValue(configuration.isSandbox ?? configuration.sandbox);
    const isScratch =
        normalizeScratchValue(liveConnection.isScratch) ??
        normalizeScratchValue(configuration.isScratch ?? configuration.scratch);

    return {
        instanceUrl,
        apiVersion: apiVersion || fallbackApiVersion,
        accessToken,
        authType,
        oauthConnectionId: toStringValue(liveConnection.oauthConnectionId),
        username,
        userId,
        orgId,
        organizationName,
        organizationType,
        isSandbox,
        isScratch,
        hasConnection: Boolean(instanceUrl && accessToken),
        sessionHasExpired: Boolean(liveConnection.sessionHasExpired),
        hasError: Boolean(liveConnection.hasError),
        errorMessage:
            typeof liveConnection.errorMessage === 'string' ? liveConnection.errorMessage : null,
    };
}

export function buildWorkbenchConnection(
    connector: unknown,
    {
        sfApiVersion = DEFAULT_SOURCE_API_VERSION,
        workspaceRoot = '/workspace',
        workspaceBasePath,
        sessionHasExpired = false,
        connectorHasError = false,
        connectorErrorMessage = null,
    }: {
        sfApiVersion?: string;
        workspaceRoot?: string;
        workspaceBasePath?: string;
        sessionHasExpired?: boolean;
        connectorHasError?: boolean;
        connectorErrorMessage?: string | null;
    } = {}
) {
    const connection = buildConnectionFromConnector(
        connector as { conn?: Record<string, unknown>; configuration?: Record<string, unknown> } | null,
        sfApiVersion
    );
    if (!connection) return null;

    const resolvedRoot = normalizeWorkspaceRoot(
        resolveWorkspaceRootForConnection({
            connection,
            workspaceRoot,
            workspaceBasePath: workspaceBasePath || '/workspace',
            defaultWorkspaceRoot: '/workspace',
        })
    );

    return {
        ...connection,
        apiVersion: normalizeSfApiVersion(connection.apiVersion, DEFAULT_SOURCE_API_VERSION),
        workspaceRoot: resolvedRoot,
        hasConnection: hasUsableConnection({
            ...connection,
            sessionHasExpired,
            hasError: connectorHasError,
        }),
        hasError: connectorHasError,
        errorMessage: connectorErrorMessage,
        sessionHasExpired,
    };
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

/**
 * Validates a connection record passed from the host. The host owns the live
 * connector, so resolution amounts to ensuring the connection is complete and
 * has a workspace root; there is no cross-runtime provider to consult.
 */
export async function resolveConnectionRecord(
    connection: Record<string, unknown>,
    { workspaceBasePath }: { workspaceBasePath?: string } = {}
) {
    if (!connection?.instanceUrl || !connection?.accessToken) {
        throw new Error(
            'This workbench now depends on the injected Salesforce connector. Open it from a connected toolkit session.'
        );
    }
    const workspaceRoot = normalizeWorkspaceRoot(
        resolveWorkspaceRootForConnection({
            connection: connection as { orgId?: unknown; instanceUrl?: unknown },
            workspaceRoot: connection.workspaceRoot,
            workspaceBasePath: workspaceBasePath || '/workspace',
        })
    );
    return { ...connection, workspaceRoot };
}

export async function refreshConnectionRecord(
    connection: Record<string, unknown>,
    options: { workspaceBasePath?: string } = {}
) {
    return await resolveConnectionRecord(connection, options);
}

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
        connection?.instanceUrl &&
            connection?.accessToken &&
            !connection?.sessionHasExpired &&
            !connection?.hasError
    );
}

// ── Org banner context ───────────────────────────────────────────────────────

const ORG_ENVIRONMENT_TYPES = {
    production: 'production',
    sandbox: 'sandbox',
    scratch: 'scratch',
    trailhead: 'trailhead',
    dev: 'dev',
    unknown: 'unknown',
} as const;

type OrgEnvironmentType = (typeof ORG_ENVIRONMENT_TYPES)[keyof typeof ORG_ENVIRONMENT_TYPES];

function resolveEnvironmentType(
    organizationType: string,
    isSandbox: boolean | null,
    isScratch: boolean | null
): OrgEnvironmentType {
    if (isScratch === true) return ORG_ENVIRONMENT_TYPES.scratch;
    if (isSandbox === true) return ORG_ENVIRONMENT_TYPES.sandbox;
    if (isSandbox === false) return ORG_ENVIRONMENT_TYPES.production;
    const type = organizationType.toLowerCase();
    if (type === 'trailhead') return ORG_ENVIRONMENT_TYPES.trailhead;
    if (type === 'dev') return ORG_ENVIRONMENT_TYPES.dev;
    return ORG_ENVIRONMENT_TYPES.unknown;
}

function buildOrgEnvironmentSummary(environmentType: OrgEnvironmentType) {
    switch (environmentType) {
        case ORG_ENVIRONMENT_TYPES.production:
            return {
                label: 'Production org',
                tone: 'danger',
                caution: 'This is a production org, be careful.',
            };
        case ORG_ENVIRONMENT_TYPES.sandbox:
            return { label: 'Sandbox org', tone: 'info', caution: 'This is a sandbox org.' };
        case ORG_ENVIRONMENT_TYPES.scratch:
            return { label: 'Scratch org', tone: 'info', caution: 'This is a scratch org.' };
        case ORG_ENVIRONMENT_TYPES.trailhead:
            return { label: 'Trailhead org', tone: 'info', caution: 'This is a Trailhead org.' };
        case ORG_ENVIRONMENT_TYPES.dev:
            return { label: 'Dev org', tone: 'info', caution: 'This is a dev org.' };
        default:
            return { label: 'Salesforce org', tone: 'neutral', caution: '' };
    }
}

function buildOrgDisplayName(connection: Record<string, unknown> = {}) {
    const displayName = normalizeText(connection.displayName);
    if (displayName) return displayName;
    const organizationName = normalizeText(connection.organizationName);
    if (organizationName) return organizationName;
    const username = normalizeText(connection.username);
    if (username) return username;
    const host = getOrgHost({ instanceUrl: String(connection.instanceUrl || '') });
    if (host) return host;
    const orgId = normalizeText(connection.orgId);
    if (orgId) return orgId;
    return '';
}

export function buildOrgContext(connection: Record<string, unknown> = {}) {
    const safeConnection =
        connection && typeof connection === 'object' ? (connection as Record<string, unknown>) : {};
    const hasConnection = Boolean(
        safeConnection.hasConnection ||
            (safeConnection.instanceUrl && safeConnection.accessToken)
    );

    const organizationType = normalizeText(safeConnection.organizationType);
    const isSandbox = normalizeSandboxValue(safeConnection.isSandbox);
    const isScratch = normalizeScratchValue(safeConnection.isScratch);
    const environmentType = resolveEnvironmentType(organizationType, isSandbox, isScratch);
    const summary = buildOrgEnvironmentSummary(environmentType);

    const displayName = buildOrgDisplayName(safeConnection) || 'Salesforce org';
    const instanceUrl = normalizeText(safeConnection.instanceUrl);
    const host = getOrgHost({
        instanceUrl: instanceUrl || String(safeConnection.host || ''),
    });
    const organizationName = normalizeText(safeConnection.organizationName);
    const username = normalizeText(safeConnection.username);
    const orgId = normalizeText(safeConnection.orgId);

    return {
        hasConnection,
        instanceUrl,
        displayName,
        host,
        username,
        orgId,
        organizationName,
        organizationType,
        isScratch,
        isSandbox,
        environmentType,
        environmentLabel: summary.label,
        tone: summary.tone,
        bannerTitle: `Welcome to ${displayName}.`,
        bannerMessage: summary.caution,
    };
}

// ── Workspace bootstrap / seeding ────────────────────────────────────────────

function prefixWorkspaceFiles(workspaceRoot: string, files: Record<string, string>) {
    const rooted: Record<string, string> = {};
    for (const [relativePath, content] of Object.entries(files || {})) {
        rooted[`${workspaceRoot}/${relativePath}`] = content;
    }
    return rooted;
}

function ancestorPaths(path: string): string[] {
    const parts = path.split('/').filter(Boolean);
    const ancestors: string[] = [];
    for (let i = 1; i < parts.length; i++) {
        ancestors.push('/' + parts.slice(0, i).join('/'));
    }
    return ancestors;
}

export async function buildWorkspaceBootstrap(
    connection: { orgId?: unknown; instanceUrl?: unknown } | null | undefined,
    workspaceBasePath = '/workspace/orgs'
) {
    const workspaceRoot = deriveWorkspaceRootFromConnection(connection, workspaceBasePath);
    const defaultMetadataRoot = `${workspaceRoot}/force-app/main/default`;
    return {
        workspaceRoot,
        ensureDirectories: [
            ...ancestorPaths(workspaceRoot),
            workspaceRoot,
            `${workspaceRoot}/.vscode`,
            `${workspaceRoot}/.salesforce`,
            defaultMetadataRoot,
            ...DEFAULT_METADATA_DIRECTORIES.map(dir => `${defaultMetadataRoot}/${dir}`),
            `${workspaceRoot}/assets`,
            `${workspaceRoot}/assets/apex`,
            `${workspaceRoot}/assets/soql`,
        ],
        initialFiles: prefixWorkspaceFiles(workspaceRoot, WORKSPACE_TEMPLATE_FILES),
    };
}

export async function seedWorkspaceFiles(
    app: { _workspaceRoot?: string; _appFs?: unknown },
    {
        getIndexedDbFileSystem,
        ensureDirectories = [],
        initialFiles = {},
        workspaceRoot,
    }: {
        getIndexedDbFileSystem: (options: {
            ensureDirectories?: string[];
            initialFiles?: Record<string, string>;
        }) => {
            ready?: Promise<unknown>;
            mkdir?: (path: string, options?: { recursive?: boolean }) => Promise<unknown>;
            registerInitialFiles?: (files: Record<string, string>) => Promise<unknown>;
        };
        ensureDirectories?: string[];
        initialFiles?: Record<string, string>;
        workspaceRoot?: string;
    }
) {
    const root = workspaceRoot || app?._workspaceRoot || '/workspace';
    const directoriesToEnsure =
        ensureDirectories.length > 0
            ? ensureDirectories
            : [root, `${root}/.vscode`, `${root}/force-app/main/default`, `${root}/.salesforce`];

    const fs = getIndexedDbFileSystem({
        ensureDirectories: directoriesToEnsure,
        initialFiles,
    });
    app._appFs = fs;
    await fs?.ready;
    for (const dir of directoriesToEnsure) {
        await fs?.mkdir?.(dir, { recursive: true }).catch(() => {});
    }
    if (initialFiles && Object.keys(initialFiles).length > 0) {
        await fs?.registerInitialFiles?.(initialFiles).catch(() => {});
    }
}
