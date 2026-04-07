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
};

function normalizeConnectionInput(connection) {
    return connection && typeof connection === 'object' ? connection : {};
}

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

export function inferOrgEnvironment({
    instanceUrl = '',
    isScratch = null,
    isSandbox = null,
    organizationType = '',
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

export function buildOrgDisplayName(connection = {}) {
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

    const host = getOrgHost(safeConnection.instanceUrl);
    if (host) {
        return host;
    }

    const orgId = normalizeText(safeConnection.orgId);
    if (orgId) {
        return orgId;
    }

    return '';
}

function buildOrgEnvironmentSummary(environmentType) {
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

export function buildOrgContext(connection = {}) {
    const safeConnection = normalizeConnectionInput(connection);
    const hasConnection = Boolean(
        safeConnection.hasConnection || (safeConnection.instanceUrl && safeConnection.accessToken)
    );
    const environmentType = Object.values(ORG_ENVIRONMENT_TYPES).includes(
        normalizeText(safeConnection.environmentType)
    )
        ? safeConnection.environmentType
        : inferOrgEnvironment(safeConnection);
    const summary = buildOrgEnvironmentSummary(environmentType);
    const displayName = buildOrgDisplayName(safeConnection) || 'Salesforce org';
    const instanceUrl = normalizeText(safeConnection.instanceUrl);
    const host = getOrgHost(instanceUrl || safeConnection.host);
    const organizationName = normalizeText(safeConnection.organizationName);
    const organizationType = normalizeOrganizationType({
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
        organizationType,
        isScratch: normalizeScratchValue(safeConnection.isScratch),
        isSandbox: normalizeSandboxValue(safeConnection.isSandbox),
        environmentType,
        environmentLabel: summary.label,
        tone: summary.tone,
        bannerTitle: `Welcome to ${displayName}.`,
        bannerMessage: summary.caution,
    };
}
