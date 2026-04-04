/* eslint-env jest */
import {
    DEFAULT_SOURCE_API_VERSION,
    parseSourceApiVersionFromSfdxProject,
    resolveWorkspaceApiVersionFromVscode,
    updateSourceApiVersionInSfdxProject,
} from '../../../workbench/sfdxProject.js';

describe('sfdxProject helpers', () => {
    it('reads sourceApiVersion from sfdx-project.json', () => {
        expect(
            parseSourceApiVersionFromSfdxProject(JSON.stringify({ sourceApiVersion: '65.0' }))
        ).toBe('65.0');
    });

    it('falls back when sfdx-project.json is invalid', () => {
        expect(parseSourceApiVersionFromSfdxProject('{oops', '64.0')).toBe('64.0');
    });

    it('updates sourceApiVersion while preserving other project fields', () => {
        const next = JSON.parse(
            updateSourceApiVersionInSfdxProject(
                JSON.stringify({
                    name: 'Demo',
                    packageDirectories: [{ path: 'force-app', default: true }],
                    sourceApiVersion: '65.0',
                }),
                '67.0'
            )
        );

        expect(next.name).toBe('Demo');
        expect(next.packageDirectories).toEqual([{ path: 'force-app', default: true }]);
        expect(next.sourceApiVersion).toBe('67.0');
    });

    it('reads the workspace api version through vscode fs', async () => {
        const vscode = {
            Uri: {
                joinPath(base, ...segments) {
                    return {
                        path: [base.path, ...segments].join('/').replace(/\/+/g, '/'),
                    };
                },
            },
            workspace: {
                workspaceFolders: [{ uri: { path: '/workspace/orgs/test' } }],
                fs: {
                    async readFile(uri) {
                        expect(uri.path).toBe('/workspace/orgs/test/sfdx-project.json');
                        return new TextEncoder().encode(
                            JSON.stringify({ sourceApiVersion: '67.0' })
                        );
                    },
                },
            },
        };

        await expect(resolveWorkspaceApiVersionFromVscode(vscode)).resolves.toBe('67.0');
    });

    it('uses the shared default when the workspace file is unavailable', async () => {
        const vscode = {
            Uri: {
                joinPath(base, ...segments) {
                    return {
                        path: [base.path, ...segments].join('/').replace(/\/+/g, '/'),
                    };
                },
            },
            workspace: {
                workspaceFolders: [{ uri: { path: '/workspace/orgs/test' } }],
                fs: {
                    async readFile() {
                        throw new Error('missing');
                    },
                },
            },
        };

        await expect(resolveWorkspaceApiVersionFromVscode(vscode)).resolves.toBe(
            DEFAULT_SOURCE_API_VERSION
        );
    });
});
