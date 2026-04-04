function getDisposables(app, key) {
    return Array.isArray(app?.[key]) ? app[key] : [];
}

function getWorkspaceRoot(app) {
    return app?._workspaceRoot || '/workspace';
}

function buildWorkspacePath(app, relativePath) {
    const root = getWorkspaceRoot(app);
    const suffix = String(relativePath || '').replace(/^\/+/, '');
    return suffix ? `${root}/${suffix}` : root;
}

export function disposeRegistrations(app, key) {
    const disposables = getDisposables(app, key);
    app[key] = [];
    for (const disposable of disposables) {
        try {
            disposable?.dispose?.();
        } catch {
            // ignore
        }
    }
}

export function registerFileNode(app, node, key) {
    if (!app?._fsProvider) {
        throw new Error('File system provider is not initialized.');
    }
    const disposable = app._fsProvider.registerFile(node);
    const list = getDisposables(app, key);
    list.push(disposable);
    app[key] = list;
    return disposable;
}

export function mkdirp(app, path) {
    if (!app?._fsProvider || !app?._vscode) return;
    const parts = (path || '').split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
        current += `/${part}`;
        try {
            app._fsProvider.mkdirSync(app._vscode.Uri.file(current));
        } catch {
            // already exists or cannot be created; ignore
        }
    }
    if (app._appFs) {
        void app._appFs.mkdir(path, { recursive: true }).catch(() => {});
    }
}

export function ensureIndexedDbWritableFileClass(app, encodeUtf8) {
    if (app._IndexedDbWritableFile || !app._fsw) {
        return;
    }
    const { RegisteredFile } = app._fsw;
    app._IndexedDbWritableFile = class IndexedDbWritableFile extends RegisteredFile {
        _path;
        _fs;
        _inMemoryBytes;

        constructor(uri, path, fs, initialText = '') {
            super(uri, false);
            this._path = path;
            this._fs = fs;
            this._inMemoryBytes = encodeUtf8(initialText);
        }

        async _loadFromIndexedDb() {
            try {
                const bytes = await this._fs.readFileBuffer(this._path);
                this._inMemoryBytes = bytes ?? new Uint8Array();
            } catch {
                // Fall back to in-memory bytes when IndexedDB file does not exist yet.
            }
            return this._inMemoryBytes;
        }

        async getSize() {
            const bytes = await this._loadFromIndexedDb();
            return bytes?.byteLength ?? 0;
        }

        async read() {
            return await this._loadFromIndexedDb();
        }

        async write(content) {
            this._inMemoryBytes = content ?? new Uint8Array();
            const parentPath = this._path.slice(0, this._path.lastIndexOf('/')) || '/';
            await this._fs.mkdir(parentPath, { recursive: true }).catch(() => {});
            await this._fs.writeFile(this._path, this._inMemoryBytes, 'binary');
            this.mtime = Date.now();
            try {
                this._onDidChange?.fire?.();
            } catch {
                // ignore
            }
        }

        async delete() {
            await this._fs.rm(this._path, { recursive: false, force: true }).catch(() => {});
            try {
                this._onDidDelete?.fire?.();
            } catch {
                // ignore
            }
        }
    };
}

export async function resolveInitialIndexedDbText(app, path, fallbackText, { overwrite = false } = {}) {
    if (!app?._appFs) {
        return String(fallbackText ?? '');
    }

    try {
        const exists = await app._appFs.exists(path);
        if (exists && !overwrite) {
            return await app._appFs.readFile(path, 'utf8');
        }
    } catch {
        // ignore
    }

    try {
        const parentPath = path.slice(0, path.lastIndexOf('/')) || '/';
        await app._appFs.mkdir(parentPath, { recursive: true }).catch(() => {});
        await app._appFs.writeFile(path, String(fallbackText ?? ''), 'utf8');
    } catch {
        // ignore
    }
    return String(fallbackText ?? '');
}

export async function registerTextFile(app, path, text, options = {}, encodeUtf8) {
    if (!app?._fsw || !app?._vscode) {
        throw new Error('vscodeBundle services are not ready.');
    }
    ensureIndexedDbWritableFileClass(app, encodeUtf8);
    const initialText = await resolveInitialIndexedDbText(app, path, text, options);
    const uri = app._vscode.Uri.file(path);
    if (!app._IndexedDbWritableFile || !app._appFs) {
        const { RegisteredMemoryFile } = app._fsw;
        return registerFileNode(app, new RegisteredMemoryFile(uri, initialText), '_fsRegistrations');
    }
    return registerFileNode(
        app,
        new app._IndexedDbWritableFile(uri, path, app._appFs, initialText),
        '_fsRegistrations'
    );
}

export async function registerSfTextFile(app, path, text, options = {}, encodeUtf8) {
    if (!app?._fsw || !app?._vscode) {
        throw new Error('vscodeBundle services are not ready.');
    }
    ensureIndexedDbWritableFileClass(app, encodeUtf8);
    const initialText = await resolveInitialIndexedDbText(app, path, text, options);
    const uri = app._vscode.Uri.file(path);
    if (!app._IndexedDbWritableFile || !app._appFs) {
        const { RegisteredMemoryFile } = app._fsw;
        return registerFileNode(app, new RegisteredMemoryFile(uri, initialText), '_sfRegistrations');
    }
    return registerFileNode(
        app,
        new app._IndexedDbWritableFile(uri, path, app._appFs, initialText),
        '_sfRegistrations'
    );
}

export function registerLazyReadOnlyFile(app, path, read, encodeUtf8) {
    if (!app?._fsw || !app?._vscode) {
        throw new Error('vscodeBundle services are not ready.');
    }
    if (!app._LazyReadOnlyFile) {
        const { RegisteredFile } = app._fsw;
        app._LazyReadOnlyFile = class LazyReadOnlyFile extends RegisteredFile {
            _readFn;
            _cached;
            _inflight;

            constructor(uri, readFn) {
                super(uri, true);
                this._readFn = readFn;
                this._cached = null;
                this._inflight = null;
            }

            async _load() {
                if (this._cached) {
                    return this._cached;
                }
                if (this._inflight) {
                    return this._inflight;
                }
                this._inflight = (async () => {
                    const res = await this._readFn();
                    const bytes = typeof res === 'string' ? encodeUtf8(res) : res;
                    this._cached = bytes ?? new Uint8Array();
                    this.mtime = Date.now();
                    try {
                        this._onDidChange?.fire?.();
                    } catch {
                        // ignore
                    }
                    return this._cached;
                })().finally(() => {
                    this._inflight = null;
                });
                return this._inflight;
            }

            async getSize() {
                const bytes = await this._load();
                return bytes?.byteLength ?? 0;
            }

            async read() {
                return await this._load();
            }

            async write() {
                throw new Error('File is read-only.');
            }

            async delete() {
                throw new Error('File is read-only.');
            }
        };
    }

    const uri = app._vscode.Uri.file(path);
    return registerFileNode(app, new app._LazyReadOnlyFile(uri, read), '_fsRegistrations');
}

export function registerSfLazyReadOnlyFile(app, path, read, encodeUtf8) {
    if (!app?._fsw || !app?._vscode) {
        throw new Error('vscodeBundle services are not ready.');
    }
    if (!app._LazyReadOnlyFile) {
        registerLazyReadOnlyFile(
            app,
            buildWorkspacePath(app, '.salesforce/.lazy-init'),
            async () => '',
            encodeUtf8
        );
        const disposable = app._fsRegistrations.pop();
        try {
            disposable?.dispose?.();
        } catch {
            // ignore
        }
    }
    const uri = app._vscode.Uri.file(path);
    return registerFileNode(app, new app._LazyReadOnlyFile(uri, read), '_sfRegistrations');
}

export async function hydrateWorkspaceFromIndexedDb(app, encodeUtf8) {
    if (!app?._appFs) {
        return;
    }

    const workspaceRoot = getWorkspaceRoot(app);
    const allPaths = (app._appFs.getAllPaths?.() || [])
        .filter((path) => typeof path === 'string' && path.startsWith(workspaceRoot))
        .sort((a, b) => a.length - b.length);

    for (const path of allPaths) {
        if (!path || path === '/') continue;
        const stat = await app._appFs.stat(path).catch(() => null);
        if (!stat) continue;

        if (stat.isDirectory) {
            mkdirp(app, path);
            continue;
        }

        if (stat.isFile) {
            await registerTextFile(app, path, '', {}, encodeUtf8);
        }
    }
}

export async function seedWorkspaceFiles(
    app,
    {
        getVscodeBundle,
        getIndexedDbFileSystem,
        encodeUtf8,
        ensureDirectories = [],
        initialFiles = {},
        workspaceRoot,
    }
) {
    if (app._fsProvider) {
        return;
    }

    const vscodeBundle = await getVscodeBundle();
    app._vscodeBundle = vscodeBundle;
    app._vscode = vscodeBundle.vscode;
    app._fsw = vscodeBundle.services?.FileServiceWrapper ?? null;
    const root = workspaceRoot || getWorkspaceRoot(app);
    app._appFs = getIndexedDbFileSystem({
        ensureDirectories: ensureDirectories.length > 0
            ? ensureDirectories
            : [
                root,
                `${root}/.vscode`,
                `${root}/force-app/main/default`,
                `${root}/.salesforce`,
            ],
        initialFiles,
    });
    await app._appFs?.ready;
    const directoriesToEnsure = ensureDirectories.length > 0
        ? ensureDirectories
        : [
            root,
            `${root}/.vscode`,
            `${root}/force-app/main/default`,
            `${root}/.salesforce`,
        ];
    for (const dir of directoriesToEnsure) {
        await app._appFs?.mkdir(dir, { recursive: true }).catch(() => {});
    }
    if (initialFiles && Object.keys(initialFiles).length > 0) {
        await app._appFs?.registerInitialFiles(initialFiles).catch(() => {});
    }

    if (!app._fsw) {
        return;
    }

    const { RegisteredFileSystemProvider, registerFileSystemOverlay } = app._fsw;

    const provider = new RegisteredFileSystemProvider(false);
    app._fsProvider = provider;
    disposeRegistrations(app, '_fsRegistrations');
    await hydrateWorkspaceFromIndexedDb(app, encodeUtf8);

    app._fsOverlayDisposable?.dispose?.();
    app._fsOverlayDisposable = registerFileSystemOverlay(1, provider);
}
