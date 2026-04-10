import { WORKSPACE_TEMPLATE_FILES } from '../templates/workspace/workspaceTemplate';

const DEFAULT_METADATA_DIRECTORIES = [
    'applications',
    'aura',
    'classes',
    'contentassets',
    'flexipages',
    'layouts',
    'lwc',
    'objects',
    'permissionsets',
    'staticresources',
    'tabs',
    'triggers',
];

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

function prefixWorkspaceFiles(workspaceRoot: string, files: Record<string, string>) {
    const rooted: Record<string, string> = {};
    for (const [relativePath, content] of Object.entries(files || {})) {
        rooted[`${workspaceRoot}/${relativePath}`] = content;
    }
    return rooted;
}

export async function buildWorkspaceBootstrap(
    connection: { orgId?: unknown; instanceUrl?: unknown } | null | undefined,
    workspaceBasePath = '/workspace/orgs'
) {
    const workspaceRoot = deriveWorkspaceRootFromConnection(connection, workspaceBasePath);
    const defaultMetadataRoot = `${workspaceRoot}/force-app/main/default`;
    return {
        workspaceRoot,
        ensureDirectories: [
            workspaceRoot,
            `${workspaceRoot}/.vscode`,
            `${workspaceRoot}/.salesforce`,
            defaultMetadataRoot,
            ...DEFAULT_METADATA_DIRECTORIES.map(dir => `${defaultMetadataRoot}/${dir}`),
            `${workspaceRoot}/assets`,
            `${workspaceRoot}/assets/apex`,
            `${workspaceRoot}/assets/soql`,
        ],
        initialFiles: prefixWorkspaceFiles(workspaceRoot, WORKSPACE_TEMPLATE_FILES),
    };
}
