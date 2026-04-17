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

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Stateless HMAC-signed tokens — server restarts do not invalidate existing client tokens.
// Only the rate-limiter (in-memory) resets on restart, which is the intended behaviour.
let _signingSecret = '';

function getSigningSecret(): string {
    if (!_signingSecret) {
        _signingSecret =
            process.env.GOOGLE_SESSION_SECRET ||
            process.env.GOOGLE_CLIENT_SECRET_WEB ||
            '';
        if (!_signingSecret) {
            console.warn('[googleAuth] No signing secret found — sessions will not survive process restarts');
        }
    }
    return _signingSecret;
}

function mintSessionToken(data: Omit<GoogleSession, 'sessionToken'>): string {
    const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
    const sig = crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('base64url');
    return `${payload}.${sig}`;
}

export function validateSession(token: string): GoogleSession | null {
    if (!token) return null;
    const dot = token.lastIndexOf('.');
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('base64url');
    try {
        if (!crypto.timingSafeEqual(Buffer.from(sig, 'base64url'), Buffer.from(expected, 'base64url'))) {
            return null;
        }
    } catch {
        return null;
    }
    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Omit<GoogleSession, 'sessionToken'>;
        if (!data || data.expiresAt <= Date.now()) return null;
        return { ...data, sessionToken: token };
    } catch {
        return null;
    }
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

export default function googleAuth(app: Application) {
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET_WEB;

    if (!CLIENT_SECRET) {
        console.warn('[googleAuth] GOOGLE_CLIENT_SECRET_WEB not set — Google auth routes disabled');
        return;
    }

    // Prime the signing secret now that env vars are confirmed present.
    getSigningSecret();

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
        const sessionToken = mintSessionToken({
            userId: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            expiresAt: Date.now() + SESSION_TTL_MS,
        });
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

    app.post('/google/oauth/logout', googleCors, (_req: Request, res: Response) => {
        // Tokens are stateless — actual invalidation happens client-side by clearing the stored token.
        res.json({ ok: true });
    });
}
