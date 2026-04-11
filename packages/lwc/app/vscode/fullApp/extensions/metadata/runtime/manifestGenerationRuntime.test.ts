import { __testables, createManifestGenerationRuntime } from './manifestGenerationRuntime';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

async function main() {
    const makeUri = (path: string) => ({
        path,
        with(next: { path?: string }) {
            return makeUri(next?.path || path);
        },
    });

    assert(
        __testables.normalizeManifestFileName('generated-manifest') === 'generated-manifest.xml',
        'manifest names without an extension should gain .xml'
    );
    assert(
        __testables.normalizeManifestFileName('nested/path/package.xml') === 'package.xml',
        'manifest names should keep only the file leaf name'
    );

    const inferredField = __testables.inferMetadataFromRelativePath(
        'force-app/main/default/objects/Account/fields/Custom_Field__c.field-meta.xml'
    );
    assert(
        inferredField?.type === 'CustomField' && inferredField.member === 'Account.Custom_Field__c',
        'custom field source paths should resolve to CustomField members'
    );

    const mockedFiles = new Map<string, Uint8Array>();
    const vscode = {
        FileType: {
            File: 1,
            Directory: 2,
        },
        Uri: {
            file(path: string) {
                return makeUri(path);
            },
            joinPath(base: { path: string }, ...parts: string[]) {
                return makeUri(
                    `${String(base.path || '').replace(/\/+$/, '')}/${parts.join('/')}`.replace(
                        /\/+/g,
                        '/'
                    )
                );
            },
        },
        workspace: {
            workspaceFolders: [{ uri: makeUri('/workspace') }],
            fs: {
                async stat(uri: { path: string }) {
                    if (uri.path === '/workspace/force-app/main/default/classes') {
                        return { type: 2 };
                    }
                    if (uri.path === '/workspace/manifest/existing.xml') {
                        return { type: 1 };
                    }
                    if (mockedFiles.has(uri.path)) {
                        return { type: 1 };
                    }
                    throw new Error('missing');
                },
                async readDirectory(uri: { path: string }) {
                    if (uri.path === '/workspace/force-app/main/default/classes') {
                        return [
                            ['Example.cls', 1],
                            ['Example.cls-meta.xml', 1],
                        ];
                    }
                    return [];
                },
                async readFile(uri: { path: string }) {
                    if (uri.path === '/workspace/sfdx-project.json') {
                        return new TextEncoder().encode(
                            JSON.stringify({ sourceApiVersion: '60.0' })
                        );
                    }
                    if (mockedFiles.has(uri.path)) {
                        return mockedFiles.get(uri.path) as Uint8Array;
                    }
                    throw new Error('missing');
                },
                async writeFile(uri: { path: string }, content: Uint8Array) {
                    mockedFiles.set(uri.path, content);
                },
                async createDirectory() {
                    return undefined;
                },
            },
        },
    };

    const runtime = createManifestGenerationRuntime({ vscode });
    const generated = await runtime.generatePackageXmlFromSelection({
        sourceUri: { path: '/workspace/force-app/main/default/classes' },
    });

    assert(
        generated.selectedUris.length === 2,
        'directory selections should expand into their child source files'
    );
    assert(
        generated.packageXml.includes('<name>ApexClass</name>') &&
            generated.packageXml.includes('<members>Example</members>'),
        'folder-driven generation should emit package.xml entries for selected source members'
    );
    assert(
        generated.packageXml.includes('<version>60.0</version>'),
        'generated manifests should use the workspace API version'
    );

    const saved = await runtime.writeManifestFile('custom-manifest', generated.packageXml);
    assert(
        saved.uri.path === '/workspace/manifest/custom-manifest.xml',
        'generated manifests should be written under the manifest/ folder'
    );
    assert(
        mockedFiles.has('/workspace/manifest/custom-manifest.xml'),
        'manifest content should be written to the target file'
    );

    let duplicateError = '';
    try {
        await runtime.writeManifestFile('existing', generated.packageXml);
    } catch (error) {
        duplicateError = error instanceof Error ? error.message : String(error);
    }
    assert(
        duplicateError.includes('manifest/existing.xml'),
        'duplicate manifest names should be rejected before writing'
    );
}

main().catch(error => {
    throw error;
});
