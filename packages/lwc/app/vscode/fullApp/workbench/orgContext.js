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
    const displayName = normalizeText(connection.displayName);
    if (displayName) {
        return displayName;
    }

    const organizationName = normalizeText(connection.organizationName);
    if (organizationName) {
        return organizationName;
    }

    const username = normalizeText(connection.username);
    if (username) {
        return username;
    }

    const host = getOrgHost(connection.instanceUrl);
    if (host) {
        return host;
    }

    const orgId = normalizeText(connection.orgId);
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
    const hasConnection = Boolean(
        connection?.hasConnection || (connection?.instanceUrl && connection?.accessToken)
    );
    const environmentType = Object.values(ORG_ENVIRONMENT_TYPES).includes(
        normalizeText(connection.environmentType)
    )
        ? connection.environmentType
        : inferOrgEnvironment(connection);
    const summary = buildOrgEnvironmentSummary(environmentType);
    const displayName = buildOrgDisplayName(connection) || 'Salesforce org';
    const instanceUrl = normalizeText(connection.instanceUrl);
    const host = getOrgHost(instanceUrl || connection.host);
    const organizationName = normalizeText(connection.organizationName);
    const organizationType = normalizeOrganizationType({
        organizationType: connection.organizationType,
        isSandbox: connection.isSandbox,
        isScratch: connection.isScratch,
        instanceUrl,
    });
    const username = normalizeText(connection.username);
    const orgId = normalizeText(connection.orgId);

    return {
        hasConnection,
        instanceUrl,
        displayName,
        host,
        username,
        orgId,
        organizationName,
        organizationType,
        isScratch: normalizeScratchValue(connection.isScratch),
        isSandbox: normalizeSandboxValue(connection.isSandbox),
        environmentType,
        environmentLabel: summary.label,
        tone: summary.tone,
        bannerTitle: `Welcome to ${displayName}.`,
        bannerMessage: summary.caution,
    };
}
