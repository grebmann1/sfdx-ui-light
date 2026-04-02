import {
    Connector,
    credentialStrategies,
    getConfiguration,
    normalizeConnection,
    OAUTH_TYPES,
    platformService,
    removeSession,
    saveSession,
} from 'core/connector';
import { clearStoredWorkspaceRoot, saveStoredWorkspaceRoot } from './activeConnection.js';

export function getConnectionAuthType(configuration) {
    switch (configuration?.credentialType) {
        case OAUTH_TYPES.OAUTH:
            return 'oauth';
        case OAUTH_TYPES.SESSION:
            return 'session';
        case OAUTH_TYPES.USERNAME:
            return 'username';
        default:
            return 'manual';
    }
}

export function isAuthError(err) {
    const status = err?.status;
    if (status === 401) return true;
    const msg = String(err?.message || '').toUpperCase();
    return msg.includes('INVALID_SESSION_ID') || msg.includes('INVALID_SESSION') || msg.includes('(401)');
}

export async function connectUsingSharedConfiguration(configuration) {
    if (!configuration?.alias || !configuration?.credentialType) {
        throw new Error('Selected connection is missing alias or credential type.');
    }

    if (configuration.credentialType === OAUTH_TYPES.OAUTH) {
        return await credentialStrategies[OAUTH_TYPES.OAUTH].connect(
            {
                alias: configuration.alias,
                loginUrl: configuration.instanceUrl || configuration.loginUrl,
                username: configuration.username,
            },
            { persist: true }
        );
    }

    if (configuration.credentialType === OAUTH_TYPES.SESSION) {
        return await credentialStrategies[OAUTH_TYPES.SESSION].connect({
            alias: configuration.alias,
            sessionId: configuration.sessionId || configuration.accessToken,
            serverUrl: configuration.instanceUrl || configuration.loginUrl,
        });
    }

    if (configuration.credentialType === OAUTH_TYPES.USERNAME) {
        return await credentialStrategies[OAUTH_TYPES.USERNAME].connect(
            {
                alias: configuration.alias,
                username: configuration.username,
                password: configuration.password,
                loginUrl: configuration.instanceUrl || configuration.loginUrl,
            },
            { saveFullConfiguration: true }
        );
    }

    throw new Error(`Unsupported connection type "${configuration.credentialType}".`);
}

export function toStoredConnectionFromConnector(connector, fallback = {}) {
    const configuration = connector?.configuration || {};
    const connection = connector?.conn || {};
    const userInfo = configuration.userInfo || {};

    return {
        instanceUrl: connection.instanceUrl || configuration.instanceUrl || fallback.instanceUrl || '',
        apiVersion: connection.version || configuration.version || fallback.apiVersion || '63.0',
        accessToken: connection.accessToken || configuration.accessToken || fallback.accessToken || '',
        authType: getConnectionAuthType(configuration),
        sharedAlias: configuration.alias || fallback.sharedAlias || '',
        oauthConnectionId: fallback.oauthConnectionId || '',
        username: configuration.username || userInfo.username || fallback.username || '',
        userId: userInfo.user_id || configuration.userId || fallback.userId || '',
        orgId: configuration.orgId || userInfo.organization_id || fallback.orgId || '',
        workspaceRoot: fallback.workspaceRoot || '',
    };
}

function toSharedSessionPayload(configuration, conn) {
    const userInfo = configuration?.userInfo || {};
    return {
        ...configuration,
        authType: conn.authType || getConnectionAuthType(configuration),
        instanceUrl: conn.instanceUrl || configuration?.instanceUrl || '',
        accessToken: conn.accessToken || configuration?.accessToken || '',
        instanceApiVersion: conn.apiVersion || configuration?.version || '63.0',
        refreshToken: configuration?.refreshToken || '',
        username: conn.username || configuration?.username || userInfo?.username || '',
        userId: conn.userId || configuration?.userId || userInfo?.user_id || '',
        orgId: conn.orgId || configuration?.orgId || userInfo?.organization_id || '',
    };
}

function toSessionPayload(conn, configuration = null) {
    if (configuration?.credentialType === OAUTH_TYPES.OAUTH || configuration?.credentialType === OAUTH_TYPES.USERNAME) {
        return toSharedSessionPayload(configuration, conn);
    }

    return {
        credentialType: OAUTH_TYPES.SESSION,
        authType: conn.authType || 'session',
        sessionId: conn.accessToken,
        serverUrl: conn.instanceUrl,
        instanceUrl: conn.instanceUrl,
        accessToken: conn.accessToken,
        instanceApiVersion: conn.apiVersion || '63.0',
        username: conn.username || '',
        userId: conn.userId || '',
        orgId: conn.orgId || '',
    };
}

export async function syncSelectedConnectionSession(conn, { connector = null } = {}) {
    if (!conn?.instanceUrl || !conn?.accessToken) {
        await removeSession().catch(() => {});
        return;
    }

    let configuration = connector?.configuration || null;
    if (!configuration && conn?.sharedAlias) {
        configuration = await getConfiguration(conn.sharedAlias).catch(() => null);
    }

    await saveSession(toSessionPayload(conn, configuration)).catch(() => {});
}

function buildOauthRefreshConnector(configuration) {
    const connection = new window.jsforce.Connection(
        normalizeConnection(
            OAUTH_TYPES.OAUTH,
            {
                ...configuration,
                accessToken: '',
                sessionId: '',
            },
            platformService.getCurrentPlatform()
        )
    );

    return new Connector({ ...configuration }, connection);
}

async function refreshSharedOauthConfiguration(configuration) {
    if (!configuration?.alias || !configuration?.refreshToken) {
        throw new Error('Selected OAuth connection is missing a refresh token.');
    }

    const connector = buildOauthRefreshConnector(configuration);
    const jwt = await connector.generateAccessToken();
    if (connector.hasError) {
        throw new Error(connector.errorMessage || 'Unable to refresh Salesforce access token.');
    }

    const accessToken = jwt?.access_token || connector?.conn?.accessToken || '';
    const instanceUrl = jwt?.instance_url || connector?.conn?.instanceUrl || configuration.instanceUrl || '';
    const refreshToken = jwt?.refresh_token || connector?.conn?.refreshToken || configuration.refreshToken || '';
    if (!accessToken || !instanceUrl) {
        throw new Error('Refresh response did not include a usable Salesforce access token.');
    }

    Object.assign(connector.conn, {
        accessToken,
        instanceUrl,
        refreshToken,
    });

    const nextConfiguration = {
        ...configuration,
        accessToken,
        instanceUrl,
        refreshToken,
    };

    const enrichedConnector = await Connector.createConnector({
        alias: configuration.alias,
        connection: connector.conn,
        configuration: nextConfiguration,
        credentialType: OAUTH_TYPES.OAUTH,
    });

    await platformService.saveConfiguration(configuration.alias, enrichedConnector.configuration);
    return enrichedConnector;
}

async function getRefreshedConnectorForConfiguration(configuration, { forceRefresh = false } = {}) {
    if (!configuration?.alias || !configuration?.credentialType) {
        throw new Error('Selected connection is missing alias or credential type.');
    }

    if (forceRefresh && configuration.credentialType === OAUTH_TYPES.OAUTH) {
        return await refreshSharedOauthConfiguration(configuration);
    }

    try {
        return await connectUsingSharedConfiguration(configuration);
    } catch (error) {
        if (configuration.credentialType !== OAUTH_TYPES.OAUTH || !configuration.refreshToken || !isAuthError(error)) {
            throw error;
        }
        return await refreshSharedOauthConfiguration(configuration);
    }
}

async function persistResolvedConnection(connection) {
    saveStoredWorkspaceRoot(connection.workspaceRoot || '');
    await syncSelectedConnectionSession(connection);
}

export async function persistActiveConnection(connection, options = {}) {
    saveStoredWorkspaceRoot(connection?.workspaceRoot || '');
    await syncSelectedConnectionSession(connection, options);
    return connection;
}

export async function clearActiveConnection() {
    clearStoredWorkspaceRoot();
    await removeSession().catch(() => {});
}

export async function resolveStoredConnection(connection, { persist = true, forceRefresh = false } = {}) {
    const sharedAlias = String(connection?.sharedAlias || '').trim();
    if (!sharedAlias) {
        return connection;
    }

    const configuration = await getConfiguration(sharedAlias).catch(() => null);
    if (!configuration?.alias || !configuration?.credentialType) {
        return connection;
    }

    const connector = await getRefreshedConnectorForConfiguration(configuration, { forceRefresh });
    const resolved = toStoredConnectionFromConnector(connector, {
        ...connection,
        sharedAlias: configuration.alias,
    });

    if (persist) {
        await persistResolvedConnection(resolved);
    }

    return resolved;
}

export async function refreshStoredConnection(connection, { persist = true } = {}) {
    return await resolveStoredConnection(connection, { persist, forceRefresh: true });
}
