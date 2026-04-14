function sanitizeSegment(value: unknown) {
    const raw = String(value || '').trim();
    if (!raw) {
        return '';
    }
    return raw
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeWorkspacePath(value: unknown, fallback = '') {
    const raw = String(value || fallback || '')
        .trim()
        .replace(/\\/g, '/');
    if (!raw) {
        return fallback || '';
    }
    return `/${raw.replace(/^\/+/, '').replace(/\/+$/, '')}`;
}

export function deriveWorkspaceBaseRoot(value = '/workspace/orgs') {
    const raw = String(value || '')
        .trim()
        .replace(/\\/g, '/');
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

export function deriveWorkspaceRootFromConnection(
    connection: { orgId?: unknown; instanceUrl?: unknown } | null | undefined,
    workspaceBasePath = '/workspace/orgs'
) {
    const baseRoot = deriveWorkspaceBaseRoot(workspaceBasePath);
    let segment = sanitizeSegment(connection?.orgId);
    if (!segment) {
        try {
            segment = sanitizeSegment(new URL(String(connection?.instanceUrl || '')).host);
        } catch {
            segment = '';
        }
    }
    if (!segment) {
        segment = 'org';
    }
    return `${baseRoot}/${segment}`;
}

export function resolveWorkspaceRootForConnection({
    connection,
    workspaceRoot,
    workspaceBasePath = '/workspace/orgs',
    defaultWorkspaceRoot = '/workspace',
}: {
    connection: { orgId?: unknown; instanceUrl?: unknown } | null | undefined;
    workspaceRoot?: unknown;
    workspaceBasePath?: string;
    defaultWorkspaceRoot?: string;
}) {
    const derivedRoot = normalizeWorkspacePath(
        deriveWorkspaceRootFromConnection(connection, workspaceBasePath),
        defaultWorkspaceRoot
    );
    const currentWorkspaceRoot = normalizeWorkspacePath(workspaceRoot, defaultWorkspaceRoot);
    const normalizedDefaultRoot = normalizeWorkspacePath(defaultWorkspaceRoot, '/workspace');
    if (!currentWorkspaceRoot || currentWorkspaceRoot === normalizedDefaultRoot) {
        return derivedRoot;
    }
    return sanitizeSegment(connection?.orgId) ? derivedRoot : currentWorkspaceRoot;
}
