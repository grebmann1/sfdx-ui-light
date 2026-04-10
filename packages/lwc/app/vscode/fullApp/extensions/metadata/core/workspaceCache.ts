import { getWorkspaceRootPath, parentUri } from './workspacePaths';

export async function ensureDir(vscode, uri) {
    try {
        await vscode.workspace.fs.createDirectory(uri);
    } catch {
        // ignore
    }
}

export async function listFilesAndDirsRecursive(vscode, dirUri) {
    const files = [];
    const dirs = [];

    async function walk(uri) {
        let entries;
        try {
            entries = await vscode.workspace.fs.readDirectory(uri);
        } catch {
            return;
        }

        for (const [name, type] of entries) {
            const child = vscode.Uri.joinPath(uri, name);
            const numericType = Number(type);
            const isDirectory = vscode.FileType?.Directory
                ? (numericType & vscode.FileType.Directory) === vscode.FileType.Directory
                : numericType === 2;
            if (isDirectory) {
                dirs.push(child);
                // eslint-disable-next-line no-await-in-loop
                await walk(child);
            } else {
                files.push(child);
            }
        }
    }

    await walk(dirUri);
    return { files, dirs };
}

export function looksLikeBadLwcPath(path) {
    return /\/force-app\/main\/[^/]+\/lwc\/[^/]+\/lwc\//.test(String(path || ''));
}

export function shouldCachePath() {
    return false;
}

export function openCacheDb() {
    return Promise.reject(new Error('Workspace cache is disabled.'));
}

export async function cachePutFile() {
    return undefined;
}

export async function cacheDeleteFile() {
    return undefined;
}

export async function cacheListFiles() {
    return [];
}

export async function restoreCachedFilesToWorkspace(vscode) {
    const rootPath = getWorkspaceRootPath(vscode);
    return rootPath || null;
}

export async function writeTextFile(vscode, uri, text, { skipCache } = {}) {
    await ensureDir(vscode, parentUri(uri));
    const bytes = new TextEncoder().encode(text || '');
    await vscode.workspace.fs.writeFile(uri, bytes);
    void skipCache;
}

export async function writeBytesFile(vscode, uri, bytes) {
    await ensureDir(vscode, parentUri(uri));
    const nextBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    await vscode.workspace.fs.writeFile(uri, nextBytes);
}

export const __testables = {
    looksLikeBadLwcPath,
    shouldCachePath,
};
