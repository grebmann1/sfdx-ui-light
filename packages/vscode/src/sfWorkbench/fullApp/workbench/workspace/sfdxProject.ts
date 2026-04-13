import { DEFAULT_SOURCE_API_VERSION } from '../templates/workspace/workspaceTemplate';

export { DEFAULT_SOURCE_API_VERSION };

export const SFDX_PROJECT_FILE = 'sfdx-project.json';
export const PACKAGE_XML_FILE = 'manifest/package.xml';

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

export function normalizeWorkspaceRoot(
    workspaceRoot: unknown = '/workspace',
    defaultRoot = '/workspace'
) {
    const raw = String(workspaceRoot || '').trim();
    if (!raw) {
        return defaultRoot;
    }
    const normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
    return normalized ? `/${normalized}` : defaultRoot;
}

export function normalizeSfApiVersion(apiVersion: unknown, fallback = DEFAULT_SOURCE_API_VERSION) {
    const normalizedFallback =
        String(fallback ?? DEFAULT_SOURCE_API_VERSION).trim() || DEFAULT_SOURCE_API_VERSION;
    const normalizedValue = String(apiVersion ?? '').trim();
    return normalizedValue || normalizedFallback;
}

export function parseSourceApiVersionFromSfdxProject(
    text: unknown,
    fallback = DEFAULT_SOURCE_API_VERSION
) {
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
        return normalizeSfApiVersion(
            (parsed as { sourceApiVersion?: unknown }).sourceApiVersion,
            normalizedFallback
        );
    } catch {
        return normalizedFallback;
    }
}

export function toSfdxProjectJson(
    apiVersion = DEFAULT_SOURCE_API_VERSION,
    overrides: Record<string, unknown> = {}
) {
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

export function toPackageXml(apiVersion = DEFAULT_SOURCE_API_VERSION) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <version>${normalizeSfApiVersion(apiVersion, DEFAULT_SOURCE_API_VERSION)}</version>
</Package>
`;
}

export function parseSourceApiVersionFromPackageXml(
    text: unknown,
    fallback = DEFAULT_SOURCE_API_VERSION
) {
    const normalizedFallback = normalizeSfApiVersion(fallback, DEFAULT_SOURCE_API_VERSION);
    const raw = String(text ?? '').trim();
    if (!raw) {
        return normalizedFallback;
    }
    const match = raw.match(/<version>\s*([^<]+?)\s*<\/version>/i);
    return normalizeSfApiVersion(match?.[1], normalizedFallback);
}

export function updateSourceApiVersionInSfdxProject(
    text: unknown,
    apiVersion: unknown,
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
        return toSfdxProjectJson(normalizedApiVersion, parsed as Record<string, unknown>);
    } catch {
        return toSfdxProjectJson(normalizedApiVersion);
    }
}

export function updateSourceApiVersionInPackageXml(
    text: unknown,
    apiVersion: unknown,
    fallback = DEFAULT_SOURCE_API_VERSION
) {
    const normalizedApiVersion = normalizeSfApiVersion(apiVersion, fallback);
    const raw = String(text ?? '');
    if (!raw.trim()) {
        return toPackageXml(normalizedApiVersion);
    }
    if (/<version>\s*([^<]+?)\s*<\/version>/i.test(raw)) {
        return raw.replace(
            /<version>\s*([^<]+?)\s*<\/version>/i,
            `<version>${normalizedApiVersion}</version>`
        );
    }
    if (/<\/Package>/i.test(raw)) {
        return raw.replace(
            /<\/Package>/i,
            `    <version>${normalizedApiVersion}</version>\n</Package>`
        );
    }
    return toPackageXml(normalizedApiVersion);
}

export async function resolveWorkspaceApiVersion({
    workspaceRoot = '/workspace',
    readFile,
    fallback = DEFAULT_SOURCE_API_VERSION,
}: {
    workspaceRoot?: string;
    readFile?: (path: string) => Promise<string>;
    fallback?: string;
} = {}) {
    const normalizedFallback = normalizeSfApiVersion(fallback, DEFAULT_SOURCE_API_VERSION);
    if (typeof readFile !== 'function') {
        return normalizedFallback;
    }
    const normalizedWorkspaceRoot = normalizeWorkspaceRoot(workspaceRoot);
    const projectPath = `${normalizedWorkspaceRoot}/${SFDX_PROJECT_FILE}`;
    try {
        const text = await readFile(projectPath);
        return parseSourceApiVersionFromSfdxProject(text, normalizedFallback);
    } catch {
        const packageXmlPath = `${normalizedWorkspaceRoot}/${PACKAGE_XML_FILE}`;
        try {
            const text = await readFile(packageXmlPath);
            return parseSourceApiVersionFromPackageXml(text, normalizedFallback);
        } catch {
            return normalizedFallback;
        }
    }
}

export async function resolveWorkspaceApiVersionFromApp(
    app: {
        _workspaceRoot?: string;
        sfApiVersion?: string;
        _appFs?: { readFile: (path: string, encoding: string) => Promise<string> };
    },
    {
        workspaceRoot = app?._workspaceRoot || '/workspace',
        fallback = app?.sfApiVersion || DEFAULT_SOURCE_API_VERSION,
    }: { workspaceRoot?: string; fallback?: string } = {}
) {
    if (!app?._appFs) {
        return normalizeSfApiVersion(fallback, DEFAULT_SOURCE_API_VERSION);
    }
    return await resolveWorkspaceApiVersion({
        workspaceRoot,
        fallback,
        readFile: path => app._appFs!.readFile(path, 'utf8'),
    });
}

export async function resolveWorkspaceApiVersionFromVscode(
    vscode: {
        workspace?: {
            workspaceFolders?: { uri: unknown }[];
            fs?: { readFile: (uri: unknown) => Promise<Uint8Array> };
        };
        Uri?: { joinPath: (base: unknown, ...parts: string[]) => unknown };
    },
    { fallback = DEFAULT_SOURCE_API_VERSION }: { fallback?: string } = {}
) {
    const normalizedFallback = normalizeSfApiVersion(fallback, DEFAULT_SOURCE_API_VERSION);
    const folder = Array.isArray(vscode?.workspace?.workspaceFolders)
        ? vscode.workspace!.workspaceFolders![0]
        : null;
    const workspaceUri = folder?.uri;
    if (!workspaceUri || typeof vscode?.workspace?.fs?.readFile !== 'function') {
        return normalizedFallback;
    }
    try {
        const projectUri = vscode.Uri!.joinPath(workspaceUri, SFDX_PROJECT_FILE);
        const bytes = await vscode.workspace.fs.readFile(projectUri);
        const text = new TextDecoder().decode(bytes || new Uint8Array());
        return parseSourceApiVersionFromSfdxProject(text, normalizedFallback);
    } catch {
        try {
            const packageXmlUri = vscode.Uri!.joinPath(
                workspaceUri,
                ...PACKAGE_XML_FILE.split('/')
            );
            const bytes = await vscode.workspace.fs.readFile(packageXmlUri);
            const text = new TextDecoder().decode(bytes || new Uint8Array());
            return parseSourceApiVersionFromPackageXml(text, normalizedFallback);
        } catch {
            return normalizedFallback;
        }
    }
}

export async function writeWorkspaceApiVersionFromVscode(
    vscode: {
        workspace?: {
            workspaceFolders?: { uri: unknown }[];
            fs?: {
                readFile: (uri: unknown) => Promise<Uint8Array>;
                writeFile: (uri: unknown, content: Uint8Array) => Promise<void>;
                createDirectory?: (uri: unknown) => Promise<void>;
            };
        };
        Uri?: { joinPath: (base: unknown, ...parts: string[]) => unknown };
    },
    apiVersion: unknown,
    { fallback = DEFAULT_SOURCE_API_VERSION }: { fallback?: string } = {}
) {
    const normalizedApiVersion = normalizeSfApiVersion(apiVersion, fallback);
    const folder = Array.isArray(vscode?.workspace?.workspaceFolders)
        ? vscode.workspace!.workspaceFolders![0]
        : null;
    const workspaceUri = folder?.uri;
    if (!workspaceUri || typeof vscode?.workspace?.fs?.writeFile !== 'function') {
        throw new Error('Workspace file system is not available.');
    }

    const projectUri = vscode.Uri!.joinPath(workspaceUri, SFDX_PROJECT_FILE);
    const packageXmlUri = vscode.Uri!.joinPath(workspaceUri, ...PACKAGE_XML_FILE.split('/'));
    const packageXmlDirUri = vscode.Uri!.joinPath(workspaceUri, 'manifest');
    let nextText = '';
    let nextPackageXmlText = '';
    try {
        const bytes = await vscode.workspace.fs.readFile(projectUri);
        const text = new TextDecoder().decode(bytes || new Uint8Array());
        nextText = updateSourceApiVersionInSfdxProject(text, normalizedApiVersion, fallback);
    } catch {
        nextText = toSfdxProjectJson(normalizedApiVersion);
    }
    try {
        const bytes = await vscode.workspace.fs.readFile(packageXmlUri);
        const text = new TextDecoder().decode(bytes || new Uint8Array());
        nextPackageXmlText = updateSourceApiVersionInPackageXml(
            text,
            normalizedApiVersion,
            fallback
        );
    } catch {
        nextPackageXmlText = toPackageXml(normalizedApiVersion);
    }

    await vscode.workspace.fs.writeFile(projectUri, new TextEncoder().encode(nextText));
    if (typeof vscode.workspace.fs.createDirectory === 'function') {
        await vscode.workspace.fs.createDirectory(packageXmlDirUri);
    }
    await vscode.workspace.fs.writeFile(
        packageXmlUri,
        new TextEncoder().encode(nextPackageXmlText)
    );
    return {
        apiVersion: normalizedApiVersion,
        uri: projectUri,
        packageXmlUri,
        text: nextText,
        packageXmlText: nextPackageXmlText,
    };
}
