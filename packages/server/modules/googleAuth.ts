import crypto from 'node:crypto';
import type { Application, NextFunction, Request, Response } from 'express';

function googleCors(_req: Request, res: Response, next: NextFunction) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (_req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
    }
    next();
}
import { getStatus } from './userRateLimiter';

export type GoogleSession = {
    sessionToken: string;
    userId: string;
    email: string;
    name: string;
    picture: string;
    expiresAt: number;
};

// In-memory session store — resets on server restart
const sessions = new Map<string, GoogleSession>();

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function purgeExpiredSessions() {
    const now = Date.now();
    for (const [token, session] of sessions) {
        if (session.expiresAt <= now) {
            sessions.delete(token);
        }
    }
}

export function validateSession(token: string): GoogleSession | null {
    if (!token) return null;
    const session = sessions.get(token);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
        sessions.delete(token);
        return null;
    }
    return session;
}

async function fetchGoogleUserInfo(accessToken: string): Promise<{
    sub: string;
    email: string;
    name: string;
    picture: string;
} | null> {
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) return null;
        return (await response.json()) as {
            sub: string;
            email: string;
            name: string;
            picture: string;
        };
    } catch {
        return null;
    }
}

function buildGoogleAuthUrl(clientId: string, redirectUri: string, state: string): string {
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'online',
        state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeCodeForTokens(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
): Promise<{ access_token: string } | null> {
    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }),
        });
        if (!response.ok) return null;
        return (await response.json()) as { access_token: string };
    } catch {
        return null;
    }
}

export default function googleAuth(app: Application) {
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID_WEB;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET_WEB;

    if (!CLIENT_ID || !CLIENT_SECRET) {
        console.warn('[googleAuth] GOOGLE_CLIENT_ID_WEB or GOOGLE_CLIENT_SECRET_WEB not set — Google auth routes disabled');
        return;
    }

    // Clean up expired sessions every hour
    setInterval(purgeExpiredSessions, 60 * 60 * 1000);

    app.get('/google/oauth/authorize', (req: Request, res: Response) => {
        const host = req.get('host') || req.hostname;
        const redirectUri = `${req.protocol}://${host}/google/oauth/callback`;
        // state carries the origin so the popup can post the token back
        const state = Buffer.from(JSON.stringify({ origin: `${req.protocol}://${host}` })).toString('base64url');
        const url = buildGoogleAuthUrl(CLIENT_ID, redirectUri, state);
        res.redirect(url);
    });

    app.get('/google/oauth/callback', async (req: Request, res: Response) => {
        const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
        if (!code || typeof code !== 'string') {
            return res.status(400).send('Missing authorization code');
        }

        const host = req.get('host') || req.hostname;
        const redirectUri = `${req.protocol}://${host}/google/oauth/callback`;

        const tokens = await exchangeCodeForTokens(code, CLIENT_ID, CLIENT_SECRET, redirectUri);
        if (!tokens?.access_token) {
            return res.status(500).send('Failed to exchange authorization code');
        }

        const userInfo = await fetchGoogleUserInfo(tokens.access_token);
        if (!userInfo) {
            return res.status(500).send('Failed to fetch user info');
        }

        const sessionToken = crypto.randomUUID();
        const session: GoogleSession = {
            sessionToken,
            userId: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            expiresAt: Date.now() + SESSION_TTL_MS,
        };
        sessions.set(sessionToken, session);

        console.log(`[googleAuth] New session for ${userInfo.email} (${userInfo.sub})`);

        // Redirect to a page the popup can read — token in hash fragment
        res.redirect(`/google/callback#token=${sessionToken}&email=${encodeURIComponent(userInfo.email)}&name=${encodeURIComponent(userInfo.name)}&picture=${encodeURIComponent(userInfo.picture)}`);
    });

    app.get('/google/me', googleCors, (req: Request, res: Response) => {
        const authHeader = req.headers['authorization'];
        const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : null;
        if (!token) {
            return res.status(401).json({ error: 'Missing token' });
        }
        const session = validateSession(token);
        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }
        res.json({
            userId: session.userId,
            email: session.email,
            name: session.name,
            picture: session.picture,
            expiresAt: session.expiresAt,
        });
    });

    // Used by the Chrome extension: chrome.identity.getAuthToken() gives a Google access token
    // directly (Chrome handles the OAuth flow). We validate it against Google's userinfo API
    // and create a backend session. No client secret needed on this path.
    app.post('/google/oauth/verify-token', googleCors, async (req: Request, res: Response) => {
        const { accessToken } = req.body || {};
        if (!accessToken || typeof accessToken !== 'string') {
            return res.status(400).json({ error: 'Missing accessToken' });
        }
        const userInfo = await fetchGoogleUserInfo(accessToken);
        if (!userInfo) {
            return res.status(401).json({ error: 'Invalid or expired Google access token' });
        }
        const sessionToken = crypto.randomUUID();
        const session: GoogleSession = {
            sessionToken,
            userId: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            expiresAt: Date.now() + SESSION_TTL_MS,
        };
        sessions.set(sessionToken, session);
        console.log(`[googleAuth] New extension session for ${userInfo.email} (${userInfo.sub})`);
        res.json({
            token: sessionToken,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
        });
    });

    app.get('/google/rate-limit', googleCors, (req: Request, res: Response) => {
        const authHeader = req.headers['authorization'];
        const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : null;
        if (!token) {
            return res.status(401).json({ error: 'Missing token' });
        }
        const session = validateSession(token);
        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }
        const status = getStatus(session.userId);
        res.json({
            allowed: status.allowed,
            remaining: status.remaining,
            resetAt: status.resetAt,
            limit: status.limit,
        });
    });

    app.post('/google/oauth/logout', googleCors, (req: Request, res: Response) => {
        const authHeader = req.headers['authorization'];
        const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : null;
        if (token) {
            sessions.delete(token);
        }
        res.json({ ok: true });
    });
}
