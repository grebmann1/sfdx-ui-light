import { WORKSPACE_TEMPLATE_FILES } from '../templates/workspace/workspaceTemplate';
import { deriveWorkspaceRootFromConnection } from './workspaceIdentity';

export {
    deriveWorkspaceBaseRoot,
    deriveWorkspaceRootFromConnection,
    resolveWorkspaceRootForConnection,
} from './workspaceIdentity';

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

function prefixWorkspaceFiles(workspaceRoot: string, files: Record<string, string>) {
    const rooted: Record<string, string> = {};
    for (const [relativePath, content] of Object.entries(files || {})) {
        rooted[`${workspaceRoot}/${relativePath}`] = content;
    }
    return rooted;
}

/** Returns all intermediate ancestor paths of `path`, excluding '/' itself. */
function ancestorPaths(path: string): string[] {
    const parts = path.split('/').filter(Boolean);
    const ancestors: string[] = [];
    for (let i = 1; i < parts.length; i++) {
        ancestors.push('/' + parts.slice(0, i).join('/'));
    }
    return ancestors;
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
            ...ancestorPaths(workspaceRoot),
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
