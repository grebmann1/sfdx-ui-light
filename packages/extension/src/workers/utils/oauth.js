const OAUTH_KEYS = {
    loginUrl: 'oauth_login_url',
    clientId: 'oauth_client_id',
    connections: 'oauth_connections',
};

function base64UrlEncode(bytes) {
    const bin = Array.from(bytes, b => String.fromCharCode(b)).join('');
    const b64 = btoa(bin);
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomString(len = 64) {
    const bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    return base64UrlEncode(bytes);
}

async function sha256Base64Url(text) {
    const data = new TextEncoder().encode(String(text));
    const digest = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(new Uint8Array(digest));
}

export function normalizeLoginUrl(raw) {
    const fallback = 'https://login.salesforce.com';
    const value = String(raw || '').trim();
    if (!value) return fallback;
    try {
        const url = new URL(value);
        url.hash = '';
        url.search = '';
        url.pathname = (url.pathname || '').replace(/\/+$/, '');
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback;
        return url.toString();
    } catch {
        return fallback;
    }
}

export async function getOauthConfig() {
    const data = await chrome.storage.local.get([OAUTH_KEYS.loginUrl, OAUTH_KEYS.clientId]);
    return {
        loginUrl: normalizeLoginUrl(data[OAUTH_KEYS.loginUrl]),
        clientId: String(data[OAUTH_KEYS.clientId] || '').trim(),
    };
}

export async function listOauthConnections() {
    const data = await chrome.storage.local.get([OAUTH_KEYS.connections]);
    const list = Array.isArray(data[OAUTH_KEYS.connections]) ? data[OAUTH_KEYS.connections] : [];
    return list.filter(item => item && item.instanceUrl && (item.refreshToken || item.accessToken));
}

async function saveOauthConnections(connections) {
    await chrome.storage.local.set({
        [OAUTH_KEYS.connections]: Array.isArray(connections) ? connections : [],
    });
}

export async function oauthAuthorize({ loginUrl: loginUrlArg } = {}) {
    const config = await getOauthConfig();
    const loginUrl = normalizeLoginUrl(loginUrlArg || config.loginUrl);
    const clientId = config.clientId;
    if (!clientId) {
        return { error: 'Missing OAuth Client ID. Set it in extension options.' };
    }

    const redirectUri = chrome.identity.getRedirectURL('oauth2');
    const verifier = randomString(32);
    const challenge = await sha256Base64Url(verifier);
    const state = randomString(16);

    const authUrl = new URL(`${loginUrl}/services/oauth2/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'refresh_token api');
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('prompt', 'login');

    let responseUrl;
    try {
        responseUrl = await chrome.identity.launchWebAuthFlow({
            url: authUrl.toString(),
            interactive: true,
        });
    } catch (error) {
        return { error: error?.message || String(error) };
    }
    if (!responseUrl) return { error: 'No OAuth response URL returned.' };

    const url = new URL(responseUrl);
    const returnedState = url.searchParams.get('state') || '';
    if (returnedState && returnedState !== state) {
        return { error: 'OAuth state mismatch.' };
    }

    const code = url.searchParams.get('code');
    const oauthError = url.searchParams.get('error');
    if (oauthError) {
        return {
            error: `${oauthError}: ${url.searchParams.get('error_description') || ''}`.trim(),
        };
    }
    if (!code) return { error: 'Missing OAuth authorization code.' };

    const tokenResp = await fetch(`${loginUrl}/services/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            code,
            redirect_uri: redirectUri,
            code_verifier: verifier,
        }),
    });
    const tokenJson = await tokenResp.json().catch(() => ({}));
    if (!tokenResp.ok) {
        return {
            error:
                tokenJson?.error_description ||
                tokenJson?.error ||
                `Token error (${tokenResp.status})`,
        };
    }

    const instanceUrl = tokenJson.instance_url;
    const accessToken = tokenJson.access_token;
    const refreshToken = tokenJson.refresh_token || null;
    const idUrl = tokenJson.id || null;
    if (!instanceUrl || !accessToken) {
        return { error: 'Token response missing instance_url/access_token.' };
    }

    let username = null;
    let userId = null;
    let orgId = null;
    if (idUrl) {
        try {
            const idResp = await fetch(String(idUrl), {
                method: 'GET',
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const idJson = await idResp.json().catch(() => ({}));
            username = idJson?.username || null;
            userId = idJson?.user_id || idJson?.userId || null;
            orgId = idJson?.organization_id || idJson?.org_id || null;
        } catch {
            // Best-effort identity lookup.
        }
    }

    const connectionId =
        orgId && userId ? `${orgId}:${userId}` : `${instanceUrl}:${String(Date.now())}`;
    const connection = {
        id: connectionId,
        authHost: loginUrl,
        instanceUrl,
        accessToken,
        refreshToken,
        username,
        orgId,
        userId,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
    };

    const existing = await listOauthConnections();
    const next = existing.filter(item => item?.id !== connection.id);
    next.unshift(connection);
    await saveOauthConnections(next.slice(0, 25));
    return { connection };
}

export async function oauthRefresh(connectionId) {
    const config = await getOauthConfig();
    const clientId = config.clientId;
    if (!clientId) return { error: 'Missing OAuth Client ID. Set it in extension options.' };

    const connections = await listOauthConnections();
    const index = connections.findIndex(item => item?.id === connectionId);
    if (index < 0) return { error: 'Connection not found.' };

    const connection = connections[index];
    if (!connection?.refreshToken) {
        return { error: 'No refresh token stored for this connection.' };
    }

    const loginUrl = normalizeLoginUrl(connection.authHost || config.loginUrl);
    const resp = await fetch(`${loginUrl}/services/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: clientId,
            refresh_token: connection.refreshToken,
        }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        return {
            error: json?.error_description || json?.error || `Refresh error (${resp.status})`,
        };
    }

    const accessToken = json.access_token;
    const instanceUrl = json.instance_url || connection.instanceUrl;
    if (!accessToken) return { error: 'Refresh response missing access_token.' };

    const updated = {
        ...connection,
        accessToken,
        instanceUrl,
        lastUsedAt: new Date().toISOString(),
    };
    connections[index] = updated;
    await saveOauthConnections(connections);
    return { connection: updated };
}

export async function oauthLogout(connectionId) {
    const connections = await listOauthConnections();
    await saveOauthConnections(connections.filter(item => item?.id !== connectionId));
    return { ok: true };
}
