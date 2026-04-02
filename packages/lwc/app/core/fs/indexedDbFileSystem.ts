const DEFAULT_DB_NAME = 'sf-toolkit-bash-fs-v1';
const DEFAULT_STORE_NAME = 'entries';
const DEFAULT_DIRECTORY_MODE = 0o755;
const DEFAULT_FILE_MODE = 0o644;
const DEFAULT_SYMLINK_MODE = 0o777;
const ROOT_PATH = '/';

type FileEncoding = 'utf8' | 'utf-8' | 'ascii' | 'latin1' | 'binary' | 'base64' | 'hex';
type LazyFileProvider = () => Promise<string>;

type StoredBaseEntry = {
    path: string;
    mode?: number;
    mtimeMs?: number;
};
type StoredFileEntry = StoredBaseEntry & {
    type: 'file';
    contentBase64?: string;
    size?: number;
};
type StoredDirectoryEntry = StoredBaseEntry & {
    type: 'directory';
};
type StoredSymlinkEntry = StoredBaseEntry & {
    type: 'symlink';
    target: string;
};
type StoredEntry = StoredFileEntry | StoredDirectoryEntry | StoredSymlinkEntry;

type InitialFileValue =
    | string
    | Uint8Array
    | { content?: string | Uint8Array; mode?: number; mtime?: Date }
    | LazyFileProvider;

type NormalizedInitialFileValue =
    | { lazy: LazyFileProvider }
    | { content: string | Uint8Array; mode?: number; mtime?: Date };

type RegisterInitialFilesOptions = {
    skipReady?: boolean;
};

type WriteOptions = {
    encoding?: FileEncoding;
};

type WriteInternalOptions = {
    mode?: number;
    mtimeMs?: number;
    overwrite?: boolean;
    skipParentCheck?: boolean;
    skipLazyMaterialization?: boolean;
    options?: WriteOptions | FileEncoding;
};

type IndexedDbFsOptions = {
    dbName?: string;
    storeName?: string;
    initialFiles?: Record<string, InitialFileValue>;
    ensureDirectories?: string[];
};

const textEncoder = new TextEncoder();
const utf8Decoder = new TextDecoder('utf-8');
const latin1Decoder = new TextDecoder('iso-8859-1');
const asciiDecoder = new TextDecoder('ascii');

function createFsError(code, message, path) {
    const suffix = path ? `: '${path}'` : '';
    const error = new Error(`${code}: ${message}${suffix}`);
    error.code = code;
    return error;
}

function toPathString(path) {
    if (typeof path !== 'string') {
        throw createFsError('EINVAL', 'Path must be a string');
    }
    return path.trim() || ROOT_PATH;
}

function splitPath(path) {
    return path.split('/').filter(Boolean);
}

function normalizeAbsolutePath(path) {
    const source = toPathString(path);
    const isAbsolute = source.startsWith('/');
    const stack = [];
    const parts = splitPath(source);
    for (const part of parts) {
        if (part === '.' || part === '') continue;
        if (part === '..') {
            if (stack.length > 0) stack.pop();
            continue;
        }
        stack.push(part);
    }
    const normalized = `/${stack.join('/')}`;
    if (isAbsolute) return normalized || ROOT_PATH;
    return normalized || ROOT_PATH;
}

function dirname(path) {
    const normalized = normalizeAbsolutePath(path);
    if (normalized === ROOT_PATH) return ROOT_PATH;
    const idx = normalized.lastIndexOf('/');
    return idx <= 0 ? ROOT_PATH : normalized.slice(0, idx);
}

function basename(path) {
    const normalized = normalizeAbsolutePath(path);
    if (normalized === ROOT_PATH) return ROOT_PATH;
    const idx = normalized.lastIndexOf('/');
    return normalized.slice(idx + 1);
}

function joinPath(parent, child) {
    if (!child) return normalizeAbsolutePath(parent);
    if (child.startsWith('/')) return normalizeAbsolutePath(child);
    const normalizedParent = normalizeAbsolutePath(parent);
    return normalizeAbsolutePath(
        normalizedParent === ROOT_PATH ? `/${child}` : `${normalizedParent}/${child}`
    );
}

function concatBytes(a, b) {
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
}

function uint8ArrayToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        const slice = bytes.subarray(i, i + chunk);
        binary += String.fromCharCode(...slice);
    }
    return btoa(binary);
}

function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function bytesToHex(bytes) {
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
    const value = (hex || '').trim();
    if (value.length % 2 !== 0) {
        throw createFsError('EINVAL', 'Invalid hex content');
    }
    const out = new Uint8Array(value.length / 2);
    for (let i = 0; i < value.length; i += 2) {
        const parsed = Number.parseInt(value.slice(i, i + 2), 16);
        if (Number.isNaN(parsed)) {
            throw createFsError('EINVAL', 'Invalid hex content');
        }
        out[i / 2] = parsed;
    }
    return out;
}

function binaryStringToBytes(value) {
    const text = String(value ?? '');
    const out = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i += 1) {
        out[i] = text.charCodeAt(i) & 0xff;
    }
    return out;
}

function bytesToBinaryString(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i += 1) {
        out += String.fromCharCode(bytes[i]);
    }
    return out;
}

function parseReadEncoding(options) {
    if (!options) return 'utf8';
    if (typeof options === 'string') return options.toLowerCase();
    if (typeof options === 'object') {
        return (options.encoding || 'utf8').toLowerCase();
    }
    return 'utf8';
}

function parseWriteEncoding(options) {
    if (!options) return 'utf8';
    if (typeof options === 'string') return options.toLowerCase();
    if (typeof options === 'object') {
        return (options.encoding || 'utf8').toLowerCase();
    }
    return 'utf8';
}

function bytesToEncodedString(bytes, encoding) {
    switch ((encoding || 'utf8').toLowerCase()) {
        case 'utf8':
        case 'utf-8':
            return utf8Decoder.decode(bytes);
        case 'ascii':
            return asciiDecoder.decode(bytes);
        case 'latin1':
            return latin1Decoder.decode(bytes);
        case 'binary':
            return bytesToBinaryString(bytes);
        case 'base64':
            return uint8ArrayToBase64(bytes);
        case 'hex':
            return bytesToHex(bytes);
        default:
            return utf8Decoder.decode(bytes);
    }
}

function toUint8Array(content, options) {
    if (content instanceof Uint8Array) return content;
    const text = String(content ?? '');
    const encoding = parseWriteEncoding(options);
    switch (encoding) {
        case 'utf8':
        case 'utf-8':
            return textEncoder.encode(text);
        case 'ascii':
        case 'latin1':
        case 'binary':
            return binaryStringToBytes(text);
        case 'base64':
            return base64ToUint8Array(text);
        case 'hex':
            return hexToBytes(text);
        default:
            return textEncoder.encode(text);
    }
}

function requestToPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
    });
}

function transactionDonePromise(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = () =>
            reject(transaction.error || new Error('IndexedDB transaction aborted'));
        transaction.onerror = () =>
            reject(transaction.error || new Error('IndexedDB transaction failed'));
    });
}

function toStoredFileEntry(path, bytes, mode = DEFAULT_FILE_MODE, mtimeMs = Date.now()): StoredFileEntry {
    return {
        path,
        type: 'file',
        contentBase64: uint8ArrayToBase64(bytes),
        size: bytes.length,
        mode,
        mtimeMs,
    };
}

function toStoredDirectoryEntry(path, mode = DEFAULT_DIRECTORY_MODE, mtimeMs = Date.now()): StoredDirectoryEntry {
    return {
        path,
        type: 'directory',
        mode,
        mtimeMs,
    };
}

function toStoredSymlinkEntry(path, target, mode = DEFAULT_SYMLINK_MODE, mtimeMs = Date.now()): StoredSymlinkEntry {
    return {
        path,
        type: 'symlink',
        target,
        mode,
        mtimeMs,
    };
}

function normalizeInitialFileValue(value: InitialFileValue): NormalizedInitialFileValue {
    if (typeof value === 'function') return { lazy: value };
    if (value instanceof Uint8Array || typeof value === 'string') return { content: value };
    if (value && typeof value === 'object' && 'content' in value) return value as any;
    return { content: '' };
}

export class IndexedDbFileSystem {
    dbName: string;
    storeName: string;
    pathCache: Set<string>;
    lazyFiles: Map<string, LazyFileProvider>;
    lazyInflight: Map<string, Promise<void>>;
    mutationQueue: Promise<unknown>;
    initialFiles: Record<string, NormalizedInitialFileValue>;
    ensureDirectories: string[];
    ready: Promise<void>;
    db: IDBDatabase;

    constructor(options: IndexedDbFsOptions = {}) {
        const {
            dbName = DEFAULT_DB_NAME,
            storeName = DEFAULT_STORE_NAME,
            initialFiles = {},
            ensureDirectories = [ROOT_PATH, '/workspace'],
        } = options;

        if (typeof indexedDB === 'undefined') {
            throw createFsError('ENOSYS', 'indexedDB is not available in this runtime');
        }

        this.dbName = dbName;
        this.storeName = storeName;
        this.pathCache = new Set();
        this.lazyFiles = new Map();
        this.lazyInflight = new Map();
        this.mutationQueue = Promise.resolve();

        this.initialFiles = {};
        for (const [rawPath, rawValue] of Object.entries(initialFiles || {})) {
            const path = normalizeAbsolutePath(rawPath);
            this.initialFiles[path] = normalizeInitialFileValue(rawValue);
        }

        this.ensureDirectories = Array.from(
            new Set((ensureDirectories || [ROOT_PATH, '/workspace']).map(normalizeAbsolutePath))
        );

        this.ready = this.initialize();
    }

    async initialize() {
        this.db = await this.openDatabase();
        await this.ensureBaseDirectories();
        await this.seedInitialFiles();
        await this.refreshPathCache();
    }

    openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'path' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () =>
                reject(request.error || new Error('Failed to open IndexedDB database'));
        });
    }

    async ensureBaseDirectories() {
        await this.runWrite(async store => {
            for (const dirPath of this.ensureDirectories) {
                const existing = await requestToPromise(store.get(dirPath));
                if (!existing) {
                    store.put(toStoredDirectoryEntry(dirPath));
                } else if (existing.type !== 'directory') {
                    throw createFsError('ENOTDIR', 'Expected directory path', dirPath);
                }
            }
        });
    }

    async seedInitialFiles() {
        await this.registerInitialFiles(this.initialFiles, { skipReady: true });
    }

    async registerInitialFiles(initialFiles = {}, options: RegisterInitialFilesOptions = {}) {
        if (!options.skipReady) {
            await this.ready;
        }

        const normalizedFiles = {};
        for (const [rawPath, rawValue] of Object.entries(initialFiles || {})) {
            const path = normalizeAbsolutePath(rawPath);
            normalizedFiles[path] = normalizeInitialFileValue(rawValue as InitialFileValue);
        }

        const entries = Object.entries(normalizedFiles);
        if (entries.length === 0) return;

        for (const [path, value] of entries) {
            if (value && typeof (value as any).lazy === 'function') {
                // If a real file already exists in IndexedDB, do not register a lazy provider.
                // This prevents any chance of overriding user-modified content.
                const existing = await this.getEntry(path);
                if (existing) {
                    continue;
                }
                this.lazyFiles.set(path, (value as any).lazy);
                this.pathCache.add(path);
                continue;
            }

            const existing = await this.getEntry(path);
            if (existing) continue;

            const mode =
                value && typeof (value as any).mode === 'number' ? (value as any).mode : DEFAULT_FILE_MODE;
            const mtimeMs =
                value && (value as any).mtime instanceof Date ? (value as any).mtime.getTime() : Date.now();
            await this.writeFileInternal(path, (value as any)?.content ?? '', {
                mode,
                mtimeMs,
                skipParentCheck: false,
                overwrite: false,
            });
        }
    }

    async refreshPathCache() {
        const entries = await this.getAllEntries();
        this.pathCache.clear();
        for (const entry of entries) {
            this.pathCache.add(entry.path);
        }
        for (const lazyPath of this.lazyFiles.keys()) {
            this.pathCache.add(lazyPath);
        }
        if (!this.pathCache.has(ROOT_PATH)) {
            this.pathCache.add(ROOT_PATH);
        }
    }

    resolvePath(base, path) {
        const normalizedBase = normalizeAbsolutePath(base || ROOT_PATH);
        const candidate = toPathString(path || ROOT_PATH);
        if (candidate.startsWith('/')) {
            return normalizeAbsolutePath(candidate);
        }
        return joinPath(normalizedBase, candidate);
    }

    getAllPaths() {
        return Array.from(this.pathCache).sort();
    }

    async readFile(path, options?: WriteOptions | FileEncoding) {
        await this.ready;
        const bytes = await this.readFileBuffer(path);
        const encoding = parseReadEncoding(options);
        return bytesToEncodedString(bytes, encoding);
    }

    async readFileBuffer(path) {
        await this.ready;
        const normalized = normalizeAbsolutePath(path);
        const entry = await this.resolveEntry(normalized, { followSymlinks: true });
        if (entry.type !== 'file') {
            throw createFsError('EISDIR', 'Cannot read directory', normalized);
        }
        if (!entry.contentBase64) return new Uint8Array();
        return base64ToUint8Array(entry.contentBase64);
    }

    async writeFile(path, content, options?: WriteOptions | FileEncoding) {
        await this.ready;
        const normalized = normalizeAbsolutePath(path);
        return this.runMutation(async () => {
            await this.writeFileInternal(normalized, content, {
                mode: undefined,
                mtimeMs: Date.now(),
                options,
                skipParentCheck: false,
                overwrite: true,
            });
        });
    }

    async appendFile(path, content, options?: WriteOptions | FileEncoding) {
        await this.ready;
        const normalized = normalizeAbsolutePath(path);
        return this.runMutation(async () => {
            const existing = await this.getEntry(normalized);
            const appendBytes = toUint8Array(content, options);
            if (!existing) {
                await this.writeFileInternal(normalized, appendBytes, {
                    mode: DEFAULT_FILE_MODE,
                    mtimeMs: Date.now(),
                    options: 'binary',
                    skipParentCheck: false,
                    overwrite: false,
                });
                return;
            }

            const target = await this.resolveEntry(normalized, { followSymlinks: true });
            if (target.type !== 'file') {
                throw createFsError('EISDIR', 'Cannot append to directory', normalized);
            }

            const current = target.contentBase64
                ? base64ToUint8Array(target.contentBase64)
                : new Uint8Array();
            const merged = concatBytes(current, appendBytes);
            const mergedEntry = toStoredFileEntry(
                target.path,
                merged,
                target.mode ?? DEFAULT_FILE_MODE,
                Date.now()
            );
            await this.putEntry(mergedEntry);
            this.pathCache.add(target.path);
        });
    }

    async exists(path) {
        const normalized = normalizeAbsolutePath(path);
        await this.ready;
        if (this.lazyFiles.has(normalized)) return true;
        const entry = await this.getEntry(normalized);
        return !!entry;
    }

    async stat(path) {
        await this.ready;
        const normalized = normalizeAbsolutePath(path);
        const entry = await this.resolveEntry(normalized, { followSymlinks: true });
        return this.toFsStat(entry);
    }

    async lstat(path) {
        await this.ready;
        const normalized = normalizeAbsolutePath(path);
        await this.materializeLazyFileIfNeeded(normalized);
        const entry = await this.getEntry(normalized);
        if (!entry) {
            throw createFsError('ENOENT', 'No such file or directory', normalized);
        }
        return this.toFsStat(entry);
    }

    async mkdir(path, options = {}) {
        await this.ready;
        const normalized = normalizeAbsolutePath(path);
        const recursive = !!options?.recursive;
        return this.runMutation(async () => {
            const existing = await this.getEntry(normalized);
            if (existing) {
                if (existing.type === 'directory' && recursive) return;
                throw createFsError('EEXIST', 'Path already exists', normalized);
            }

            if (!recursive) {
                await this.assertParentDirectory(normalized);
                await this.putEntry(toStoredDirectoryEntry(normalized));
                this.pathCache.add(normalized);
                return;
            }

            const parts = splitPath(normalized);
            let current = ROOT_PATH;
            for (const part of parts) {
                current = joinPath(current, part);
                const currEntry = await this.getEntry(current);
                if (!currEntry) {
                    await this.putEntry(toStoredDirectoryEntry(current));
                    this.pathCache.add(current);
                } else if (currEntry.type !== 'directory') {
                    throw createFsError('ENOTDIR', 'Parent path is not a directory', current);
                }
            }
        });
    }

    async readdir(path) {
        await this.ready;
        const normalized = normalizeAbsolutePath(path);
        const dirEntry = await this.resolveEntry(normalized, { followSymlinks: true });
        if (dirEntry.type !== 'directory') {
            throw createFsError('ENOTDIR', 'Not a directory', normalized);
        }

        await this.ready;
        const prefix = normalized === ROOT_PATH ? '/' : `${normalized}/`;
        const names = new Set();
        const allPaths = this.getAllPaths();
        for (const candidate of allPaths) {
            if (!candidate.startsWith(prefix) || candidate === normalized) continue;
            const tail = candidate.slice(prefix.length);
            if (!tail) continue;
            const [name] = tail.split('/');
            if (name) names.add(name);
        }
        return Array.from(names).sort();
    }

    async readdirWithFileTypes(path) {
        await this.ready;
        const normalized = normalizeAbsolutePath(path);
        const names = await this.readdir(normalized);
        const output = [];
        for (const name of names) {
            const childPath = joinPath(normalized, name);
            const lazyProvider = this.lazyFiles.get(childPath);
            if (lazyProvider) {
                output.push({
                    name,
                    isFile: true,
                    isDirectory: false,
                    isSymbolicLink: false,
                });
                continue;
            }
            const entry = await this.getEntry(childPath);
            if (!entry) continue;
            output.push({
                name,
                isFile: entry.type === 'file',
                isDirectory: entry.type === 'directory',
                isSymbolicLink: entry.type === 'symlink',
            });
        }
        return output;
    }

    async rm(path, options = {}) {
        await this.ready;
        const normalized = normalizeAbsolutePath(path);
        const recursive = !!options?.recursive;
        const force = !!options?.force;
        return this.runMutation(async () => {
            await this.removePathInternal(normalized, { recursive, force });
        });
    }

    async cp(src, dest, options = {}) {
        await this.ready;
        const normalizedSrc = normalizeAbsolutePath(src);
        const normalizedDest = normalizeAbsolutePath(dest);
        const recursive = !!options?.recursive;
        return this.runMutation(async () => {
            const source = await this.resolveEntry(normalizedSrc, { followSymlinks: false });
            const destination = await this.getEntry(normalizedDest);

            let finalDest = normalizedDest;
            if (destination && destination.type === 'directory') {
                finalDest = joinPath(normalizedDest, basename(normalizedSrc));
            }

            if (source.type === 'directory') {
                if (!recursive) {
                    throw createFsError('EISDIR', 'Cannot copy directory without recursive', src);
                }
                if (finalDest === normalizedSrc || finalDest.startsWith(`${normalizedSrc}/`)) {
                    throw createFsError('EINVAL', 'Cannot copy directory into itself', finalDest);
                }
                await this.copyDirectoryTree(normalizedSrc, finalDest);
                return;
            }

            await this.copySingleEntry(source, finalDest);
        });
    }

    async mv(src, dest) {
        await this.ready;
        const normalizedSrc = normalizeAbsolutePath(src);
        const normalizedDest = normalizeAbsolutePath(dest);
        return this.runMutation(async () => {
            const source = await this.resolveEntry(normalizedSrc, { followSymlinks: false });
            const destination = await this.getEntry(normalizedDest);

            let finalDest = normalizedDest;
            if (destination && destination.type === 'directory') {
                finalDest = joinPath(normalizedDest, basename(normalizedSrc));
            }

            if (finalDest === normalizedSrc) return;
            if (source.type === 'directory' && finalDest.startsWith(`${normalizedSrc}/`)) {
                throw createFsError('EINVAL', 'Cannot move directory into itself', finalDest);
            }

            if (source.type !== 'directory') {
                const existingTarget = await this.getEntry(finalDest);
                if (existingTarget && existingTarget.type === 'directory') {
                    throw createFsError('EISDIR', 'Destination is a directory', finalDest);
                }
            }

            if (source.type === 'directory') {
                await this.copyDirectoryTree(normalizedSrc, finalDest);
            } else {
                await this.copySingleEntry(source, finalDest);
            }

            await this.removePathInternal(normalizedSrc, { recursive: true, force: false });
        });
    }

    async chmod(path, mode) {
        await this.ready;
        const normalized = normalizeAbsolutePath(path);
        return this.runMutation(async () => {
            await this.materializeLazyFileIfNeeded(normalized);
            const entry = await this.getEntry(normalized);
            if (!entry) throw createFsError('ENOENT', 'No such file or directory', normalized);
            const updated = { ...entry, mode };
            await this.putEntry(updated);
            this.pathCache.add(normalized);
        });
    }

    async symlink(target, linkPath) {
        await this.ready;
        const normalizedLinkPath = normalizeAbsolutePath(linkPath);
        const targetPath = toPathString(target);
        return this.runMutation(async () => {
            await this.assertParentDirectory(normalizedLinkPath);
            const existing = await this.getEntry(normalizedLinkPath);
            if (existing || this.lazyFiles.has(normalizedLinkPath)) {
                throw createFsError('EEXIST', 'Path already exists', normalizedLinkPath);
            }
            await this.putEntry(toStoredSymlinkEntry(normalizedLinkPath, targetPath));
            this.pathCache.add(normalizedLinkPath);
        });
    }

    async link(existingPath, newPath) {
        await this.ready;
        const normalizedExistingPath = normalizeAbsolutePath(existingPath);
        const normalizedNewPath = normalizeAbsolutePath(newPath);
        return this.runMutation(async () => {
            const source = await this.resolveEntry(normalizedExistingPath, { followSymlinks: true });
            if (source.type !== 'file') {
                throw createFsError('EPERM', 'Hard links are only supported for files', existingPath);
            }
            await this.assertParentDirectory(normalizedNewPath);
            const existing = await this.getEntry(normalizedNewPath);
            if (existing || this.lazyFiles.has(normalizedNewPath)) {
                throw createFsError('EEXIST', 'Path already exists', normalizedNewPath);
            }

            const bytes = source.contentBase64
                ? base64ToUint8Array(source.contentBase64)
                : new Uint8Array();
            const copy = toStoredFileEntry(
                normalizedNewPath,
                bytes,
                source.mode ?? DEFAULT_FILE_MODE,
                source.mtimeMs ?? Date.now()
            );
            await this.putEntry(copy);
            this.pathCache.add(normalizedNewPath);
        });
    }

    async readlink(path) {
        await this.ready;
        const normalized = normalizeAbsolutePath(path);
        await this.materializeLazyFileIfNeeded(normalized);
        const entry = await this.getEntry(normalized);
        if (!entry) throw createFsError('ENOENT', 'No such file or directory', normalized);
        if (entry.type !== 'symlink') {
            throw createFsError('EINVAL', 'Path is not a symbolic link', normalized);
        }
        return entry.target;
    }

    async realpath(path) {
        await this.ready;
        const normalized = normalizeAbsolutePath(path);
        return this.resolveRealPath(normalized, new Set());
    }

    async utimes(path, _atime, mtime) {
        await this.ready;
        const normalized = normalizeAbsolutePath(path);
        return this.runMutation(async () => {
            await this.materializeLazyFileIfNeeded(normalized);
            const entry = await this.getEntry(normalized);
            if (!entry) throw createFsError('ENOENT', 'No such file or directory', normalized);
            const updated = {
                ...entry,
                mtimeMs: mtime instanceof Date ? mtime.getTime() : Date.now(),
            };
            await this.putEntry(updated);
            this.pathCache.add(normalized);
        });
    }

    toFsStat(entry: StoredEntry) {
        const isFile = entry.type === 'file';
        const isDirectory = entry.type === 'directory';
        const isSymbolicLink = entry.type === 'symlink';
        const size = isFile ? entry.size || 0 : 0;
        return {
            isFile,
            isDirectory,
            isSymbolicLink,
            mode: entry.mode ?? (isDirectory ? DEFAULT_DIRECTORY_MODE : DEFAULT_FILE_MODE),
            size,
            mtime: new Date(entry.mtimeMs || Date.now()),
        };
    }

    async resolveEntry(path, { followSymlinks }) {
        const normalized = normalizeAbsolutePath(path);
        await this.materializeLazyFileIfNeeded(normalized);
        const entry = await this.getEntry(normalized);
        if (!entry) {
            throw createFsError('ENOENT', 'No such file or directory', normalized);
        }
        if (!followSymlinks || entry.type !== 'symlink') return entry;

        const targetPath = this.resolvePath(dirname(normalized), entry.target);
        return this.resolveEntry(targetPath, { followSymlinks: true });
    }

    async resolveRealPath(path, visited) {
        const normalized = normalizeAbsolutePath(path);
        if (visited.has(normalized)) {
            throw createFsError('ELOOP', 'Too many symbolic links', normalized);
        }
        visited.add(normalized);

        if (normalized === ROOT_PATH) {
            const root = await this.getEntry(ROOT_PATH);
            if (!root) throw createFsError('ENOENT', 'No such file or directory', ROOT_PATH);
            return ROOT_PATH;
        }

        const segments = splitPath(normalized);
        let current = ROOT_PATH;
        for (let index = 0; index < segments.length; index += 1) {
            current = joinPath(current, segments[index]);
            await this.materializeLazyFileIfNeeded(current);
            const entry = await this.getEntry(current);
            if (!entry) {
                throw createFsError('ENOENT', 'No such file or directory', current);
            }
            const isLast = index === segments.length - 1;
            if (!isLast && entry.type !== 'directory' && entry.type !== 'symlink') {
                throw createFsError('ENOTDIR', 'Path component is not a directory', current);
            }
            if (entry.type === 'symlink') {
                const remainder = segments.slice(index + 1).join('/');
                const base = dirname(current);
                const resolvedTarget = this.resolvePath(base, entry.target);
                const combined = remainder ? `${resolvedTarget}/${remainder}` : resolvedTarget;
                return this.resolveRealPath(combined, visited);
            }
        }
        return current;
    }

    async materializeLazyFileIfNeeded(path) {
        const normalized = normalizeAbsolutePath(path);
        const provider = this.lazyFiles.get(normalized);
        if (!provider) return;

        const existing = await this.getEntry(normalized);
        if (existing) {
            this.lazyFiles.delete(normalized);
            return;
        }

        if (!this.lazyInflight.has(normalized)) {
            const inflight = (async () => {
                const provided = await provider();
                this.lazyFiles.delete(normalized);
                try {
                    await this.writeFileInternal(normalized, provided, {
                        mode: DEFAULT_FILE_MODE,
                        mtimeMs: Date.now(),
                        skipParentCheck: false,
                        overwrite: false,
                        skipLazyMaterialization: true,
                    });
                } catch (error) {
                    this.lazyFiles.set(normalized, provider);
                    throw error;
                }
            })().finally(() => {
                this.lazyInflight.delete(normalized);
            });
            this.lazyInflight.set(normalized, inflight);
        }
        await this.lazyInflight.get(normalized);
    }

    async assertParentDirectory(path) {
        const parentPath = dirname(path);
        const parent = await this.resolveEntry(parentPath, { followSymlinks: true });
        if (parent.type !== 'directory') {
            throw createFsError('ENOTDIR', 'Parent path is not a directory', parentPath);
        }
    }

    async copyDirectoryTree(sourceRoot, destRoot) {
        const source = await this.resolveEntry(sourceRoot, { followSymlinks: false });
        if (source.type !== 'directory') {
            throw createFsError('ENOTDIR', 'Source is not a directory', sourceRoot);
        }

        const destinationParent = dirname(destRoot);
        await this.assertParentDirectory(destRoot === ROOT_PATH ? ROOT_PATH : destinationParent);

        const existingDest = await this.getEntry(destRoot);
        if (existingDest && existingDest.type !== 'directory') {
            throw createFsError('ENOTDIR', 'Destination is not a directory', destRoot);
        }

        if (!existingDest) {
            await this.putEntry(toStoredDirectoryEntry(destRoot, source.mode, Date.now()));
            this.pathCache.add(destRoot);
        }

        const descendants = await this.getDescendantPaths(sourceRoot);
        const pathsToCopy = [sourceRoot, ...descendants].sort((a, b) => a.length - b.length);
        for (const srcPath of pathsToCopy) {
            if (srcPath === sourceRoot) continue;
            const rel = srcPath.slice(sourceRoot.length).replace(/^\/+/, '');
            const destPath = rel ? joinPath(destRoot, rel) : destRoot;
            const srcEntry = await this.getEntry(srcPath);
            if (!srcEntry) continue;
            if (srcEntry.type === 'directory') {
                const existing = await this.getEntry(destPath);
                if (!existing) {
                    await this.putEntry(
                        toStoredDirectoryEntry(destPath, srcEntry.mode, srcEntry.mtimeMs)
                    );
                    this.pathCache.add(destPath);
                }
                continue;
            }
            await this.copySingleEntry(srcEntry, destPath);
        }
    }

    async copySingleEntry(sourceEntry: StoredEntry, destinationPath: string) {
        await this.assertParentDirectory(destinationPath);
        const existingDestination = await this.getEntry(destinationPath);
        if (existingDestination && existingDestination.type === 'directory') {
            throw createFsError('EISDIR', 'Destination is a directory', destinationPath);
        }

        if (sourceEntry.type === 'file') {
            const bytes = sourceEntry.contentBase64
                ? base64ToUint8Array(sourceEntry.contentBase64)
                : new Uint8Array();
            const copy = toStoredFileEntry(
                destinationPath,
                bytes,
                sourceEntry.mode ?? DEFAULT_FILE_MODE,
                Date.now()
            );
            await this.putEntry(copy);
            this.pathCache.add(destinationPath);
            this.lazyFiles.delete(destinationPath);
            return;
        }

        if (sourceEntry.type === 'symlink') {
            const copy = toStoredSymlinkEntry(
                destinationPath,
                sourceEntry.target,
                sourceEntry.mode ?? DEFAULT_SYMLINK_MODE,
                Date.now()
            );
            await this.putEntry(copy);
            this.pathCache.add(destinationPath);
            this.lazyFiles.delete(destinationPath);
            return;
        }

        throw createFsError('EPERM', 'Unsupported entry type for copy', sourceEntry.path);
    }

    async writeFileInternal(path, content, options: WriteInternalOptions = {}) {
        const {
            mode,
            mtimeMs,
            overwrite = true,
            skipParentCheck = false,
            skipLazyMaterialization = false,
            options: writeEncodingOptions,
        } = options;

        const normalized = normalizeAbsolutePath(path);
        if (!skipLazyMaterialization) {
            await this.materializeLazyFileIfNeeded(normalized);
        }

        if (!skipParentCheck) {
            await this.assertParentDirectory(normalized);
        }

        const existing = await this.getEntry(normalized);
        if (existing?.type === 'directory') {
            throw createFsError('EISDIR', 'Cannot write to directory path', normalized);
        }
        if (existing && !overwrite) {
            return;
        }

        const bytes = toUint8Array(content, writeEncodingOptions);
        const resolvedMode =
            typeof mode === 'number'
                ? mode
                : existing?.mode && typeof existing.mode === 'number'
                  ? existing.mode
                  : DEFAULT_FILE_MODE;
        const entry = toStoredFileEntry(normalized, bytes, resolvedMode, mtimeMs || Date.now());
        await this.putEntry(entry);
        this.pathCache.add(normalized);
        this.lazyFiles.delete(normalized);
    }

    async getDescendantPaths(path) {
        const normalized = normalizeAbsolutePath(path);
        const prefix = `${normalized}/`;
        const allPaths = await this.getAllEntryPaths();
        return allPaths.filter(candidate => candidate.startsWith(prefix));
    }

    async getAllEntries(): Promise<StoredEntry[]> {
        return this.runRead(async store => {
            const request = store.getAll();
            const records = await requestToPromise(request);
            return Array.isArray(records) ? records : [];
        });
    }

    async getAllEntryPaths() {
        return this.runRead(async store => {
            const request = store.getAllKeys();
            const keys = await requestToPromise(request);
            return Array.isArray(keys) ? keys.map(String) : [];
        });
    }

    async getEntry(path): Promise<StoredEntry | undefined> {
        return this.runRead(async store => {
            const request = store.get(path);
            return requestToPromise(request);
        });
    }

    async putEntry(entry: StoredEntry) {
        return this.runWrite(async store => {
            store.put(entry);
        });
    }

    async deleteEntry(path) {
        return this.runWrite(async store => {
            store.delete(path);
        });
    }

    async removePathInternal(normalizedPath, options = {}) {
        const recursive = !!options?.recursive;
        const force = !!options?.force;
        if (normalizedPath === ROOT_PATH) {
            throw createFsError('EPERM', 'Cannot remove root directory', normalizedPath);
        }

        await this.materializeLazyFileIfNeeded(normalizedPath);
        const entry = await this.getEntry(normalizedPath);
        if (!entry) {
            if (force) return;
            throw createFsError('ENOENT', 'No such file or directory', normalizedPath);
        }

        if (entry.type === 'directory') {
            const children = await this.getDescendantPaths(normalizedPath);
            if (children.length > 0 && !recursive) {
                throw createFsError('ENOTEMPTY', 'Directory not empty', normalizedPath);
            }
            for (const child of children.sort((a, b) => b.length - a.length)) {
                await this.deleteEntry(child);
                this.pathCache.delete(child);
                this.lazyFiles.delete(child);
            }
        }

        await this.deleteEntry(normalizedPath);
        this.pathCache.delete(normalizedPath);
        this.lazyFiles.delete(normalizedPath);

        const prefix = `${normalizedPath}/`;
        for (const lazyPath of Array.from(this.lazyFiles.keys())) {
            if (lazyPath.startsWith(prefix)) {
                this.lazyFiles.delete(lazyPath);
                this.pathCache.delete(lazyPath);
            }
        }
    }

    async runRead(fn) {
        const transaction = this.db.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);
        const result = await fn(store, transaction);
        await transactionDonePromise(transaction);
        return result;
    }

    async runWrite(fn) {
        const transaction = this.db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const result = await fn(store, transaction);
        await transactionDonePromise(transaction);
        return result;
    }

    async runMutation(fn) {
        const run = this.mutationQueue.then(fn, fn);
        this.mutationQueue = run.catch(() => {});
        return run;
    }

    async getDebugStats() {
        await this.ready;
        const entries = await this.getAllEntries();
        let fileCount = 0;
        let directoryCount = 0;
        let symlinkCount = 0;
        let totalBytes = 0;

        for (const entry of entries) {
            if (entry.type === 'file') {
                fileCount += 1;
                totalBytes += Number(entry.size || 0);
            } else if (entry.type === 'directory') {
                directoryCount += 1;
            } else if (entry.type === 'symlink') {
                symlinkCount += 1;
            }
        }

        return {
            dbName: this.dbName,
            storeName: this.storeName,
            entryCount: entries.length,
            fileCount,
            directoryCount,
            symlinkCount,
            totalBytes,
            lazyFileCount: this.lazyFiles.size,
            samplePaths: entries
                .map(entry => entry.path)
                .sort()
                .slice(0, 25),
        };
    }
}

export function createIndexedDbFileSystem(options: IndexedDbFsOptions = {}) {
    return new IndexedDbFileSystem(options);
}

export { DEFAULT_DB_NAME as INDEXED_DB_DEFAULT_NAME };
