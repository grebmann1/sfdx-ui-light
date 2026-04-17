const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

type UserWindow = {
    count: number;
    windowStart: number;
};

// In-memory store — resets on server restart
const windows = new Map<string, UserWindow>();

function getLimit(): number {
    const fromEnv = parseInt(process.env.AI_RATE_LIMIT_DAILY || '', 10);
    return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 100;
}

export type RateLimitResult = {
    allowed: boolean;
    remaining: number;
    resetAt: number; // epoch ms
    limit: number;
};

export function checkAndIncrement(userId: string): RateLimitResult {
    const limit = getLimit();
    const now = Date.now();
    const existing = windows.get(userId);

    if (!existing || now - existing.windowStart >= WINDOW_MS) {
        // Fresh window
        windows.set(userId, { count: 1, windowStart: now });
        return { allowed: true, remaining: limit - 1, resetAt: now + WINDOW_MS, limit };
    }

    const { count, windowStart } = existing;
    if (count >= limit) {
        return { allowed: false, remaining: 0, resetAt: windowStart + WINDOW_MS, limit };
    }

    windows.set(userId, { count: count + 1, windowStart });
    return { allowed: true, remaining: limit - count - 1, resetAt: windowStart + WINDOW_MS, limit };
}

export function getStatus(userId: string): RateLimitResult {
    const limit = getLimit();
    const now = Date.now();
    const existing = windows.get(userId);

    if (!existing || now - existing.windowStart >= WINDOW_MS) {
        return { allowed: true, remaining: limit, resetAt: now + WINDOW_MS, limit };
    }

    const { count, windowStart } = existing;
    return {
        allowed: count < limit,
        remaining: Math.max(0, limit - count),
        resetAt: windowStart + WINDOW_MS,
        limit,
    };
}
