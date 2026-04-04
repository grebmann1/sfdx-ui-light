import { getWorkspaceRootPath, parentUri } from './workspacePaths.js';

const SF_CACHE = {
    dbName: 'sf_workbench_cache_v1',
    storeName: 'files',
};

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

export function shouldCachePath(path) {
    const value = String(path || '');
    if (looksLikeBadLwcPath(value)) return false;
    return value.includes('/force-app/main/') || value.includes('/.salesforce/');
}

export function openCacheDb() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB not available'));
            return;
        }
        const request = indexedDB.open(SF_CACHE.dbName, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(SF_CACHE.storeName)) {
                db.createObjectStore(SF_CACHE.storeName, { keyPath: 'path' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Failed to open cache db'));
    });
}

export async function cachePutFile(path, text) {
    if (!shouldCachePath(path)) return;
    let db;
    try {
        db = await openCacheDb();
    } catch {
        return;
    }
    await new Promise((resolve, reject) => {
        const tx = db.transaction(SF_CACHE.storeName, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore(SF_CACHE.storeName).put({
            path,
            text: String(text ?? ''),
            updatedAt: Date.now(),
        });
    }).finally(() => {
        try {
            db.close();
        } catch {
            // ignore
        }
    });
}

export async function cacheDeleteFile(path) {
    if (!shouldCachePath(path)) return;
    let db;
    try {
        db = await openCacheDb();
    } catch {
        return;
    }
    await new Promise((resolve, reject) => {
        const tx = db.transaction(SF_CACHE.storeName, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore(SF_CACHE.storeName).delete(String(path || ''));
    }).finally(() => {
        try {
            db.close();
        } catch {
            // ignore
        }
    });
}

export async function cacheListFiles(prefix) {
    let db;
    try {
        db = await openCacheDb();
    } catch {
        return [];
    }
    return await new Promise((resolve, reject) => {
        const output = [];
        const tx = db.transaction(SF_CACHE.storeName, 'readonly');
        tx.oncomplete = () => resolve(output);
        tx.onerror = () => reject(tx.error);
        const request = tx.objectStore(SF_CACHE.storeName).openCursor();
        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) return;
            const value = cursor.value;
            if (!prefix || String(value?.path || '').startsWith(prefix)) {
                output.push(value);
            }
            cursor.continue();
        };
        request.onerror = () => reject(request.error);
    }).finally(() => {
        try {
            db.close();
        } catch {
            // ignore
        }
    });
}

export async function restoreCachedFilesToWorkspace(vscode) {
    const prefix = `${getWorkspaceRootPath(vscode).replace(/\/+$/, '')}/`;
    const files = await cacheListFiles(prefix);
    if (!files.length) return;

    const chunkSize = 25;
    for (let index = 0; index < files.length; index += chunkSize) {
        const chunk = files.slice(index, index + chunkSize);
        // eslint-disable-next-line no-await-in-loop
        await Promise.all(
            chunk.map(async fileEntry => {
                try {
                    if (looksLikeBadLwcPath(fileEntry.path)) return;
                    const uri = vscode.Uri.file(fileEntry.path);
                    await ensureDir(vscode, parentUri(uri));
                    const bytes = new TextEncoder().encode(fileEntry.text || '');
                    await vscode.workspace.fs.writeFile(uri, bytes);
                } catch {
                    // ignore
                }
            })
        );
    }
}

export async function writeTextFile(vscode, uri, text, { skipCache } = {}) {
    await ensureDir(vscode, parentUri(uri));
    const bytes = new TextEncoder().encode(text || '');
    await vscode.workspace.fs.writeFile(uri, bytes);
    if (skipCache) return;
    try {
        await cachePutFile(uri.path, text || '');
    } catch {
        // ignore
    }
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
