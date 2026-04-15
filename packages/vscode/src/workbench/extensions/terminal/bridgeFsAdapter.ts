/* eslint-disable import/no-unresolved */
import type { IFileSystem } from 'just-bash';
import type { IframeFsBridgeClient } from 'vscode/bridge/iframeFsBridgeClient';

const DEFAULT_FILE_MODE = 0o644;
const DEFAULT_DIRECTORY_MODE = 0o755;

const textEncoder = new TextEncoder();
const utf8Decoder = new TextDecoder('utf-8');

type FileEncoding = 'utf8' | 'utf-8' | 'ascii' | 'binary' | 'base64' | 'hex' | 'latin1';
type ReadFileOptions = FileEncoding | { encoding?: FileEncoding | null };
type WriteFileOptions = FileEncoding | { encoding?: FileEncoding };

function createFsError(code: string, message: string, path?: string) {
    const suffix = path ? `: '${path}'` : '';
    const err = new Error(`${code}: ${message}${suffix}`) as NodeJS.ErrnoException;
    err.code = code;
    return err;
}

function resolveEncoding(options?: ReadFileOptions | WriteFileOptions): FileEncoding | null | undefined {
    if (!options) return undefined;
    if (typeof options === 'string') return options;
    return (options as { encoding?: FileEncoding | null }).encoding;
}

function decodeBytes(bytes: Uint8Array, encoding?: FileEncoding | null): string {
    if (!encoding || encoding === 'binary') return utf8Decoder.decode(bytes);
    if (encoding === 'utf8' || encoding === 'utf-8') return utf8Decoder.decode(bytes);
    if (encoding === 'ascii') return new TextDecoder('ascii').decode(bytes);
    if (encoding === 'latin1') return new TextDecoder('iso-8859-1').decode(bytes);
    if (encoding === 'base64') {
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
    if (encoding === 'hex') {
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
    return utf8Decoder.decode(bytes);
}

function encodeContent(content: string | Uint8Array, encoding?: FileEncoding): Uint8Array {
    if (content instanceof Uint8Array) return content;
    if (encoding === 'base64') {
        const binary = atob(content);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
    if (encoding === 'hex') {
        const hex = content.replace(/\s/g, '');
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
        }
        return bytes;
    }
    return textEncoder.encode(content);
}

/**
 * Adapts IframeFsBridgeClient to the IFileSystem interface expected by
 * just-bash's Bash({ fs }) constructor.
 */
export class BridgeFsAdapter implements IFileSystem {
    private client: IframeFsBridgeClient;

    constructor(client: IframeFsBridgeClient) {
        this.client = client;
    }

    async readFile(path: string, options?: ReadFileOptions): Promise<string> {
        try {
            const buffer = await this.client.readFileBuffer(path);
            const bytes = new Uint8Array(buffer);
            const encoding = resolveEncoding(options);
            return decodeBytes(bytes, encoding);
        } catch (err) {
            throw this._remapError(err, path);
        }
    }

    async readFileBuffer(path: string): Promise<Uint8Array> {
        try {
            const buffer = await this.client.readFileBuffer(path);
            return new Uint8Array(buffer);
        } catch (err) {
            throw this._remapError(err, path);
        }
    }

    async writeFile(
        path: string,
        content: string | Uint8Array,
        options?: WriteFileOptions
    ): Promise<void> {
        try {
            const encoding = resolveEncoding(options);
            const bytes = encodeContent(content, encoding);
            await this.client.writeFile(path, bytes);
        } catch (err) {
            throw this._remapError(err, path);
        }
    }

    async appendFile(
        path: string,
        content: string | Uint8Array,
        options?: WriteFileOptions
    ): Promise<void> {
        let existing = new Uint8Array(0);
        try {
            const buffer = await this.client.readFileBuffer(path);
            existing = new Uint8Array(buffer);
        } catch {
            // file doesn't exist yet — will be created
        }
        const encoding = resolveEncoding(options);
        const newBytes = encodeContent(content, encoding);
        const merged = new Uint8Array(existing.length + newBytes.length);
        merged.set(existing, 0);
        merged.set(newBytes, existing.length);
        try {
            await this.client.writeFile(path, merged);
        } catch (err) {
            throw this._remapError(err, path);
        }
    }

    async exists(path: string): Promise<boolean> {
        try {
            return await this.client.exists(path);
        } catch {
            return false;
        }
    }

    async stat(path: string) {
        try {
            const s = await this.client.stat(path);
            return this._toStat(s);
        } catch (err) {
            throw this._remapError(err, path);
        }
    }

    async lstat(path: string) {
        // Bridge has no symlink support — lstat behaves like stat
        return this.stat(path);
    }

    async mkdir(path: string, options: { recursive?: boolean } = {}): Promise<void> {
        try {
            await this.client.mkdir(path, options);
        } catch (err) {
            throw this._remapError(err, path);
        }
    }

    async readdir(path: string): Promise<string[]> {
        try {
            const entries = await this.client.readdir(path);
            return entries.map(e => e.name);
        } catch (err) {
            throw this._remapError(err, path);
        }
    }

    async readdirWithFileTypes(path: string) {
        try {
            const entries = await this.client.readdir(path);
            return entries.map(e => ({
                name: e.name,
                isFile: e.isFile,
                isDirectory: e.isDirectory,
                isSymbolicLink: e.isSymbolicLink,
            }));
        } catch (err) {
            throw this._remapError(err, path);
        }
    }

    async unlink(path: string): Promise<void> {
        try {
            await this.client.rm(path, { force: false });
        } catch (err) {
            throw this._remapError(err, path);
        }
    }

    async rmdir(path: string): Promise<void> {
        try {
            await this.client.rm(path, { recursive: false });
        } catch (err) {
            throw this._remapError(err, path);
        }
    }

    async rm(path: string, options: { recursive?: boolean; force?: boolean } = {}): Promise<void> {
        try {
            await this.client.rm(path, options);
        } catch (err) {
            throw this._remapError(err, path);
        }
    }

    async rename(fromPath: string, toPath: string): Promise<void> {
        try {
            await this.client.mv(fromPath, toPath);
        } catch (err) {
            throw this._remapError(err, fromPath);
        }
    }

    async mv(fromPath: string, toPath: string): Promise<void> {
        return this.rename(fromPath, toPath);
    }

    async cp(src: string, dest: string, options: { recursive?: boolean } = {}): Promise<void> {
        let srcStat;
        try {
            srcStat = await this.stat(src);
        } catch (err) {
            throw this._remapError(err, src);
        }
        if (srcStat.isDirectory) {
            if (!options.recursive) {
                throw createFsError('EISDIR', 'Is a directory — use recursive option', src);
            }
            await this.mkdir(dest, { recursive: true });
            const names = await this.readdir(src);
            await Promise.all(names.map(name => this.cp(`${src}/${name}`, `${dest}/${name}`, options)));
        } else {
            const bytes = await this.readFileBuffer(src);
            await this.writeFile(dest, bytes);
        }
    }

    /**
     * Returns all known paths for glob matching optimisation.
     * The bridge does not support enumerating all paths synchronously, so we
     * return an empty array — just-bash treats this as an unoptimised fallback.
     */
    getAllPaths(): string[] {
        return [];
    }

    // Stub methods for operations the bridge doesn't support
    async symlink(_target: string, _path: string): Promise<void> {
        throw createFsError('ENOSYS', 'symlinks not supported over the fs bridge');
    }

    async readlink(path: string): Promise<string> {
        throw createFsError('ENOSYS', 'readlink not supported over the fs bridge', path);
    }

    async realpath(path: string): Promise<string> {
        // No symlinks through bridge — path is already real.
        const exists = await this.exists(path);
        if (!exists) throw createFsError('ENOENT', 'No such file or directory', path);
        return path;
    }

    async chmod(_path: string, _mode: number): Promise<void> {
        // No-op: bridge does not expose chmod
    }

    async utimes(_path: string, _atime: Date | number, _mtime: Date | number): Promise<void> {
        // No-op: bridge does not expose utimes
    }

    async link(_existingPath: string, _newPath: string): Promise<void> {
        throw createFsError('ENOSYS', 'hard links not supported over the fs bridge');
    }

    /**
     * Resolves a path relative to cwd. Used by just-bash ShellCommandContext.fs.
     */
    resolvePath(cwd: string, filePath: string): string {
        if (!filePath) return cwd;
        if (filePath.startsWith('/')) return filePath;
        const base = cwd.endsWith('/') ? cwd : `${cwd}/`;
        return `${base}${filePath}`.replace(/\/+/g, '/');
    }

    private _toStat(s: { isFile: boolean; isDirectory: boolean; isSymbolicLink: boolean; size: number; mode?: number; mtimeMs?: number }) {
        const isDirectory = s.isDirectory;
        return {
            isFile: s.isFile,
            isDirectory,
            isSymbolicLink: s.isSymbolicLink,
            mode: s.mode ?? (isDirectory ? DEFAULT_DIRECTORY_MODE : DEFAULT_FILE_MODE),
            size: s.size ?? 0,
            mtime: new Date(s.mtimeMs ?? Date.now()),
            mtimeMs: s.mtimeMs ?? Date.now(),
        };
    }

    private _remapError(err: unknown, path?: string): Error {
        if (err instanceof Error) {
            const code = (err as NodeJS.ErrnoException).code;
            if (code) return err;
            // Map common bridge error messages to POSIX codes
            const msg = err.message || '';
            if (msg.includes('ENOENT') || msg.includes('not found') || msg.includes('No such file')) {
                return createFsError('ENOENT', 'No such file or directory', path);
            }
            if (msg.includes('EEXIST') || msg.includes('already exists')) {
                return createFsError('EEXIST', 'File exists', path);
            }
            if (msg.includes('ENOTDIR')) {
                return createFsError('ENOTDIR', 'Not a directory', path);
            }
            if (msg.includes('EISDIR')) {
                return createFsError('EISDIR', 'Is a directory', path);
            }
            if (msg.includes('EACCESS') || msg.includes('EACCES')) {
                return createFsError('EACCES', 'Permission denied', path);
            }
        }
        return err instanceof Error ? err : new Error(String(err));
    }
}
