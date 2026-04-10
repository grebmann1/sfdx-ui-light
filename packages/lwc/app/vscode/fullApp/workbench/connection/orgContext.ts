/* eslint-disable import/no-unresolved -- Rollup resolves core/connector alias */
import {
    getOrgHost,
    inferScratchValue,
    inferSandboxValue,
    normalizeOrganizationType,
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

export function inferOrgEnvironment({
    instanceUrl = '',
    isScratch = null,
    isSandbox = null,
    organizationType = '',
}: {
    instanceUrl?: string;
    isScratch?: boolean | null;
    isSandbox?: boolean | null;
    organizationType?: string;
} = {}) {
    const normalizedType = normalizeOrganizationType({
        organizationType,
        isSandbox,
        isScratch,
        instanceUrl,
    });
    const scratchFlag = inferScratchValue({
        instanceUrl,
        isScratch,
        organizationType: normalizedType,
    });
    if (scratchFlag === true) {
        return ORG_ENVIRONMENT_TYPES.scratch;
    }
    const sandboxFlag = inferSandboxValue({
        instanceUrl,
        isSandbox,
        organizationType: normalizedType,
    });
    if (sandboxFlag === true) {
        return ORG_ENVIRONMENT_TYPES.sandbox;
    }
    if (sandboxFlag === false) {
        return ORG_ENVIRONMENT_TYPES.production;
    }
    if (normalizedType.toLowerCase() === 'trailhead') {
        return ORG_ENVIRONMENT_TYPES.trailhead;
    }
    if (normalizedType.toLowerCase() === 'dev') {
        return ORG_ENVIRONMENT_TYPES.dev;
    }

    return ORG_ENVIRONMENT_TYPES.unknown;
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

    const host = getOrgHost(String(safeConnection.instanceUrl || ''));
    if (host) {
        return host;
    }

    const orgId = normalizeText(safeConnection.orgId);
    if (orgId) {
        return orgId;
    }

    return '';
}

function buildOrgEnvironmentSummary(environmentType: OrgEnvironmentType | string) {
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
                caution: 'Org type could not be confirmed.',
            };
    }
}

export function buildOrgContext(connection: ConnectionLike = {}) {
    const safeConnection = normalizeConnectionInput(connection);
    const hasConnection = Boolean(
        safeConnection.hasConnection || (safeConnection.instanceUrl && safeConnection.accessToken)
    );
    const envText = normalizeText(safeConnection.environmentType);
    const environmentType = (Object.values(ORG_ENVIRONMENT_TYPES) as string[]).includes(envText)
        ? (envText as OrgEnvironmentType)
        : inferOrgEnvironment({
              instanceUrl: String(safeConnection.instanceUrl || ''),
              isScratch: safeConnection.isScratch as boolean | null | undefined,
              isSandbox: safeConnection.isSandbox as boolean | null | undefined,
              organizationType: String(safeConnection.organizationType || ''),
          });
    const summary = buildOrgEnvironmentSummary(environmentType);
    const displayName = buildOrgDisplayName(safeConnection) || 'Salesforce org';
    const instanceUrl = normalizeText(safeConnection.instanceUrl);
    const host = getOrgHost(instanceUrl || String(safeConnection.host || ''));
    const organizationName = normalizeText(safeConnection.organizationName);
    const organizationTypeNorm = normalizeOrganizationType({
        organizationType: safeConnection.organizationType,
        isSandbox: safeConnection.isSandbox,
        isScratch: safeConnection.isScratch,
        instanceUrl,
    });
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
        organizationType: organizationTypeNorm,
        isScratch: normalizeScratchValue(safeConnection.isScratch),
        isSandbox: normalizeSandboxValue(safeConnection.isSandbox),
        environmentType,
        environmentLabel: summary.label,
        tone: summary.tone,
        bannerTitle: `Welcome to ${displayName}.`,
        bannerMessage: summary.caution,
    };
}
