export const SESSION_BOOTSTRAP_STORAGE_KEYS = {
    sessionId: 'sfSessionId',
    serverUrl: 'sfServerUrl',
    orgId: 'sfOrgId',
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

export function shouldRefreshWorkbenchStartupConnection({
    initialConnection,
    latestConnection,
}: {
    initialConnection?: {
        instanceUrl?: unknown;
        accessToken?: unknown;
        workspaceRoot?: unknown;
    } | null;
    latestConnection?: {
        instanceUrl?: unknown;
        accessToken?: unknown;
        workspaceRoot?: unknown;
    } | null;
}): boolean {
    const initialHasUsableConnection = Boolean(
        initialConnection?.instanceUrl && initialConnection?.accessToken
    );
    const latestHasUsableConnection = Boolean(
        latestConnection?.instanceUrl && latestConnection?.accessToken
    );
    if (!latestHasUsableConnection) {
        return false;
    }
    if (!initialHasUsableConnection) {
        return true;
    }
    return (
        normalizeWorkspacePath(initialConnection?.workspaceRoot) !==
        normalizeWorkspacePath(latestConnection?.workspaceRoot)
    );
}

export function shouldAwaitWorkbenchStartupBootstrap({
    bootstrapMode,
    hasUsableConnection = false,
}: {
    bootstrapMode?: 'session' | 'alias' | 'none' | unknown;
    hasUsableConnection?: boolean;
}): boolean {
    return !hasUsableConnection && (bootstrapMode === 'session' || bootstrapMode === 'alias');
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
