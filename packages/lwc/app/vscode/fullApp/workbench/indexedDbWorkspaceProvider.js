const FILE_SYSTEM_PROVIDER_CAPABILITIES = {
    FileReadWrite: 2,
    PathCaseSensitive: 1024,
};

const FILE_CHANGE_TYPE = {
    UPDATED: 0,
    ADDED: 1,
    DELETED: 2,
};

function createDisposable(dispose) {
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
    const listeners = new Set();
    return {
        event(listener) {
            if (typeof listener !== 'function') {
                return createDisposable();
            }
            listeners.add(listener);
            return createDisposable(() => {
                listeners.delete(listener);
            });
        },
        fire(value) {
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

function normalizeAbsolutePath(path) {
    const raw = String(path || '')
        .trim()
        .replace(/\\/g, '/');
    if (!raw || raw === '/') {
        return '/';
    }
    const parts = raw.split('/').filter(Boolean);
    return `/${parts.join('/')}`;
}

function dirname(path) {
    const normalized = normalizeAbsolutePath(path);
    if (normalized === '/') {
        return '/';
    }
    const index = normalized.lastIndexOf('/');
    return index <= 0 ? '/' : normalized.slice(0, index);
}

function isWithinWorkspaceRoot(path, workspaceRoot) {
    const normalizedPath = normalizeAbsolutePath(path);
    const normalizedRoot = normalizeAbsolutePath(workspaceRoot);
    return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

function toWorkspacePath(resource) {
    const path = resource?.path || resource?.fsPath || resource?.toString?.() || '';
    return normalizeAbsolutePath(path);
}

function toProviderFileType(vscode, entry) {
    if (entry?.isDirectory) {
        return vscode.FileType.Directory;
    }
    if (entry?.isSymbolicLink) {
        return vscode.FileType.SymbolicLink;
    }
    return vscode.FileType.File;
}

function toProviderStat(vscode, fsStat) {
    const type = fsStat?.isDirectory
        ? vscode.FileType.Directory
        : fsStat?.isSymbolicLink
          ? vscode.FileType.SymbolicLink
          : vscode.FileType.File;
    const mtime = fsStat?.mtime instanceof Date ? fsStat.mtime.getTime() : Date.now();
    return {
        type,
        ctime: mtime,
        mtime,
        size: Number(fsStat?.size || 0),
    };
}

function toFileSystemError(vscode, error, fallbackMessage) {
    const code = error?.code;
    const message = error?.message || fallbackMessage || 'Workspace filesystem error.';
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
            return vscode.FileSystemError.NoPermissions(message);
        default:
            return vscode.FileSystemError.Unavailable(message);
    }
}

async function loadToolingMapState(fs, workspaceRoot, cacheState) {
    const toolingMapPath = `${normalizeAbsolutePath(workspaceRoot)}/.salesforce/tooling-map.json`;
    try {
        const stat = await fs.stat(toolingMapPath);
        const cacheKey = `${Number(stat?.size || 0)}:${stat?.mtime?.getTime?.() || 0}`;
        if (cacheState.key === cacheKey && cacheState.items) {
            return cacheState;
        }
        const text = await fs.readFile(toolingMapPath, 'utf8');
        const parsed = JSON.parse(text || '{}');
        const items = parsed?.items && typeof parsed.items === 'object' ? parsed.items : {};
        cacheState.key = cacheKey;
        cacheState.items = items;
        cacheState.syncing = parsed?.syncing === true;
        return cacheState;
    } catch {
        cacheState.key = null;
        cacheState.items = {};
        cacheState.syncing = false;
        return cacheState;
    }
}

async function findReadOnlyPath(
    fs,
    workspaceRoot,
    targetPath,
    cacheState,
    includeDescendants = false
) {
    const normalizedTarget = normalizeAbsolutePath(targetPath);
    const toolingMapState = await loadToolingMapState(fs, workspaceRoot, cacheState);
    if (toolingMapState.syncing) {
        return null;
    }
    const { items } = toolingMapState;
    if (items?.[normalizedTarget]?.readOnly) {
        return normalizedTarget;
    }
    const mainRootPrefix = `${normalizeAbsolutePath(workspaceRoot)}/force-app/main/`;
    const readOnlyRoots = Object.keys(items)
        .filter(path => items?.[path]?.readOnly)
        .map(path => {
            if (!path.startsWith(mainRootPrefix)) {
                return dirname(path);
            }
            const relativePath = path.slice(mainRootPrefix.length);
            const [namespaceSegment] = relativePath.split('/');
            return namespaceSegment ? `${mainRootPrefix}${namespaceSegment}` : dirname(path);
        });
    const matchingRoot = readOnlyRoots.find(root => {
        return (
            isWithinWorkspaceRoot(normalizedTarget, root) ||
            (includeDescendants && isWithinWorkspaceRoot(root, normalizedTarget))
        );
    });
    if (matchingRoot) {
        return matchingRoot;
    }
    if (!includeDescendants) {
        return null;
    }
    const prefix = normalizedTarget === '/' ? '/' : `${normalizedTarget}/`;
    return (
        Object.keys(items).find(path => path.startsWith(prefix) && items?.[path]?.readOnly) || null
    );
}

export function createIndexedDbWorkspaceProvider({ fs, vscode, workspaceRoot }) {
    const changeEmitter = createEmitter();
    const toolingMapCache = {
        key: null,
        items: {},
        syncing: false,
    };
    let fireHandle = null;
    const bufferedChanges = [];

    function fireSoon(...changes) {
        bufferedChanges.push(...changes);
        if (fireHandle) {
            clearTimeout(fireHandle);
        }
        fireHandle = setTimeout(() => {
            fireHandle = null;
            if (bufferedChanges.length > 0) {
                changeEmitter.fire(bufferedChanges.splice(0, bufferedChanges.length));
            }
        }, 5);
    }

    function assertWorkspacePath(resource) {
        const targetPath = toWorkspacePath(resource);
        if (!isWithinWorkspaceRoot(targetPath, workspaceRoot)) {
            throw vscode.FileSystemError.Unavailable(
                `${targetPath} is outside the active workspace root.`
            );
        }
        return targetPath;
    }

    async function assertWritablePath(path, { includeDescendants = false } = {}) {
        const readOnlyPath = await findReadOnlyPath(
            fs,
            workspaceRoot,
            path,
            toolingMapCache,
            includeDescendants
        );
        if (readOnlyPath) {
            throw vscode.FileSystemError.NoPermissions(
                `${readOnlyPath} is read-only in this workspace.`
            );
        }
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
        async stat(resource) {
            const targetPath = assertWorkspacePath(resource);
            try {
                const stat = await fs.stat(targetPath);
                return toProviderStat(vscode, stat);
            } catch (error) {
                throw toFileSystemError(vscode, error, `Unable to stat ${targetPath}.`);
            }
        },
        async readdir(resource) {
            const targetPath = assertWorkspacePath(resource);
            try {
                const entries = await fs.readdirWithFileTypes(targetPath);
                return entries.map(entry => [entry.name, toProviderFileType(vscode, entry)]);
            } catch (error) {
                throw toFileSystemError(vscode, error, `Unable to read directory ${targetPath}.`);
            }
        },
        async readFile(resource) {
            const targetPath = assertWorkspacePath(resource);
            try {
                const bytes = await fs.readFileBuffer(targetPath);
                return bytes;
            } catch (error) {
                throw toFileSystemError(vscode, error, `Unable to read ${targetPath}.`);
            }
        },
        async writeFile(resource, content, options = {}) {
            const targetPath = assertWorkspacePath(resource);
            const toolingMapPath = `${normalizeAbsolutePath(workspaceRoot)}/.salesforce/tooling-map.json`;
            if (targetPath !== toolingMapPath) {
                await assertWritablePath(targetPath);
            }
            const exists = await fs.exists(targetPath).catch(() => false);
            if (exists && !options?.overwrite) {
                throw vscode.FileSystemError.FileExists(`${targetPath} already exists.`);
            }
            if (!exists && options?.create === false) {
                throw vscode.FileSystemError.FileNotFound(`${targetPath} does not exist.`);
            }
            try {
                await fs.writeFile(targetPath, content, 'binary');
                if (targetPath === toolingMapPath) {
                    toolingMapCache.key = null;
                    toolingMapCache.items = {};
                    toolingMapCache.syncing = false;
                }
                fireSoon({
                    resource,
                    type: exists ? FILE_CHANGE_TYPE.UPDATED : FILE_CHANGE_TYPE.ADDED,
                });
            } catch (error) {
                throw toFileSystemError(vscode, error, `Unable to write ${targetPath}.`);
            }
        },
        async mkdir(resource) {
            const targetPath = assertWorkspacePath(resource);
            await assertWritablePath(targetPath, { includeDescendants: true });
            try {
                await fs.mkdir(targetPath, { recursive: true });
                fireSoon({
                    resource,
                    type: FILE_CHANGE_TYPE.ADDED,
                });
            } catch (error) {
                throw toFileSystemError(vscode, error, `Unable to create directory ${targetPath}.`);
            }
        },
        async delete(resource, options = {}) {
            const targetPath = assertWorkspacePath(resource);
            await assertWritablePath(targetPath, {
                includeDescendants: Boolean(options?.recursive),
            });
            try {
                await fs.rm(targetPath, {
                    recursive: Boolean(options?.recursive),
                    force: false,
                });
                fireSoon({
                    resource,
                    type: FILE_CHANGE_TYPE.DELETED,
                });
            } catch (error) {
                throw toFileSystemError(vscode, error, `Unable to delete ${targetPath}.`);
            }
        },
        async rename(from, to, options = {}) {
            const sourcePath = assertWorkspacePath(from);
            const targetPath = assertWorkspacePath(to);
            await assertWritablePath(sourcePath, { includeDescendants: true });
            await assertWritablePath(targetPath, { includeDescendants: true });
            const targetExists = await fs.exists(targetPath).catch(() => false);
            if (targetExists && !options?.overwrite) {
                throw vscode.FileSystemError.FileExists(`${targetPath} already exists.`);
            }
            try {
                if (targetExists) {
                    await fs.rm(targetPath, { recursive: true, force: true });
                }
                const parentPath = dirname(targetPath);
                await fs.mkdir(parentPath, { recursive: true }).catch(() => {});
                await fs.mv(sourcePath, targetPath);
                fireSoon(
                    {
                        resource: from,
                        type: FILE_CHANGE_TYPE.DELETED,
                    },
                    {
                        resource: to,
                        type: FILE_CHANGE_TYPE.ADDED,
                    }
                );
            } catch (error) {
                throw toFileSystemError(
                    vscode,
                    error,
                    `Unable to rename ${sourcePath} to ${targetPath}.`
                );
            }
        },
        dispose() {
            logOperation('dispose', { workspaceRoot });
            if (fireHandle) {
                clearTimeout(fireHandle);
                fireHandle = null;
            }
            bufferedChanges.length = 0;
            changeEmitter.clear();
        },
    };
}
