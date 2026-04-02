import { OAUTH_TYPES } from 'core/connector';

const STORAGE = {
    workspaceRoot: 'sf_ext_workspaceRoot',
};

const LEGACY_STORAGE_KEYS = [
    'sf_ext_instanceUrl',
    'sf_ext_apiVersion',
    'sf_ext_accessToken',
    'sf_ext_authType',
    'sf_ext_sharedAlias',
    'sf_ext_oauthConnectionId',
    'sf_ext_username',
    'sf_ext_userId',
    'sf_ext_orgId',
];

function readLocalStorage(key, fallback = '') {
    try {
        return localStorage.getItem(key) || fallback;
    } catch {
        return fallback;
    }
}

function readSessionStorage(key, fallback = '') {
    try {
        return sessionStorage.getItem(key) || fallback;
    } catch {
        return fallback;
    }
}

function writeLocalStorage(key, value) {
    try {
        localStorage.setItem(key, value || '');
    } catch {
        // ignore
    }
}

function removeLocalStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch {
        // ignore
    }
}

function normalizeUrlValue(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
        return '';
    }
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed.replace(/\/+$/, '');
    }
    return `https://${trimmed.replace(/^\/+/, '').replace(/\/+$/, '')}`;
}

function readCurrentConnection() {
    const raw = readSessionStorage('currentConnection', '');
    if (!raw) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function toAuthType(credentialType) {
    switch (credentialType) {
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

export function loadStoredConnection() {
    const currentConnection = readCurrentConnection();
    const credentialType = currentConnection?.credentialType;
    const instanceUrl = normalizeUrlValue(currentConnection?.instanceUrl || currentConnection?.serverUrl || '');
    const accessToken = String(currentConnection?.accessToken || currentConnection?.sessionId || '').trim();
    const apiVersion = String(
        currentConnection?.instanceApiVersion || currentConnection?.version || currentConnection?.apiVersion || '63.0'
    ).trim() || '63.0';
    const userInfo = currentConnection?.userInfo || {};

    return {
        instanceUrl,
        apiVersion,
        accessToken,
        authType: currentConnection ? String(currentConnection?.authType || toAuthType(credentialType)).trim() : '',
        sharedAlias: credentialType === OAUTH_TYPES.OAUTH || credentialType === OAUTH_TYPES.USERNAME
            ? String(currentConnection?.alias || '').trim()
            : '',
        oauthConnectionId: '',
        username: String(currentConnection?.username || userInfo?.username || '').trim(),
        userId: String(currentConnection?.userId || userInfo?.user_id || '').trim(),
        orgId: String(currentConnection?.orgId || userInfo?.organization_id || '').trim(),
        workspaceRoot: readLocalStorage(STORAGE.workspaceRoot, ''),
    };
}

export function saveStoredWorkspaceRoot(workspaceRoot = '') {
    writeLocalStorage(STORAGE.workspaceRoot, workspaceRoot || '');
}

export function clearStoredWorkspaceRoot() {
    removeLocalStorage(STORAGE.workspaceRoot);
    for (const key of LEGACY_STORAGE_KEYS) {
        removeLocalStorage(key);
    }
}

export function parseUrlConnectionParams(locationLike = window?.location) {
    try {
        const params = new URLSearchParams(locationLike?.search || '');
        const accessToken = String(params.get('accessToken') || params.get('sessionId') || '').trim();
        const instanceUrl = normalizeUrlValue(params.get('serverUrl') || params.get('instanceUrl') || '');
        if (!accessToken || !instanceUrl) {
            return null;
        }
        return {
            instanceUrl,
            accessToken,
            apiVersion: String(params.get('apiVersion') || '63.0').trim() || '63.0',
            authType: 'url',
            sharedAlias: '',
            username: String(params.get('username') || '').trim(),
            userId: String(params.get('userId') || '').trim(),
            orgId: String(params.get('orgId') || '').trim(),
            oauthConnectionId: '',
            workspaceRoot: '',
        };
    } catch {
        return null;
    }
}

export function clearUrlConnectionParams(locationLike = window?.location) {
    try {
        const url = new URL(locationLike?.href || window.location.href);
        const keys = ['accessToken', 'sessionId', 'serverUrl', 'instanceUrl', 'apiVersion', 'username', 'userId', 'orgId'];
        let changed = false;
        for (const key of keys) {
            if (url.searchParams.has(key)) {
                url.searchParams.delete(key);
                changed = true;
            }
        }
        if (changed) {
            window.history.replaceState({}, document.title, url.toString());
        }
    } catch {
        // ignore
    }
}

function sanitizeSegment(value) {
    return String(value || 'unnamed')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, ' ')
        .trim();
}

export function deriveWorkspaceBaseRoot(value = '/workspace/orgs') {
    const raw = String(value || '').trim().replace(/\\/g, '/');
    if (!raw) {
        return '/workspace/orgs';
    }
    const normalized = `/${raw.replace(/^\/+/, '').replace(/\/+$/, '')}`;
    if (normalized === '/workspace') {
        return '/workspace/orgs';
    }
    const marker = '/orgs/';
    if (normalized.includes(marker)) {
        return normalized.slice(0, normalized.indexOf(marker) + marker.length - 1);
    }
    return normalized;
}

export function deriveWorkspaceRootFromConnection(connection, workspaceBasePath = '/workspace/orgs') {
    const baseRoot = deriveWorkspaceBaseRoot(workspaceBasePath);
    let segment = sanitizeSegment(connection?.username || '');
    if (!segment) {
        try {
            segment = sanitizeSegment(new URL(String(connection?.instanceUrl || '')).host);
        } catch {
            segment = '';
        }
    }
    if (!segment) {
        segment = sanitizeSegment(connection?.orgId || 'org');
    }
    return `${baseRoot}/${segment}`;
}
