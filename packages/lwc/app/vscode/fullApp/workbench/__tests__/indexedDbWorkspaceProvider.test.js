/* eslint-env jest */
import { createIndexedDbWorkspaceProvider } from '../indexedDbWorkspaceProvider.js';

function createVscodeStub() {
    function createFsError(kind, message) {
        const error = new Error(message);
        error.name = `${kind} (FileSystemError)`;
        return error;
    }

    return {
        FileType: {
            File: 1,
            Directory: 2,
            SymbolicLink: 64,
        },
        FileSystemError: {
            FileNotFound: message => createFsError('FileNotFound', message),
            FileExists: message => createFsError('FileExists', message),
            FileIsADirectory: message => createFsError('FileIsADirectory', message),
            FileNotADirectory: message => createFsError('FileNotADirectory', message),
            NoPermissions: message => createFsError('NoPermissions', message),
            Unavailable: message => createFsError('Unavailable', message),
        },
    };
}

function createFsStub({ toolingMapItems = {}, toolingMapSyncing = false } = {}) {
    const writes = [];
    const moves = [];
    const mkdirs = [];

    return {
        writes,
        moves,
        mkdirs,
        async stat(path) {
            if (path === '/workspace') {
                return {
                    isDirectory: true,
                    isFile: false,
                    isSymbolicLink: false,
                    size: 0,
                    mtime: new Date(10),
                };
            }
            if (path === '/workspace/.salesforce/tooling-map.json') {
                return {
                    isDirectory: false,
                    isFile: true,
                    isSymbolicLink: false,
                    size: 10,
                    mtime: new Date(20),
                };
            }
            if (path === '/workspace/notes.txt') {
                return {
                    isDirectory: false,
                    isFile: true,
                    isSymbolicLink: false,
                    size: 4,
                    mtime: new Date(30),
                };
            }
            const error = new Error(`Missing path: ${path}`);
            error.code = 'ENOENT';
            throw error;
        },
        async readdirWithFileTypes(path) {
            if (path !== '/workspace') {
                const error = new Error(`Missing path: ${path}`);
                error.code = 'ENOENT';
                throw error;
            }
            return [
                { name: '.salesforce', isDirectory: true, isFile: false, isSymbolicLink: false },
                { name: 'notes.txt', isDirectory: false, isFile: true, isSymbolicLink: false },
            ];
        },
        async readFileBuffer(path) {
            if (path === '/workspace/notes.txt') {
                return new TextEncoder().encode('note');
            }
            const error = new Error(`Missing path: ${path}`);
            error.code = 'ENOENT';
            throw error;
        },
        async readFile(path) {
            if (path === '/workspace/.salesforce/tooling-map.json') {
                return JSON.stringify({
                    syncing: toolingMapSyncing,
                    items: toolingMapItems,
                });
            }
            const error = new Error(`Missing path: ${path}`);
            error.code = 'ENOENT';
            throw error;
        },
        async exists(path) {
            return (
                path === '/workspace/notes.txt' ||
                path === '/workspace/.salesforce/tooling-map.json'
            );
        },
        async writeFile(path, content) {
            writes.push({
                path,
                content: content instanceof Uint8Array ? Array.from(content) : content,
            });
        },
        async mkdir(path, options) {
            mkdirs.push({ path, options });
        },
        async rm(path) {
            writes.push({ path, deleted: true });
        },
        async mv(from, to) {
            moves.push({ from, to });
        },
    };
}

describe('indexedDbWorkspaceProvider', () => {
    it('maps workspace stats and directory entries to VS Code file types', async () => {
        const provider = createIndexedDbWorkspaceProvider({
            fs: createFsStub(),
            vscode: createVscodeStub(),
            workspaceRoot: '/workspace',
        });

        const stat = await provider.stat({ path: '/workspace/notes.txt' });
        const entries = await provider.readdir({ path: '/workspace' });

        expect(stat.type).toBe(1);
        expect(stat.size).toBe(4);
        expect(entries).toEqual([
            ['.salesforce', 2],
            ['notes.txt', 1],
        ]);
    });

    it('rejects paths outside the active workspace root', async () => {
        const provider = createIndexedDbWorkspaceProvider({
            fs: createFsStub(),
            vscode: createVscodeStub(),
            workspaceRoot: '/workspace',
        });

        await expect(provider.stat({ path: '/tmp/elsewhere.txt' })).rejects.toMatchObject({
            name: 'Unavailable (FileSystemError)',
        });
    });

    it('blocks writes to read-only Salesforce paths from tooling-map.json', async () => {
        const provider = createIndexedDbWorkspaceProvider({
            fs: createFsStub({
                toolingMapItems: {
                    '/workspace/force-app/main/default/classes/Managed.cls': {
                        readOnly: true,
                    },
                },
            }),
            vscode: createVscodeStub(),
            workspaceRoot: '/workspace',
        });

        await expect(
            provider.writeFile(
                { path: '/workspace/force-app/main/default/classes/Managed.cls' },
                new Uint8Array([1, 2, 3]),
                { create: true, overwrite: true }
            )
        ).rejects.toMatchObject({
            name: 'NoPermissions (FileSystemError)',
        });
    });

    it('blocks creating new files inside a read-only namespace subtree', async () => {
        const provider = createIndexedDbWorkspaceProvider({
            fs: createFsStub({
                toolingMapItems: {
                    '/workspace/force-app/main/acme/classes/Managed.cls': {
                        readOnly: true,
                    },
                },
            }),
            vscode: createVscodeStub(),
            workspaceRoot: '/workspace',
        });

        await expect(
            provider.writeFile(
                { path: '/workspace/force-app/main/acme/classes/NewFile.cls' },
                new Uint8Array([1]),
                { create: true, overwrite: true }
            )
        ).rejects.toMatchObject({
            name: 'NoPermissions (FileSystemError)',
        });
    });

    it('allows writes to read-only managed paths while tooling-map sync is in progress', async () => {
        const fs = createFsStub({
            toolingMapSyncing: true,
            toolingMapItems: {
                '/workspace/force-app/main/acme/classes/Managed.cls': {
                    readOnly: true,
                },
            },
        });
        const provider = createIndexedDbWorkspaceProvider({
            fs,
            vscode: createVscodeStub(),
            workspaceRoot: '/workspace',
        });

        await provider.writeFile(
            { path: '/workspace/force-app/main/acme/classes/Managed.cls' },
            new Uint8Array([4, 5, 6]),
            { create: true, overwrite: true }
        );

        expect(fs.writes).toContainEqual({
            path: '/workspace/force-app/main/acme/classes/Managed.cls',
            content: [4, 5, 6],
        });
    });

    it('allows deleting read-only managed paths while tooling-map sync is in progress', async () => {
        const fs = createFsStub({
            toolingMapSyncing: true,
            toolingMapItems: {
                '/workspace/force-app/main/acme/classes/Managed.cls': {
                    readOnly: true,
                },
            },
        });
        const provider = createIndexedDbWorkspaceProvider({
            fs,
            vscode: createVscodeStub(),
            workspaceRoot: '/workspace',
        });

        await provider.delete(
            { path: '/workspace/force-app/main/acme/classes/Managed.cls' },
            { recursive: false }
        );

        expect(fs.writes).toContainEqual({
            path: '/workspace/force-app/main/acme/classes/Managed.cls',
            deleted: true,
        });
    });

    it('creates nested directories recursively for workspace writes', async () => {
        const fs = createFsStub();
        const provider = createIndexedDbWorkspaceProvider({
            fs,
            vscode: createVscodeStub(),
            workspaceRoot: '/workspace',
        });

        await provider.mkdir({
            path: '/workspace/force-app/main/default/lwc/component/utils/helpers',
        });

        expect(fs.mkdirs).toEqual([
            {
                path: '/workspace/force-app/main/default/lwc/component/utils/helpers',
                options: { recursive: true },
            },
        ]);
    });

    it('emits file change events after a successful write', async () => {
        const fs = createFsStub();
        const provider = createIndexedDbWorkspaceProvider({
            fs,
            vscode: createVscodeStub(),
            workspaceRoot: '/workspace',
        });
        const changes = [];

        const disposable = provider.onDidChangeFile(event => {
            changes.push(...event);
        });

        await provider.writeFile({ path: '/workspace/new-file.txt' }, new Uint8Array([7, 8, 9]), {
            create: true,
            overwrite: true,
        });
        await new Promise(resolve => setTimeout(resolve, 10));

        disposable.dispose();

        expect(fs.writes).toEqual([
            {
                path: '/workspace/new-file.txt',
                content: [7, 8, 9],
            },
        ]);
        expect(changes).toEqual([
            {
                resource: { path: '/workspace/new-file.txt' },
                type: 1,
            },
        ]);
    });
});
