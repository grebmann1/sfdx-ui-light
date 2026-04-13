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
    const inferredListView = __testables.inferMetadataFromRelativePath(
        'force-app/main/default/objects/Account/listViews/AllAccounts.listView-meta.xml'
    );
    assert(
        inferredListView?.type === 'ListView' && inferredListView.member === 'Account.AllAccounts',
        'list view source paths should resolve to ListView members'
    );
    const inferredWebLink = __testables.inferMetadataFromRelativePath(
        'force-app/main/default/objects/Account/webLinks/Billing.webLink-meta.xml'
    );
    assert(
        inferredWebLink?.type === 'WebLink' && inferredWebLink.member === 'Account.Billing',
        'web link source paths should resolve to WebLink members'
    );
    const inferredValidationRule = __testables.inferMetadataFromRelativePath(
        'force-app/main/default/objects/Account/validationRules/NoBlank.validationRule-meta.xml'
    );
    assert(
        inferredValidationRule?.type === 'ValidationRule' &&
            inferredValidationRule.member === 'Account.NoBlank',
        'validation rule paths should resolve to ValidationRule members'
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
                    if (uri.path === '/workspace') {
                        return [
                            ['force-app', 2],
                            ['manifest', 2],
                        ];
                    }
                    if (uri.path === '/workspace/force-app') {
                        return [['main', 2]];
                    }
                    if (uri.path === '/workspace/force-app/main') {
                        return [['default', 2]];
                    }
                    if (uri.path === '/workspace/force-app/main/default') {
                        return [
                            ['classes', 2],
                            ['lwc', 2],
                        ];
                    }
                    if (uri.path === '/workspace/force-app/main/default/classes') {
                        return [
                            ['Example.cls', 1],
                            ['Example.cls-meta.xml', 1],
                        ];
                    }
                    if (uri.path === '/workspace/force-app/main/default/lwc') {
                        return [['helloWorld', 2]];
                    }
                    if (uri.path === '/workspace/force-app/main/default/lwc/helloWorld') {
                        return [
                            ['helloWorld.js', 1],
                            ['helloWorld.html', 1],
                            ['helloWorld.js-meta.xml', 1],
                        ];
                    }
                    if (uri.path === '/workspace/manifest') {
                        return [['existing.xml', 1]];
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
        generated.packageXml.includes('<name>LightningComponentBundle</name>') &&
            generated.packageXml.includes('<members>helloWorld</members>'),
        'workspace-wide generation should include LWC bundles even when the selection is Apex-only'
    );
    assert(
        generated.sourcePaths.some((path: string) =>
            path.includes('/force-app/main/default/lwc/helloWorld/helloWorld.js-meta.xml')
        ),
        'workspace-wide generation should scan workspace LWC source files'
    );
    assert(
        generated.packageXml.includes('<version>60.0</version>'),
        'generated manifests should use the workspace API version'
    );

    const workspaceGenerated = await runtime.generatePackageXmlFromWorkspace();
    assert(
        workspaceGenerated.packageXml.includes('<name>ApexClass</name>') &&
            workspaceGenerated.packageXml.includes('<name>LightningComponentBundle</name>'),
        'workspace generation should include both Apex and LWC metadata types'
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
