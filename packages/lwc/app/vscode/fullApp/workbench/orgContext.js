export const ORG_ENVIRONMENT_TYPES = {
    production: 'production',
    sandbox: 'sandbox',
    unknown: 'unknown',
};

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

export function normalizeSandboxValue(value) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') {
            return true;
        }
        if (normalized === 'false') {
            return false;
        }
    }
    return null;
}

export function getOrgHost(instanceUrl) {
    const normalizedUrl = normalizeText(instanceUrl);
    if (!normalizedUrl) {
        return '';
    }

    try {
        return new URL(normalizedUrl).host;
    } catch {
        return normalizedUrl.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    }
}

export function inferOrgEnvironment({
    instanceUrl = '',
    isSandbox = null,
    organizationType = '',
} = {}) {
    const sandboxFlag = normalizeSandboxValue(isSandbox);
    if (sandboxFlag === true) {
        return ORG_ENVIRONMENT_TYPES.sandbox;
    }
    if (sandboxFlag === false) {
        return ORG_ENVIRONMENT_TYPES.production;
    }

    const normalizedType = normalizeText(organizationType).toLowerCase();
    if (normalizedType.includes('sandbox')) {
        return ORG_ENVIRONMENT_TYPES.sandbox;
    }
    if (normalizedType.includes('production')) {
        return ORG_ENVIRONMENT_TYPES.production;
    }

    const host = getOrgHost(instanceUrl).toLowerCase();
    if (host.includes('sandbox')) {
        return ORG_ENVIRONMENT_TYPES.sandbox;
    }

    return ORG_ENVIRONMENT_TYPES.unknown;
}

export function buildOrgDisplayName(connection = {}) {
    const sharedAlias = normalizeText(connection.sharedAlias);
    if (sharedAlias) {
        return sharedAlias;
    }

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
    const organizationType = normalizeText(connection.organizationType);
    const username = normalizeText(connection.username);
    const sharedAlias = normalizeText(connection.sharedAlias);
    const orgId = normalizeText(connection.orgId);

    return {
        hasConnection,
        instanceUrl,
        displayName,
        host,
        username,
        sharedAlias,
        orgId,
        organizationName,
        organizationType,
        isSandbox: normalizeSandboxValue(connection.isSandbox),
        environmentType,
        environmentLabel: summary.label,
        tone: summary.tone,
        bannerTitle: `Welcome to ${displayName}.`,
        bannerMessage: summary.caution,
    };
}
