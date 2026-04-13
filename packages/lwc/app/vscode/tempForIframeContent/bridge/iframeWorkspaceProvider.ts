import { IframeFsBridgeClient } from './iframeFsBridgeClient';

const FILE_SYSTEM_PROVIDER_CAPABILITIES = {
    FileReadWrite: 2,
    PathCaseSensitive: 1024,
};

const FILE_CHANGE_TYPE = {
    UPDATED: 0,
    ADDED: 1,
    DELETED: 2,
};

function createDisposable(dispose = () => {}) {
    return {
        dispose() {
            try {
                dispose?.();
            } catch {
                // ignore
            }
        },
    };
}

function createEmitter() {
    const listeners = new Set<(value: unknown) => void>();
    return {
        event(listener: unknown) {
            if (typeof listener !== 'function') {
                return createDisposable();
            }
            const typedListener = listener as (value: unknown) => void;
            listeners.add(typedListener);
            return createDisposable(() => {
                listeners.delete(typedListener);
            });
        },
        fire(value: unknown) {
            for (const listener of Array.from(listeners)) {
                try {
                    listener(value);
                } catch {
                    // ignore listener errors
                }
            }
        },
        clear() {
            listeners.clear();
        },
    };
}

function normalizeAbsolutePath(path: unknown) {
    const raw = String(path || '')
        .trim()
        .replace(/\\/g, '/');
    if (!raw || raw === '/') {
        return '/';
    }
    const parts = raw.split('/').filter(Boolean);
    return `/${parts.join('/')}`;
}

function isWithinWorkspaceRoot(path: string, workspaceRoot: string) {
    const normalizedPath = normalizeAbsolutePath(path);
    const normalizedRoot = normalizeAbsolutePath(workspaceRoot);
    return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

function toWorkspacePath(resource: any) {
    const path = resource?.path || resource?.fsPath || resource?.toString?.() || '';
    return normalizeAbsolutePath(path);
}

function toProviderStat(vscode: any, stat: any) {
    const type = stat?.isDirectory
        ? vscode.FileType.Directory
        : stat?.isSymbolicLink
          ? vscode.FileType.SymbolicLink
          : vscode.FileType.File;
    const mtime = Number(stat?.mtimeMs || Date.now());
    return {
        type,
        ctime: mtime,
        mtime,
        size: Number(stat?.size || 0),
    };
}

function toFileSystemError(vscode: any, error: any, fallbackMessage: string) {
    const code = error?.code;
    const message = error?.message || fallbackMessage || 'Workspace filesystem bridge error.';
    switch (code) {
        case 'ENOENT':
            return vscode.FileSystemError.FileNotFound(message);
        case 'EEXIST':
            return vscode.FileSystemError.FileExists(message);
        case 'EISDIR':
            return vscode.FileSystemError.FileIsADirectory(message);
        case 'ENOTDIR':
            return vscode.FileSystemError.FileNotADirectory(message);
        case 'EPERM':
        case 'ENOTEMPTY':
        case 'EACCESS':
            return vscode.FileSystemError.NoPermissions(message);
        default:
            return vscode.FileSystemError.Unavailable(message);
    }
}

function toFileChangeType(changeType: string) {
    switch (changeType) {
        case 'added':
            return FILE_CHANGE_TYPE.ADDED;
        case 'deleted':
            return FILE_CHANGE_TYPE.DELETED;
        default:
            return FILE_CHANGE_TYPE.UPDATED;
    }
}

export function createIframeWorkspaceProvider({
    client,
    vscode,
    workspaceRoot = '/workspace',
}: {
    client: IframeFsBridgeClient;
    vscode: any;
    workspaceRoot?: string;
}) {
    if (!client) {
        throw new Error('An IframeFsBridgeClient instance is required.');
    }
    if (!vscode) {
        throw new Error('A vscode API object is required.');
    }

    const changeEmitter = createEmitter();
    const normalizedRoot = normalizeAbsolutePath(workspaceRoot);
    const eventDisposable = client.onFsEvent(changes => {
        const payload = (changes || [])
            .filter(change => typeof change?.path === 'string')
            .map(change => ({
                resource: vscode.Uri.file(normalizeAbsolutePath(change.path)),
                type: toFileChangeType(String(change.type || 'updated')),
            }));
        if (payload.length > 0) {
            changeEmitter.fire(payload);
        }
    });

    function assertWorkspacePath(resource: unknown) {
        const targetPath = toWorkspacePath(resource);
        if (!isWithinWorkspaceRoot(targetPath, normalizedRoot)) {
            throw vscode.FileSystemError.NoPermissions(
                `${targetPath} is outside the workspace root ${normalizedRoot}.`
            );
        }
        return targetPath;
    }

    return {
        capabilities:
            FILE_SYSTEM_PROVIDER_CAPABILITIES.FileReadWrite |
            FILE_SYSTEM_PROVIDER_CAPABILITIES.PathCaseSensitive,
        onDidChangeCapabilities: () => createDisposable(),
        onDidChangeFile: listener => changeEmitter.event(listener),
        watch() {
            return createDisposable();
        },
        async stat(resource: unknown) {
            const targetPath = assertWorkspacePath(resource);
            try {
                const stat = await client.stat(targetPath);
                return toProviderStat(vscode, stat);
            } catch (error) {
                throw toFileSystemError(vscode, error, `Unable to stat ${targetPath}.`);
            }
        },
        async readdir(resource: unknown) {
            const targetPath = assertWorkspacePath(resource);
            try {
                const entries = await client.readdir(targetPath);
                return entries.map(entry => [
                    entry.name,
                    entry.isDirectory
                        ? vscode.FileType.Directory
                        : entry.isSymbolicLink
                          ? vscode.FileType.SymbolicLink
                          : vscode.FileType.File,
                ]);
            } catch (error) {
                throw toFileSystemError(vscode, error, `Unable to read directory ${targetPath}.`);
            }
        },
        async readFile(resource: unknown) {
            const targetPath = assertWorkspacePath(resource);
            try {
                const buffer = await client.readFileBuffer(targetPath);
                return new Uint8Array(buffer);
            } catch (error) {
                throw toFileSystemError(vscode, error, `Unable to read ${targetPath}.`);
            }
        },
        async writeFile(resource: unknown, content: Uint8Array, options: any = {}) {
            const targetPath = assertWorkspacePath(resource);
            try {
                const exists = await client.exists(targetPath);
                if (exists && !options?.overwrite) {
                    throw vscode.FileSystemError.FileExists(`${targetPath} already exists.`);
                }
                if (!exists && options?.create === false) {
                    throw vscode.FileSystemError.FileNotFound(`${targetPath} does not exist.`);
                }
                await client.writeFile(targetPath, content);
            } catch (error) {
                throw toFileSystemError(vscode, error, `Unable to write ${targetPath}.`);
            }
        },
        async mkdir(resource: unknown) {
            const targetPath = assertWorkspacePath(resource);
            try {
                await client.mkdir(targetPath, { recursive: true });
            } catch (error) {
                throw toFileSystemError(vscode, error, `Unable to create directory ${targetPath}.`);
            }
        },
        async delete(resource: unknown, options: any = {}) {
            const targetPath = assertWorkspacePath(resource);
            try {
                await client.rm(targetPath, {
                    recursive: Boolean(options?.recursive),
                    force: Boolean(options?.useTrash),
                });
            } catch (error) {
                throw toFileSystemError(vscode, error, `Unable to delete ${targetPath}.`);
            }
        },
        async rename(from: unknown, to: unknown, options: any = {}) {
            const sourcePath = assertWorkspacePath(from);
            const targetPath = assertWorkspacePath(to);
            try {
                const targetExists = await client.exists(targetPath);
                if (targetExists && !options?.overwrite) {
                    throw vscode.FileSystemError.FileExists(`${targetPath} already exists.`);
                }
                if (targetExists && options?.overwrite) {
                    await client.rm(targetPath, { recursive: true, force: true });
                }
                await client.mv(sourcePath, targetPath);
            } catch (error) {
                throw toFileSystemError(
                    vscode,
                    error,
                    `Unable to rename ${sourcePath} to ${targetPath}.`
                );
            }
        },
        dispose() {
            eventDisposable?.dispose?.();
            changeEmitter.clear();
        },
    };
}
