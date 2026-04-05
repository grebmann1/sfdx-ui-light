/* eslint-disable import/no-unresolved */
import { hashText, pickRemoteStamp, saveSourceTracking } from 'vscode/sourceTracking';

import {
    cacheDeleteFile,
    cacheListFiles,
    ensureDir,
    listFilesAndDirsRecursive,
    writeTextFile,
} from '../core/workspaceCache.js';
import {
    auraFilename,
    getSalesforceStateDirUri,
    getWorkspaceDefaultRootUri,
    getWorkspaceMainRootUri,
    normalizeLwcResourceRelPath,
    safeSeg,
} from '../core/workspacePaths.js';

export async function fetchAndPopulateWorkspace(vscode, client) {
    const mainRoot = getWorkspaceMainRootUri(vscode);
    const defaultRoot = getWorkspaceDefaultRootUri(vscode);
    const classesDir = vscode.Uri.joinPath(defaultRoot, 'classes');
    const triggersDir = vscode.Uri.joinPath(defaultRoot, 'triggers');
    const lwcDir = vscode.Uri.joinPath(defaultRoot, 'lwc');
    const auraDir = vscode.Uri.joinPath(defaultRoot, 'aura');
    const salesforceDir = getSalesforceStateDirUri(vscode);
    const toolingMapUri = vscode.Uri.joinPath(salesforceDir, 'tooling-map.json');

    await Promise.all([
        ensureDir(vscode, classesDir),
        ensureDir(vscode, triggersDir),
        ensureDir(vscode, lwcDir),
        ensureDir(vscode, auraDir),
        ensureDir(vscode, mainRoot),
        ensureDir(vscode, salesforceDir),
    ]);

    function isEditableManagedState(record) {
        const manageableState = String(record?.ManageableState || '').toLowerCase();
        if (!manageableState) return true;
        return manageableState === 'unmanaged';
    }

    function isProtected(record) {
        return record?.IsProtected === true;
    }

    function namespacePrefix(record) {
        return record?.NamespacePrefix ? String(record.NamespacePrefix) : '';
    }

    async function toolingQueryAllWithFallback(primary, fallback) {
        try {
            return await client.toolingQueryAll(primary);
        } catch {
            return await client.toolingQueryAll(fallback);
        }
    }

    const [classes, triggers, lwcBundles, auraBundles] = await Promise.all([
        toolingQueryAllWithFallback(
            'SELECT Id, Name, Body, NamespacePrefix, ManageableState, IsProtected, LastModifiedDate, SystemModstamp FROM ApexClass ORDER BY Name',
            'SELECT Id, Name, Body, NamespacePrefix FROM ApexClass ORDER BY Name'
        ),
        toolingQueryAllWithFallback(
            'SELECT Id, Name, Body, NamespacePrefix, ManageableState, IsProtected, LastModifiedDate, SystemModstamp FROM ApexTrigger ORDER BY Name',
            'SELECT Id, Name, Body, NamespacePrefix FROM ApexTrigger ORDER BY Name'
        ),
        toolingQueryAllWithFallback(
            'SELECT Id, DeveloperName, NamespacePrefix, ManageableState, IsProtected FROM LightningComponentBundle ORDER BY DeveloperName',
            'SELECT Id, DeveloperName, NamespacePrefix FROM LightningComponentBundle ORDER BY DeveloperName'
        ),
        toolingQueryAllWithFallback(
            'SELECT Id, DeveloperName, NamespacePrefix, ManageableState, IsProtected FROM AuraDefinitionBundle ORDER BY DeveloperName',
            'SELECT Id, DeveloperName, NamespacePrefix FROM AuraDefinitionBundle ORDER BY DeveloperName'
        ),
    ]);

    const namespaceReport = {
        generatedAt: new Date().toISOString(),
        instanceUrl: client.instanceUrl,
        apiVersion: client.apiVersion,
        excluded: {
            ApexClass: [],
            ApexTrigger: [],
            LightningComponentBundle: [],
            AuraDefinitionBundle: [],
        },
        namespaces: {},
    };

    function noteNamespace(namespace) {
        const key = String(namespace || '').trim();
        if (!key) return;
        namespaceReport.namespaces[key] = namespaceReport.namespaces[key] || { count: 0 };
        namespaceReport.namespaces[key].count += 1;
    }

    async function cacheDeletePrefix(prefix) {
        const files = await cacheListFiles(prefix);
        await Promise.all(
            files.map(async file => {
                try {
                    await cacheDeleteFile(file?.path);
                } catch {
                    // ignore
                }
            })
        );
    }

    async function excludePath(path, reason, meta) {
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(path), { recursive: false });
        } catch {
            // ignore
        }
        try {
            await cacheDeleteFile(path);
        } catch {
            // ignore
        }
        const namespace = meta?.NamespacePrefix ? String(meta.NamespacePrefix) : '';
        if (namespace) {
            namespaceReport.namespaces[namespace] = namespaceReport.namespaces[namespace] || {
                count: 0,
            };
            namespaceReport.namespaces[namespace].count += 1;
        }
        return {
            path,
            reason,
            ...(namespace ? { namespace } : {}),
            ...(meta?.Id ? { id: meta.Id } : {}),
            ...(meta?.Name ? { name: meta.Name } : {}),
        };
    }

    const toolingMap = {
        generatedAt: new Date().toISOString(),
        instanceUrl: client.instanceUrl,
        apiVersion: client.apiVersion,
        items: {},
    };

    const sourceTracking = {
        generatedAt: new Date().toISOString(),
        instanceUrl: client.instanceUrl,
        apiVersion: client.apiVersion,
        items: {},
    };

    async function writeToolingMap(syncing) {
        await writeTextFile(
            vscode,
            toolingMapUri,
            JSON.stringify(
                {
                    ...toolingMap,
                    syncing,
                },
                null,
                2
            )
        );
    }

    function trackFile(path, entry, text, record) {
        try {
            if (!path || !entry?.type || !entry?.id) return;
            sourceTracking.items[path] = {
                type: entry.type,
                id: entry.id,
                ...(entry.namespace ? { namespace: entry.namespace } : {}),
                ...(entry.readOnly ? { readOnly: true } : {}),
                remoteStamp: pickRemoteStamp(record),
                hash: hashText(text ?? ''),
            };
        } catch {
            // ignore
        }
    }

    const desiredPaths = new Set();

    const namespaceRoot = namespace => {
        return vscode.Uri.joinPath(mainRoot, safeSeg(namespace));
    };

    const purgeOldDefaultPath = async (uri, reason, meta) => {
        try {
            await vscode.workspace.fs.delete(uri, { recursive: false });
        } catch {
            // ignore
        }
        try {
            await cacheDeleteFile(uri.path);
        } catch {
            // ignore
        }
        if (reason) {
            try {
                await excludePath(uri.path, reason, meta);
            } catch {
                // ignore
            }
        }
    };

    await writeToolingMap(true);

    try {
        await Promise.all(
            classes.map(async record => {
                const namespace = namespacePrefix(record);
                const defaultUri = vscode.Uri.joinPath(classesDir, `${safeSeg(record.Name)}.cls`);
                if (namespace) {
                    await purgeOldDefaultPath(defaultUri);
                    if (!record?.Body) return;
                    const namespaceClassesDir = vscode.Uri.joinPath(
                        namespaceRoot(namespace),
                        'classes'
                    );
                    await ensureDir(vscode, namespaceClassesDir);
                    const uri = vscode.Uri.joinPath(
                        namespaceClassesDir,
                        `${safeSeg(record.Name)}.cls`
                    );
                    await writeTextFile(vscode, uri, record.Body || '');
                    desiredPaths.add(uri.path);
                    noteNamespace(namespace);
                    toolingMap.items[uri.path] = {
                        type: 'ApexClass',
                        id: record.Id,
                        namespace,
                        readOnly: true,
                    };
                    trackFile(uri.path, toolingMap.items[uri.path], record.Body || '', record);
                    return;
                }

                if (isProtected(record) || !isEditableManagedState(record) || !record?.Body) {
                    namespaceReport.excluded.ApexClass.push(
                        await excludePath(
                            defaultUri.path,
                            isProtected(record)
                                ? 'protected'
                                : !isEditableManagedState(record)
                                  ? 'managed'
                                  : 'no-body',
                            record
                        )
                    );
                    return;
                }

                await writeTextFile(vscode, defaultUri, record.Body || '');
                desiredPaths.add(defaultUri.path);
                toolingMap.items[defaultUri.path] = { type: 'ApexClass', id: record.Id };
                trackFile(
                    defaultUri.path,
                    toolingMap.items[defaultUri.path],
                    record.Body || '',
                    record
                );
            })
        );

        await Promise.all(
            triggers.map(async record => {
                const namespace = namespacePrefix(record);
                const defaultUri = vscode.Uri.joinPath(
                    triggersDir,
                    `${safeSeg(record.Name)}.trigger`
                );
                if (namespace) {
                    await purgeOldDefaultPath(defaultUri);
                    if (!record?.Body) return;
                    const namespaceTriggersDir = vscode.Uri.joinPath(
                        namespaceRoot(namespace),
                        'triggers'
                    );
                    await ensureDir(vscode, namespaceTriggersDir);
                    const uri = vscode.Uri.joinPath(
                        namespaceTriggersDir,
                        `${safeSeg(record.Name)}.trigger`
                    );
                    await writeTextFile(vscode, uri, record.Body || '');
                    desiredPaths.add(uri.path);
                    noteNamespace(namespace);
                    toolingMap.items[uri.path] = {
                        type: 'ApexTrigger',
                        id: record.Id,
                        namespace,
                        readOnly: true,
                    };
                    trackFile(uri.path, toolingMap.items[uri.path], record.Body || '', record);
                    return;
                }

                if (isProtected(record) || !isEditableManagedState(record) || !record?.Body) {
                    namespaceReport.excluded.ApexTrigger.push(
                        await excludePath(
                            defaultUri.path,
                            isProtected(record)
                                ? 'protected'
                                : !isEditableManagedState(record)
                                  ? 'managed'
                                  : 'no-body',
                            record
                        )
                    );
                    return;
                }

                await writeTextFile(vscode, defaultUri, record.Body || '');
                desiredPaths.add(defaultUri.path);
                toolingMap.items[defaultUri.path] = { type: 'ApexTrigger', id: record.Id };
                trackFile(
                    defaultUri.path,
                    toolingMap.items[defaultUri.path],
                    record.Body || '',
                    record
                );
            })
        );

        for (const bundle of lwcBundles || []) {
            const namespace = namespacePrefix(bundle);
            const bundleName = safeSeg(bundle.DeveloperName);
            if (namespace) {
                try {
                    const oldDefaultBundlePath = vscode.Uri.joinPath(lwcDir, bundleName);
                    await vscode.workspace.fs.delete(oldDefaultBundlePath, { recursive: true });
                    await cacheDeletePrefix(
                        oldDefaultBundlePath.path.endsWith('/')
                            ? oldDefaultBundlePath.path
                            : `${oldDefaultBundlePath.path}/`
                    );
                } catch {
                    // ignore
                }

                const namespaceLwcDir = vscode.Uri.joinPath(namespaceRoot(namespace), 'lwc');
                const bundlePath = vscode.Uri.joinPath(namespaceLwcDir, bundleName);
                await ensureDir(vscode, bundlePath);
                try {
                    await vscode.workspace.fs.delete(vscode.Uri.joinPath(bundlePath, 'lwc'), {
                        recursive: true,
                    });
                } catch {
                    // ignore
                }

                const resources = await toolingQueryAllWithFallback(
                    `SELECT Id, FilePath, Format, Source, LastModifiedDate, SystemModstamp FROM LightningComponentResource WHERE LightningComponentBundleId='${bundle.Id}' ORDER BY FilePath`,
                    `SELECT Id, FilePath, Format, Source FROM LightningComponentResource WHERE LightningComponentBundleId='${bundle.Id}' ORDER BY FilePath`
                );
                for (const resource of resources) {
                    if (!resource?.Source) continue;
                    const relativePath = normalizeLwcResourceRelPath(
                        bundleName,
                        resource.FilePath,
                        resource.Format
                    );
                    const parts = relativePath
                        .split('/')
                        .map(safeSeg)
                        .filter(part => part && part !== '.' && part !== '..');
                    const target = vscode.Uri.joinPath(bundlePath, ...parts);
                    await writeTextFile(vscode, target, resource.Source || '');
                    desiredPaths.add(target.path);
                    noteNamespace(namespace);
                    toolingMap.items[target.path] = {
                        type: 'LightningComponentResource',
                        id: resource.Id,
                        format: resource.Format,
                        filePath: resource.FilePath,
                        namespace,
                        readOnly: true,
                    };
                    trackFile(
                        target.path,
                        toolingMap.items[target.path],
                        resource.Source || '',
                        resource
                    );
                }
                continue;
            }

            if (isProtected(bundle) || !isEditableManagedState(bundle)) {
                namespaceReport.excluded.LightningComponentBundle.push({
                    id: bundle?.Id,
                    name: bundle?.DeveloperName,
                    namespace: namespace || undefined,
                    reason: isProtected(bundle) ? 'protected' : 'managed',
                });
                try {
                    const bundlePath = vscode.Uri.joinPath(lwcDir, bundleName);
                    await vscode.workspace.fs.delete(bundlePath, { recursive: true });
                    await cacheDeletePrefix(
                        bundlePath.path.endsWith('/') ? bundlePath.path : `${bundlePath.path}/`
                    );
                } catch {
                    // ignore
                }
                continue;
            }

            const bundlePath = vscode.Uri.joinPath(lwcDir, bundleName);
            await ensureDir(vscode, bundlePath);
            try {
                await vscode.workspace.fs.delete(vscode.Uri.joinPath(bundlePath, 'lwc'), {
                    recursive: true,
                });
            } catch {
                // ignore
            }

            const resources = await toolingQueryAllWithFallback(
                `SELECT Id, FilePath, Format, Source, LastModifiedDate, SystemModstamp FROM LightningComponentResource WHERE LightningComponentBundleId='${bundle.Id}' ORDER BY FilePath`,
                `SELECT Id, FilePath, Format, Source FROM LightningComponentResource WHERE LightningComponentBundleId='${bundle.Id}' ORDER BY FilePath`
            );
            for (const resource of resources) {
                if (!resource?.Source) continue;
                const relativePath = normalizeLwcResourceRelPath(
                    bundleName,
                    resource.FilePath,
                    resource.Format
                );
                const parts = relativePath
                    .split('/')
                    .map(safeSeg)
                    .filter(part => part && part !== '.' && part !== '..');
                const target = vscode.Uri.joinPath(bundlePath, ...parts);
                await writeTextFile(vscode, target, resource.Source || '');
                desiredPaths.add(target.path);
                toolingMap.items[target.path] = {
                    type: 'LightningComponentResource',
                    id: resource.Id,
                    format: resource.Format,
                    filePath: resource.FilePath,
                };
                trackFile(
                    target.path,
                    toolingMap.items[target.path],
                    resource.Source || '',
                    resource
                );
            }
        }

        for (const bundle of auraBundles || []) {
            const namespace = namespacePrefix(bundle);
            const bundleName = safeSeg(bundle.DeveloperName);
            if (namespace) {
                try {
                    const oldDefaultBundlePath = vscode.Uri.joinPath(auraDir, bundleName);
                    await vscode.workspace.fs.delete(oldDefaultBundlePath, { recursive: true });
                    await cacheDeletePrefix(
                        oldDefaultBundlePath.path.endsWith('/')
                            ? oldDefaultBundlePath.path
                            : `${oldDefaultBundlePath.path}/`
                    );
                } catch {
                    // ignore
                }

                const namespaceAuraDir = vscode.Uri.joinPath(namespaceRoot(namespace), 'aura');
                const bundlePath = vscode.Uri.joinPath(namespaceAuraDir, bundleName);
                await ensureDir(vscode, bundlePath);
                const definitions = await toolingQueryAllWithFallback(
                    `SELECT Id, DefType, Format, Source, LastModifiedDate, SystemModstamp FROM AuraDefinition WHERE AuraDefinitionBundleId='${bundle.Id}' ORDER BY DefType`,
                    `SELECT Id, DefType, Format, Source FROM AuraDefinition WHERE AuraDefinitionBundleId='${bundle.Id}' ORDER BY DefType`
                );
                const used = new Set();
                for (const definition of definitions) {
                    if (!definition?.Source) continue;
                    let fileName = safeSeg(
                        auraFilename(bundleName, definition.DefType, definition.Format)
                    );
                    if (used.has(fileName)) {
                        fileName = `${fileName}.${String(definition.Id || '').slice(-6)}`;
                    }
                    used.add(fileName);
                    const target = vscode.Uri.joinPath(bundlePath, fileName);
                    await writeTextFile(vscode, target, definition.Source || '');
                    desiredPaths.add(target.path);
                    noteNamespace(namespace);
                    toolingMap.items[target.path] = {
                        type: 'AuraDefinition',
                        id: definition.Id,
                        defType: definition.DefType,
                        format: definition.Format,
                        namespace,
                        readOnly: true,
                    };
                    trackFile(
                        target.path,
                        toolingMap.items[target.path],
                        definition.Source || '',
                        definition
                    );
                }
                continue;
            }

            if (isProtected(bundle) || !isEditableManagedState(bundle)) {
                namespaceReport.excluded.AuraDefinitionBundle.push({
                    id: bundle?.Id,
                    name: bundle?.DeveloperName,
                    namespace: namespace || undefined,
                    reason: isProtected(bundle) ? 'protected' : 'managed',
                });
                try {
                    const bundlePath = vscode.Uri.joinPath(auraDir, bundleName);
                    await vscode.workspace.fs.delete(bundlePath, { recursive: true });
                    await cacheDeletePrefix(
                        bundlePath.path.endsWith('/') ? bundlePath.path : `${bundlePath.path}/`
                    );
                } catch {
                    // ignore
                }
                continue;
            }

            const bundlePath = vscode.Uri.joinPath(auraDir, bundleName);
            await ensureDir(vscode, bundlePath);
            const definitions = await toolingQueryAllWithFallback(
                `SELECT Id, DefType, Format, Source, LastModifiedDate, SystemModstamp FROM AuraDefinition WHERE AuraDefinitionBundleId='${bundle.Id}' ORDER BY DefType`,
                `SELECT Id, DefType, Format, Source FROM AuraDefinition WHERE AuraDefinitionBundleId='${bundle.Id}' ORDER BY DefType`
            );
            const used = new Set();
            for (const definition of definitions) {
                if (!definition?.Source) continue;
                let fileName = safeSeg(
                    auraFilename(bundleName, definition.DefType, definition.Format)
                );
                if (used.has(fileName)) {
                    fileName = `${fileName}.${String(definition.Id || '').slice(-6)}`;
                }
                used.add(fileName);
                const target = vscode.Uri.joinPath(bundlePath, fileName);
                await writeTextFile(vscode, target, definition.Source || '');
                desiredPaths.add(target.path);
                toolingMap.items[target.path] = {
                    type: 'AuraDefinition',
                    id: definition.Id,
                    defType: definition.DefType,
                    format: definition.Format,
                };
                trackFile(
                    target.path,
                    toolingMap.items[target.path],
                    definition.Source || '',
                    definition
                );
            }
        }

        try {
            try {
                const legacy = vscode.Uri.joinPath(mainRoot, '__namespace__');
                await vscode.workspace.fs.delete(legacy, { recursive: true });
                await cacheDeletePrefix(
                    legacy.path.endsWith('/') ? legacy.path : `${legacy.path}/`
                );
            } catch {
                // ignore
            }

            const { files, dirs } = await listFilesAndDirsRecursive(vscode, mainRoot);
            await Promise.all(
                files.map(async uri => {
                    try {
                        if (!uri?.path?.startsWith(mainRoot.path)) return;
                        if (!uri.path.includes('/force-app/main/')) return;
                        if (desiredPaths.has(uri.path)) return;
                        await vscode.workspace.fs.delete(uri, { recursive: false });
                        await cacheDeleteFile(uri.path);
                    } catch {
                        // ignore
                    }
                })
            );

            const sortedDirs = dirs
                .slice()
                .sort((left, right) => (right.path || '').length - (left.path || '').length);
            for (const dir of sortedDirs) {
                try {
                    // eslint-disable-next-line no-await-in-loop
                    await vscode.workspace.fs.delete(dir, { recursive: false });
                } catch {
                    // ignore
                }
            }
        } catch {
            // ignore
        }

        const index = {
            generatedAt: new Date().toISOString(),
            instanceUrl: client.instanceUrl,
            apiVersion: client.apiVersion,
            counts: {
                apexClasses: classes.length,
                apexTriggers: triggers.length,
                lwcBundles: lwcBundles.length,
                auraBundles: auraBundles.length,
            },
            excluded: {
                apexClasses: namespaceReport.excluded.ApexClass.length,
                apexTriggers: namespaceReport.excluded.ApexTrigger.length,
                lwcBundles: namespaceReport.excluded.LightningComponentBundle.length,
                auraBundles: namespaceReport.excluded.AuraDefinitionBundle.length,
            },
            namespaces: Object.keys(namespaceReport.namespaces || {}),
        };

        await writeTextFile(
            vscode,
            vscode.Uri.joinPath(salesforceDir, 'metadata-index.json'),
            JSON.stringify(index, null, 2)
        );
        try {
            await saveSourceTracking(vscode, sourceTracking);
        } catch {
            // ignore
        }
        await writeTextFile(
            vscode,
            vscode.Uri.joinPath(salesforceDir, 'namespaces.json'),
            JSON.stringify(namespaceReport, null, 2)
        );
    } finally {
        await writeToolingMap(false);
    }
}
