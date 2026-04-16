export const SESSION_BOOTSTRAP_STORAGE_KEYS = {
    sessionId: 'sfSessionId',
    serverUrl: 'sfServerUrl',
} as const;

function normalizeText(value: unknown): string {
    return String(value || '').trim();
}

function normalizeWorkspacePath(value: unknown): string {
    const normalized = normalizeText(value).replace(/\\/g, '/');
    if (!normalized) {
        return '';
    }
    return `/${normalized.replace(/^\/+/, '').replace(/\/+$/, '')}`;
}

export function resolveBootstrapMode(seed: {
    alias?: unknown;
    sessionId?: unknown;
    serverUrl?: unknown;
}): 'session' | 'alias' | 'none' {
    if (normalizeText(seed?.sessionId) && normalizeText(seed?.serverUrl)) {
        return 'session';
    }
    if (normalizeText(seed?.alias)) {
        return 'alias';
    }
    return 'none';
}

export function shouldUsePersistedBootstrapSeed({
    sourceTabId,
    hasExplicitBootstrap = false,
}: {
    sourceTabId?: unknown;
    hasExplicitBootstrap?: boolean;
}): boolean {
    return !normalizeText(sourceTabId) || Boolean(hasExplicitBootstrap);
}

export function shouldUsePersistedSessionBootstrap({
    alias,
    sessionId,
    serverUrl,
}: {
    alias?: unknown;
    sessionId?: unknown;
    serverUrl?: unknown;
}): boolean {
    const hasExplicitAlias = Boolean(normalizeText(alias));
    const hasExplicitSessionSeed = Boolean(normalizeText(sessionId) || normalizeText(serverUrl));
    return hasExplicitSessionSeed || !hasExplicitAlias;
}

export function isSessionAuthErrorMessage(message: unknown): boolean {
    return /(session expired|invalid session|invalid_session_id)/i.test(String(message || ''));
}


export function shouldRemountWorkbenchWorkspace({
    previousWorkspaceRoot,
    nextWorkspaceRoot,
}: {
    previousWorkspaceRoot?: unknown;
    nextWorkspaceRoot?: unknown;
}): boolean {
    const previousRoot = normalizeWorkspacePath(previousWorkspaceRoot);
    const nextRoot = normalizeWorkspacePath(nextWorkspaceRoot);
    return Boolean(previousRoot && nextRoot && previousRoot !== nextRoot);
}
