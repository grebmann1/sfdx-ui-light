import { DEFAULT_SOURCE_API_VERSION } from './templates/workspace/index.js';

export { DEFAULT_SOURCE_API_VERSION };

export const SFDX_PROJECT_FILE = 'sfdx-project.json';

const DEFAULT_SFDX_PROJECT = {
    packageDirectories: [
        {
            path: 'force-app',
            default: true,
        },
    ],
    name: 'MyProject',
    namespace: '',
    sfdcLoginUrl: 'https://login.salesforce.com',
    sourceApiVersion: DEFAULT_SOURCE_API_VERSION,
};

function normalizeWorkspaceRoot(workspaceRoot = '/workspace') {
    const raw = String(workspaceRoot || '').trim();
    if (!raw) {
        return '/workspace';
    }
    const normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
    return normalized ? `/${normalized}` : '/workspace';
}

export function normalizeSfApiVersion(apiVersion, fallback = DEFAULT_SOURCE_API_VERSION) {
    const normalizedFallback =
        String(fallback ?? DEFAULT_SOURCE_API_VERSION).trim() || DEFAULT_SOURCE_API_VERSION;
    const normalizedValue = String(apiVersion ?? '').trim();
    return normalizedValue || normalizedFallback;
}

export function parseSourceApiVersionFromSfdxProject(text, fallback = DEFAULT_SOURCE_API_VERSION) {
    const normalizedFallback = normalizeSfApiVersion(fallback, DEFAULT_SOURCE_API_VERSION);
    const raw = String(text ?? '').trim();
    if (!raw) {
        return normalizedFallback;
    }
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return normalizedFallback;
        }
        return normalizeSfApiVersion(parsed.sourceApiVersion, normalizedFallback);
    } catch {
        return normalizedFallback;
    }
}

export function toSfdxProjectJson(apiVersion = DEFAULT_SOURCE_API_VERSION, overrides = {}) {
    return JSON.stringify(
        {
            ...DEFAULT_SFDX_PROJECT,
            ...(overrides && typeof overrides === 'object' && !Array.isArray(overrides)
                ? overrides
                : {}),
            sourceApiVersion: normalizeSfApiVersion(apiVersion, DEFAULT_SOURCE_API_VERSION),
        },
        null,
        2
    );
}

export function updateSourceApiVersionInSfdxProject(
    text,
    apiVersion,
    fallback = DEFAULT_SOURCE_API_VERSION
) {
    const normalizedApiVersion = normalizeSfApiVersion(apiVersion, fallback);
    const raw = String(text ?? '').trim();
    if (!raw) {
        return toSfdxProjectJson(normalizedApiVersion);
    }
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return toSfdxProjectJson(normalizedApiVersion);
        }
        return toSfdxProjectJson(normalizedApiVersion, parsed);
    } catch {
        return toSfdxProjectJson(normalizedApiVersion);
    }
}

export async function resolveWorkspaceApiVersion({
    workspaceRoot = '/workspace',
    readFile,
    fallback = DEFAULT_SOURCE_API_VERSION,
} = {}) {
    const normalizedFallback = normalizeSfApiVersion(fallback, DEFAULT_SOURCE_API_VERSION);
    if (typeof readFile !== 'function') {
        return normalizedFallback;
    }
    const projectPath = `${normalizeWorkspaceRoot(workspaceRoot)}/${SFDX_PROJECT_FILE}`;
    try {
        const text = await readFile(projectPath);
        return parseSourceApiVersionFromSfdxProject(text, normalizedFallback);
    } catch {
        return normalizedFallback;
    }
}

export async function resolveWorkspaceApiVersionFromApp(
    app,
    {
        workspaceRoot = app?._workspaceRoot || '/workspace',
        fallback = app?.sfApiVersion || DEFAULT_SOURCE_API_VERSION,
    } = {}
) {
    if (!app?._appFs) {
        return normalizeSfApiVersion(fallback, DEFAULT_SOURCE_API_VERSION);
    }
    return await resolveWorkspaceApiVersion({
        workspaceRoot,
        fallback,
        readFile: path => app._appFs.readFile(path, 'utf8'),
    });
}

export async function resolveWorkspaceApiVersionFromVscode(
    vscode,
    { fallback = DEFAULT_SOURCE_API_VERSION } = {}
) {
    const normalizedFallback = normalizeSfApiVersion(fallback, DEFAULT_SOURCE_API_VERSION);
    const folder = Array.isArray(vscode?.workspace?.workspaceFolders)
        ? vscode.workspace.workspaceFolders[0]
        : null;
    const workspaceUri = folder?.uri;
    if (!workspaceUri || typeof vscode?.workspace?.fs?.readFile !== 'function') {
        return normalizedFallback;
    }
    try {
        const projectUri = vscode.Uri.joinPath(workspaceUri, SFDX_PROJECT_FILE);
        const bytes = await vscode.workspace.fs.readFile(projectUri);
        const text = new TextDecoder().decode(bytes || new Uint8Array());
        return parseSourceApiVersionFromSfdxProject(text, normalizedFallback);
    } catch {
        return normalizedFallback;
    }
}

export async function writeWorkspaceApiVersionFromVscode(
    vscode,
    apiVersion,
    { fallback = DEFAULT_SOURCE_API_VERSION } = {}
) {
    const normalizedApiVersion = normalizeSfApiVersion(apiVersion, fallback);
    const folder = Array.isArray(vscode?.workspace?.workspaceFolders)
        ? vscode.workspace.workspaceFolders[0]
        : null;
    const workspaceUri = folder?.uri;
    if (!workspaceUri || typeof vscode?.workspace?.fs?.writeFile !== 'function') {
        throw new Error('Workspace file system is not available.');
    }

    const projectUri = vscode.Uri.joinPath(workspaceUri, SFDX_PROJECT_FILE);
    let nextText = '';
    try {
        const bytes = await vscode.workspace.fs.readFile(projectUri);
        const text = new TextDecoder().decode(bytes || new Uint8Array());
        nextText = updateSourceApiVersionInSfdxProject(text, normalizedApiVersion, fallback);
    } catch {
        nextText = toSfdxProjectJson(normalizedApiVersion);
    }

    await vscode.workspace.fs.writeFile(projectUri, new TextEncoder().encode(nextText));
    return {
        apiVersion: normalizedApiVersion,
        uri: projectUri,
        text: nextText,
    };
}
