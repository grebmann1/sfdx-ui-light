import {
    getOrgHost,
    normalizeScratchValue,
    normalizeSandboxValue,
} from 'core/connector';

export const ORG_ENVIRONMENT_TYPES = {
    production: 'production',
    sandbox: 'sandbox',
    scratch: 'scratch',
    trailhead: 'trailhead',
    dev: 'dev',
    unknown: 'unknown',
} as const;

export type OrgEnvironmentType = (typeof ORG_ENVIRONMENT_TYPES)[keyof typeof ORG_ENVIRONMENT_TYPES];

type ConnectionLike = Record<string, unknown>;

function normalizeConnectionInput(connection: unknown): ConnectionLike {
    return connection && typeof connection === 'object' ? (connection as ConnectionLike) : {};
}

function normalizeText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

/**
 * Derives a simplified environment type from the already-normalized connection fields.
 * `buildConnectionFromConnector` has already run inference; we just classify here.
 */
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
            return {
                label: 'Sandbox org',
                tone: 'info',
                caution: 'This is a sandbox org.',
            };
        case ORG_ENVIRONMENT_TYPES.scratch:
            return {
                label: 'Scratch org',
                tone: 'info',
                caution: 'This is a scratch org.',
            };
        case ORG_ENVIRONMENT_TYPES.trailhead:
            return {
                label: 'Trailhead org',
                tone: 'info',
                caution: 'This is a Trailhead org.',
            };
        case ORG_ENVIRONMENT_TYPES.dev:
            return {
                label: 'Dev org',
                tone: 'info',
                caution: 'This is a dev org.',
            };
        default:
            return {
                label: 'Salesforce org',
                tone: 'neutral',
                caution: '',
            };
    }
}

export function buildOrgDisplayName(connection: ConnectionLike = {}) {
    const safeConnection = normalizeConnectionInput(connection);
    const displayName = normalizeText(safeConnection.displayName);
    if (displayName) {
        return displayName;
    }

    const organizationName = normalizeText(safeConnection.organizationName);
    if (organizationName) {
        return organizationName;
    }

    const username = normalizeText(safeConnection.username);
    if (username) {
        return username;
    }

    const host = getOrgHost({ instanceUrl: String(safeConnection.instanceUrl || '') });
    if (host) {
        return host;
    }

    const orgId = normalizeText(safeConnection.orgId);
    if (orgId) {
        return orgId;
    }

    return '';
}

export function buildOrgContext(connection: ConnectionLike = {}) {
    const safeConnection = normalizeConnectionInput(connection);
    const hasConnection = Boolean(
        safeConnection.hasConnection || (safeConnection.instanceUrl && safeConnection.accessToken)
    );

    const organizationType = normalizeText(safeConnection.organizationType);
    const isSandbox = normalizeSandboxValue(safeConnection.isSandbox);
    const isScratch = normalizeScratchValue(safeConnection.isScratch);
    const environmentType = resolveEnvironmentType(organizationType, isSandbox, isScratch);
    const summary = buildOrgEnvironmentSummary(environmentType);

    const displayName = buildOrgDisplayName(safeConnection) || 'Salesforce org';
    const instanceUrl = normalizeText(safeConnection.instanceUrl);
    const host = getOrgHost({ instanceUrl: instanceUrl || String(safeConnection.host || '') });
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
