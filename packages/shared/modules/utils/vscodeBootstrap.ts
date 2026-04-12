export type VscodeBootstrapSeed = {
    alias?: string | null;
    sessionId?: string | null;
    serverUrl?: string | null;
    redirectUrl?: string | null;
    sourceTabId?: string | null;
};

export type NormalizedVscodeBootstrapSeed = {
    alias: string | null;
    sessionId: string | null;
    serverUrl: string | null;
    redirectUrl: string | null;
    sourceTabId: string | null;
};

function normalizeTextValue(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
}

function buildVscodeEditorSearchParams(seed: NormalizedVscodeBootstrapSeed): URLSearchParams {
    const params = new URLSearchParams();
    if (seed.sessionId && seed.serverUrl) {
        params.set('sessionId', seed.sessionId);
        params.set('serverUrl', seed.serverUrl);
    }
    if (seed.alias) {
        params.set('alias', seed.alias);
    }
    if (seed.redirectUrl) {
        params.set('redirectUrl', seed.redirectUrl);
    }
    if (seed.sourceTabId) {
        params.set('sourceTabId', seed.sourceTabId);
    }
    return params;
}

export function normalizeVscodeBootstrapSeed(
    seed: VscodeBootstrapSeed = {}
): NormalizedVscodeBootstrapSeed {
    const sessionId = normalizeTextValue(seed.sessionId);
    const serverUrl = normalizeTextValue(seed.serverUrl);
    const hasSessionBootstrap = Boolean(sessionId && serverUrl);
    return {
        alias: normalizeTextValue(seed.alias),
        sessionId: hasSessionBootstrap ? sessionId : null,
        serverUrl: hasSessionBootstrap ? serverUrl : null,
        redirectUrl: normalizeTextValue(seed.redirectUrl),
        sourceTabId: normalizeTextValue(seed.sourceTabId),
    };
}

export function hasVscodeSessionBootstrap(seed: VscodeBootstrapSeed = {}): boolean {
    const normalizedSeed = normalizeVscodeBootstrapSeed(seed);
    return Boolean(normalizedSeed.sessionId && normalizedSeed.serverUrl);
}

export function hasVscodeAliasBootstrap(seed: VscodeBootstrapSeed = {}): boolean {
    return Boolean(normalizeVscodeBootstrapSeed(seed).alias);
}

export function hasVscodeExplicitBootstrap(seed: VscodeBootstrapSeed = {}): boolean {
    return hasVscodeSessionBootstrap(seed) || hasVscodeAliasBootstrap(seed);
}

export function hasVscodeBootstrapEntrySeed(seed: VscodeBootstrapSeed = {}): boolean {
    const normalizedSeed = normalizeVscodeBootstrapSeed(seed);
    return hasVscodeExplicitBootstrap(normalizedSeed) || Boolean(normalizedSeed.sourceTabId);
}

export function parseVscodeBootstrapSeed(
    search: string | URLSearchParams
): NormalizedVscodeBootstrapSeed {
    const params =
        typeof search === 'string'
            ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
            : search;
    return normalizeVscodeBootstrapSeed({
        alias: params.get('alias'),
        sessionId: params.get('sessionId'),
        serverUrl: params.get('serverUrl'),
        redirectUrl: params.get('redirectUrl'),
        sourceTabId: params.get('sourceTabId'),
    });
}

export function buildVscodeEditorUrl({
    baseUrl,
    seed,
    baseOrigin = 'https://sf-toolkit.invalid',
}: {
    baseUrl: string;
    seed: VscodeBootstrapSeed;
    baseOrigin?: string;
}): string | null {
    const normalizedSeed = normalizeVscodeBootstrapSeed(seed);
    if (!hasVscodeExplicitBootstrap(normalizedSeed)) {
        return null;
    }
    const url = new URL(baseUrl, baseOrigin);
    url.search = buildVscodeEditorSearchParams(normalizedSeed).toString();
    return url.href;
}
