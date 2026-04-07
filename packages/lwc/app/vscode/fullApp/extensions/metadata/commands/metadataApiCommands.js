/* eslint-disable import/no-unresolved */
import { createMetadataApiClient, unzipRetrieveZip, zipUnpackagedFiles } from 'vscode/metadataApi';

import {
    ensureDir,
    listFilesAndDirsRecursive,
    writeBytesFile,
    writeTextFile,
} from '../core/workspaceCache.js';
import {
    auraFilename,
    getSalesforceStateDirUri,
    getWorkspaceDefaultRootUri,
    getWorkspaceRootPath,
    getWorkspaceRootUri,
    getWorkspaceUri,
    normalizeLwcResourceRelPath,
    safeSeg,
    toWorkspaceRelativeLabel,
} from '../core/workspacePaths.js';
import { fetchAndPopulateWorkspace } from '../runtime/workspaceSync.js';

export function parsePackageXml(xmlText) {
    const output = new Map();
    const text = String(xmlText || '');
    if (!text.trim()) return output;
    try {
        const doc = new DOMParser().parseFromString(text, 'application/xml');
        const types = Array.from(doc.getElementsByTagName('types') || []);
        for (const typeNode of types) {
            const nameElement = typeNode.getElementsByTagName('name')?.[0];
            const typeName = nameElement?.textContent ? String(nameElement.textContent).trim() : '';
            if (!typeName) continue;
            const members = Array.from(typeNode.getElementsByTagName('members') || [])
                .map(member => String(member.textContent || '').trim())
                .filter(Boolean);
            if (!members.length) continue;
            output.set(typeName, new Set(members));
        }
        return output;
    } catch {
        // fall back to regex parser
    }
    const typesBlocks = text.split(/<types>/i).slice(1);
    for (const block of typesBlocks) {
        const nameMatch = block.match(/<name>\s*([^<]+)\s*<\/name>/i);
        const typeName = nameMatch ? String(nameMatch[1]).trim() : '';
        if (!typeName) continue;
        const members = Array.from(block.matchAll(/<members>\s*([^<]+)\s*<\/members>/gi))
            .map(match => String(match[1] || '').trim())
            .filter(Boolean);
        if (!members.length) continue;
        output.set(typeName, new Set(members));
    }
    return output;
}

export function registerMetadataApiCommands({ connectionRuntime, context, deployTools }) {
    const { vscode } = context;

    async function loadToolingMapJson() {
        try {
            const uri = getWorkspaceUri(vscode, '.salesforce/tooling-map.json');
            const bytes = await vscode.workspace.fs.readFile(uri);
            const text = new TextDecoder().decode(bytes || new Uint8Array());
            const parsed = JSON.parse(text || '{}');
            return parsed && typeof parsed === 'object' ? parsed : { items: {} };
        } catch {
            return { items: {} };
        }
    }

    async function saveToolingMapJson(obj) {
        const uri = getWorkspaceUri(vscode, '.salesforce/tooling-map.json');
        const next = obj && typeof obj === 'object' ? obj : { items: {} };
        if (!next.items || typeof next.items !== 'object') next.items = {};
        next.generatedAt = new Date().toISOString();
        await writeTextFile(vscode, uri, JSON.stringify(next, null, 2), { skipCache: true });
        deployTools.invalidateToolingMap();
    }

    async function withMetadataApiClientAuthed(conn, fn) {
        const baseConnection = await connectionRuntime.applyWorkspaceApiVersion(conn);
        const current = await connectionRuntime
            .resolveConnectionRecord(baseConnection)
            .catch(() => baseConnection);
        const effectiveCurrent = await connectionRuntime.applyWorkspaceApiVersion(
            current,
            baseConnection?.apiVersion
        );
        const context = connectionRuntime.requireCurrentContext();
        const client = createMetadataApiClient({
            connection: context.connector.conn,
            apiVersion: effectiveCurrent.apiVersion,
        });
        try {
            return await fn(client, effectiveCurrent);
        } catch (error) {
            if (!connectionRuntime.isAuthError(error)) throw error;
            const refreshedRaw = await connectionRuntime
                .refreshConnectionRecord(effectiveCurrent)
                .catch(() => null);
            const refreshed = await connectionRuntime.applyWorkspaceApiVersion(
                refreshedRaw,
                effectiveCurrent?.apiVersion
            );
            if (!refreshed) throw error;
            const retryContext = connectionRuntime.requireCurrentContext();
            const retryClient = createMetadataApiClient({
                connection: retryContext.connector.conn,
                apiVersion: refreshed.apiVersion,
            });
            return await fn(retryClient, refreshed);
        }
    }

    async function retrieveViaMetadataApi(conn, typesMap, { title } = {}) {
        const { effectiveConn, id } = await withMetadataApiClientAuthed(
            conn,
            async (client, activeConn) => {
                const response = await client.retrieve({ typesMap });
                return { id: response.id, effectiveConn: activeConn };
            }
        );
        const startedAt = Date.now();
        let lastStatus = '';
        const status = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: title || 'Retrieving via Metadata API…',
                cancellable: false,
            },
            async progress => {
                for (;;) {
                    // eslint-disable-next-line no-await-in-loop
                    const nextStatus = await withMetadataApiClientAuthed(
                        effectiveConn || conn,
                        async client => await client.checkRetrieveStatus(id, { includeZip: true })
                    );
                    const message =
                        nextStatus.status ||
                        (nextStatus.done
                            ? nextStatus.success
                                ? 'Succeeded'
                                : 'Failed'
                            : 'In progress');
                    if (message && message !== lastStatus) {
                        lastStatus = message;
                        progress.report({ message });
                    }
                    if (nextStatus.done) return nextStatus;
                    if (Date.now() - startedAt > 10 * 60 * 1000) {
                        throw new Error('Retrieve timed out (10 minutes).');
                    }
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        );
        if (!status.success) {
            throw new Error(
                status.errorMessage || `Retrieve failed: ${status.status || 'Unknown error'}`
            );
        }
        if (!status.zipFile) {
            throw new Error('Retrieve succeeded but returned no zipFile.');
        }

        const files = unzipRetrieveZip(status.zipFile);
        const writtenPaths = [];
        const map = {
            generatedAt: new Date().toISOString(),
            instanceUrl: (effectiveConn || conn).instanceUrl,
            apiVersion: (effectiveConn || conn).apiVersion,
            items: {},
        };
        const root = getWorkspaceDefaultRootUri(vscode);
        const base = root.path;
        await ensureDir(vscode, root);

        for (const [zipPathRaw, bytes] of Object.entries(files || {})) {
            const zipPath = String(zipPathRaw || '');
            if (!zipPath || zipPath.endsWith('/')) continue;
            let relativePath = zipPath.replace(/\\/g, '/');
            if (relativePath.startsWith('unpackaged/')) {
                relativePath = relativePath.slice('unpackaged/'.length);
            }
            if (
                !relativePath ||
                relativePath === 'package.xml' ||
                relativePath.endsWith('/package.xml')
            ) {
                continue;
            }
            const target = vscode.Uri.file(`${base}/${relativePath}`.replace(/\/+/g, '/'));
            // eslint-disable-next-line no-await-in-loop
            await writeBytesFile(vscode, target, bytes);
            writtenPaths.push(target.path);
            map.items[target.path] = { zipPath };
        }

        await writeTextFile(
            vscode,
            getWorkspaceUri(vscode, '.salesforce/metadata-api-map.json'),
            JSON.stringify(map, null, 2),
            { skipCache: true }
        );

        return { writtenPaths };
    }

    register('salesforceMetadata.fetchMetadata', async () => {
        const conn = connectionRuntime.loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.window.showErrorMessage(
                connectionRuntime.getInjectedConnectionRequiredMessage()
            );
            return;
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Syncing project from Salesforce…',
                cancellable: false,
            },
            async () =>
                await connectionRuntime.withToolingClientAuthed(conn, async client => {
                    await fetchAndPopulateWorkspace(vscode, client);
                })
        );

        deployTools.invalidateToolingMap();
        try {
            await vscode.commands.executeCommand('salesforceMetadata.refreshProject');
        } catch {
            // ignore
        }
        await vscode.window.showInformationMessage(
            'Project sync complete. Metadata, tooling map, and source tracking were refreshed.'
        );
    });

    async function deployViaMetadataApi(conn, { checkOnly, packageXmlText } = {}) {
        const root = getWorkspaceDefaultRootUri(vscode);
        const { files } = await listFilesAndDirsRecursive(vscode, root);
        const pathToBytes = {
            'unpackaged/package.xml': new TextEncoder().encode(String(packageXmlText || '')),
        };
        for (const uri of files || []) {
            const path = uri?.path || '';
            if (!path || path.includes('/.salesforce/') || path.includes('/.vscode/')) continue;
            const defaultRootPath = `${root.path.replace(/\/+$/, '')}/`;
            const relativePath = path.startsWith(defaultRootPath)
                ? path.slice(defaultRootPath.length)
                : null;
            if (!relativePath) continue;
            // eslint-disable-next-line no-await-in-loop
            const bytes = await vscode.workspace.fs.readFile(uri);
            pathToBytes[`unpackaged/${relativePath}`] = bytes;
        }

        const zipBytes = zipUnpackagedFiles(pathToBytes);
        const { effectiveConn, id } = await withMetadataApiClientAuthed(
            conn,
            async (client, activeConn) => {
                const response = await client.deploy(zipBytes, { checkOnly: Boolean(checkOnly) });
                return { id: response.id, effectiveConn: activeConn };
            }
        );

        const startedAt = Date.now();
        let lastStatus = '';
        const status = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: checkOnly ? 'Validating deploy…' : 'Deploying…',
                cancellable: false,
            },
            async progress => {
                for (;;) {
                    // eslint-disable-next-line no-await-in-loop
                    const nextStatus = await withMetadataApiClientAuthed(
                        effectiveConn || conn,
                        async client => await client.checkDeployStatus(id, { includeDetails: true })
                    );
                    const message =
                        nextStatus.status ||
                        (nextStatus.done
                            ? nextStatus.success
                                ? 'Succeeded'
                                : 'Failed'
                            : 'In progress');
                    if (message && message !== lastStatus) {
                        lastStatus = message;
                        progress.report({ message });
                    }
                    if (nextStatus.done) return nextStatus;
                    if (Date.now() - startedAt > 20 * 60 * 1000) {
                        throw new Error('Deploy timed out (20 minutes).');
                    }
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        );
        if (!status.success) {
            throw new Error(
                status.errorMessage || `Deploy failed: ${status.status || 'Unknown error'}`
            );
        }
        return status;
    }

    async function pickPackageXmlUnderWorkspace() {
        const projectRoot = getWorkspaceRootUri(vscode);
        const { files } = await listFilesAndDirsRecursive(vscode, projectRoot);
        const candidates = (files || [])
            .filter(uri => uri?.path && uri.path.toLowerCase().endsWith('package.xml'))
            .slice(0, 50);
        if (!candidates.length) return null;
        const picked = await vscode.window.showQuickPick(
            candidates.map(uri => ({
                label: toWorkspaceRelativeLabel(vscode, uri.path),
                description: uri.path,
                uri,
            })),
            {
                title: 'Select package.xml',
                placeHolder: 'Select a package.xml',
                ignoreFocusOut: true,
                matchOnDescription: true,
            }
        );
        return picked?.uri || null;
    }

    function parseDescribeMetadataTypes(doc) {
        const output = new Set();
        try {
            const metadataObjects = Array.from(
                doc.getElementsByTagNameNS?.('*', 'metadataObjects') ||
                    doc.getElementsByTagName('metadataObjects') ||
                    []
            );
            for (const metadataObject of metadataObjects) {
                const xmlNameElement =
                    metadataObject.getElementsByTagNameNS?.('*', 'xmlName')?.[0] ||
                    metadataObject.getElementsByTagName('xmlName')?.[0];
                const name = xmlNameElement?.textContent
                    ? String(xmlNameElement.textContent).trim()
                    : '';
                if (name) output.add(name);
            }
        } catch {
            // ignore
        }
        return Array.from(output).sort((left, right) => left.localeCompare(right));
    }

    function register(command, handler) {
        return context.addDisposable(vscode.commands.registerCommand(command, handler));
    }

    register('salesforceMetadata.retrieveManifest', async () => {
        const conn = connectionRuntime.loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.window.showErrorMessage(
                connectionRuntime.getInjectedConnectionRequiredMessage()
            );
            return;
        }

        const projectRoot = getWorkspaceRootUri(vscode);
        const { files } = await listFilesAndDirsRecursive(vscode, projectRoot);
        const candidates = (files || [])
            .filter(uri => uri?.path && uri.path.toLowerCase().endsWith('package.xml'))
            .slice(0, 50);
        if (!candidates.length) {
            await vscode.window.showWarningMessage(
                `No package.xml found under ${getWorkspaceRootPath(vscode)}.`
            );
            return;
        }

        const picked = await vscode.window.showQuickPick(
            candidates.map(uri => ({
                label: toWorkspaceRelativeLabel(vscode, uri.path),
                description: uri.path,
                uri,
            })),
            {
                title: 'Retrieve from manifest (package.xml)',
                placeHolder: 'Select a package.xml',
                ignoreFocusOut: true,
                matchOnDescription: true,
            }
        );
        if (!picked?.uri) return;

        const xml = new TextDecoder().decode(await vscode.workspace.fs.readFile(picked.uri));
        const manifest = parsePackageXml(xml);
        if (!manifest.size) {
            await vscode.window.showErrorMessage('Manifest parse failed or contains no <types>.');
            return;
        }

        const toolingSupported = new Set([
            'ApexClass',
            'ApexTrigger',
            'LightningComponentBundle',
            'AuraDefinitionBundle',
        ]);
        const requestedToolingTypes = Array.from(manifest.keys()).filter(type =>
            toolingSupported.has(type)
        );
        const hasUnsupported = Array.from(manifest.keys()).some(
            type => !toolingSupported.has(type)
        );

        if (hasUnsupported) {
            const pick = await vscode.window.showQuickPick(
                [
                    {
                        label: 'Retrieve full manifest via Metadata API (recommended)',
                        detail: 'Supports Flows, Permission Sets, Custom Objects, and more',
                        _metadataApi: true,
                    },
                    {
                        label: 'Retrieve supported types via Tooling API (fast)',
                        detail: 'Only: ApexClass, ApexTrigger, LightningComponentBundle, AuraDefinitionBundle',
                        _tooling: true,
                    },
                ],
                {
                    title: 'Manifest contains non-Tooling types',
                    ignoreFocusOut: true,
                }
            );
            if (!pick) return;
            if (pick._metadataApi) {
                const result = await retrieveViaMetadataApi(conn, manifest, {
                    title: 'Retrieving manifest via Metadata API…',
                });
                deployTools.invalidateToolingMap();
                try {
                    await vscode.commands.executeCommand('salesforceMetadata.refreshProject');
                } catch {
                    // ignore
                }
                await vscode.window.showInformationMessage(
                    `Retrieved ${result.writtenPaths.length} file(s) via Metadata API.`
                );
                return;
            }
        }

        if (!requestedToolingTypes.length) {
            await vscode.window.showWarningMessage(
                'Manifest does not include Tooling-supported types. Use “Retrieve Source in Manifest (Metadata API)” instead.'
            );
            return;
        }

        await connectionRuntime.withToolingClientAuthed(conn, async client => {
            const toolingMap = await loadToolingMapJson();
            const pulledPaths = [];

            const ensureDefaultDirs = async () => {
                await ensureDir(vscode, getWorkspaceUri(vscode, 'force-app/main/default/classes'));
                await ensureDir(vscode, getWorkspaceUri(vscode, 'force-app/main/default/triggers'));
                await ensureDir(vscode, getWorkspaceUri(vscode, 'force-app/main/default/lwc'));
                await ensureDir(vscode, getWorkspaceUri(vscode, 'force-app/main/default/aura'));
                await ensureDir(vscode, getSalesforceStateDirUri(vscode));
            };
            await ensureDefaultDirs();

            const membersOrAll = set => {
                const nextSet = set instanceof Set ? set : new Set();
                return {
                    all: nextSet.has('*'),
                    members: Array.from(nextSet).filter(member => member && member !== '*'),
                };
            };

            const pullApex = async (sobject, dir, ext, members) => {
                const { all, members: names } = membersOrAll(members);
                const soql =
                    all || !names.length
                        ? `SELECT Id, Name, Body, LastModifiedDate, SystemModstamp FROM ${sobject} ORDER BY Name`
                        : `SELECT Id, Name, Body, LastModifiedDate, SystemModstamp FROM ${sobject} WHERE Name IN (${names.map(name => `'${String(name).replace(/'/g, "\\\\'")}'`).join(',')}) ORDER BY Name`;
                const rows = await client.toolingQueryAll(soql);
                for (const row of rows || []) {
                    if (!row?.Id || !row?.Name) continue;
                    const uri = getWorkspaceUri(
                        vscode,
                        `force-app/main/default/${dir}/${safeSeg(row.Name)}.${ext}`
                    );
                    await writeTextFile(vscode, uri, row.Body || '');
                    pulledPaths.push(uri.path);
                    toolingMap.items[uri.path] = { type: sobject, id: row.Id };
                }
            };

            const pullLwcBundles = async members => {
                const { all, members: names } = membersOrAll(members);
                const soql =
                    all || !names.length
                        ? 'SELECT Id, DeveloperName FROM LightningComponentBundle ORDER BY DeveloperName'
                        : `SELECT Id, DeveloperName FROM LightningComponentBundle WHERE DeveloperName IN (${names.map(name => `'${String(name).replace(/'/g, "\\\\'")}'`).join(',')}) ORDER BY DeveloperName`;
                const bundles = await client.toolingQueryAll(soql);
                for (const bundle of bundles || []) {
                    if (!bundle?.Id || !bundle?.DeveloperName) continue;
                    const bundleName = safeSeg(bundle.DeveloperName);
                    const bundlePath = getWorkspaceUri(
                        vscode,
                        `force-app/main/default/lwc/${bundleName}`
                    );
                    await ensureDir(vscode, bundlePath);
                    const resources = await client.toolingQueryAll(
                        `SELECT Id, FilePath, Format, Source, LastModifiedDate, SystemModstamp FROM LightningComponentResource WHERE LightningComponentBundleId='${bundle.Id}' ORDER BY FilePath`
                    );
                    for (const resource of resources || []) {
                        if (!resource?.Id || !resource?.Source) continue;
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
                        pulledPaths.push(target.path);
                        toolingMap.items[target.path] = {
                            type: 'LightningComponentResource',
                            id: resource.Id,
                            format: resource.Format,
                            filePath: resource.FilePath,
                        };
                    }
                }
            };

            const pullAuraBundles = async members => {
                const { all, members: names } = membersOrAll(members);
                const soql =
                    all || !names.length
                        ? 'SELECT Id, DeveloperName FROM AuraDefinitionBundle ORDER BY DeveloperName'
                        : `SELECT Id, DeveloperName FROM AuraDefinitionBundle WHERE DeveloperName IN (${names.map(name => `'${String(name).replace(/'/g, "\\\\'")}'`).join(',')}) ORDER BY DeveloperName`;
                const bundles = await client.toolingQueryAll(soql);
                for (const bundle of bundles || []) {
                    if (!bundle?.Id || !bundle?.DeveloperName) continue;
                    const bundleName = safeSeg(bundle.DeveloperName);
                    const bundlePath = getWorkspaceUri(
                        vscode,
                        `force-app/main/default/aura/${bundleName}`
                    );
                    await ensureDir(vscode, bundlePath);
                    const defs = await client.toolingQueryAll(
                        `SELECT Id, DefType, Format, Source, LastModifiedDate, SystemModstamp FROM AuraDefinition WHERE AuraDefinitionBundleId='${bundle.Id}' ORDER BY DefType`
                    );
                    const used = new Set();
                    for (const definition of defs || []) {
                        if (!definition?.Id || !definition?.Source) continue;
                        let fileName = safeSeg(
                            auraFilename(bundleName, definition.DefType, definition.Format)
                        );
                        if (used.has(fileName)) {
                            fileName = `${fileName}.${String(definition.Id || '').slice(-6)}`;
                        }
                        used.add(fileName);
                        const target = vscode.Uri.joinPath(bundlePath, fileName);
                        await writeTextFile(vscode, target, definition.Source || '');
                        pulledPaths.push(target.path);
                        toolingMap.items[target.path] = {
                            type: 'AuraDefinition',
                            id: definition.Id,
                            defType: definition.DefType,
                            format: definition.Format,
                        };
                    }
                }
            };

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Retrieving manifest contents…',
                    cancellable: false,
                },
                async () => {
                    if (manifest.has('ApexClass')) {
                        await pullApex('ApexClass', 'classes', 'cls', manifest.get('ApexClass'));
                    }
                    if (manifest.has('ApexTrigger')) {
                        await pullApex(
                            'ApexTrigger',
                            'triggers',
                            'trigger',
                            manifest.get('ApexTrigger')
                        );
                    }
                    if (manifest.has('LightningComponentBundle')) {
                        await pullLwcBundles(manifest.get('LightningComponentBundle'));
                    }
                    if (manifest.has('AuraDefinitionBundle')) {
                        await pullAuraBundles(manifest.get('AuraDefinitionBundle'));
                    }
                }
            );

            await saveToolingMapJson(toolingMap);
            await deployTools.updateSourceTrackingForPaths(pulledPaths);
            await vscode.window.showInformationMessage(
                `Retrieved ${pulledPaths.length} file(s) from manifest.`
            );
            try {
                await vscode.commands.executeCommand('salesforceMetadata.refreshProject');
            } catch {
                // ignore
            }
        });
    });

    register('salesforceMetadata.retrieveMetadataApi', async () => {
        const conn = connectionRuntime.loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.window.showErrorMessage(
                connectionRuntime.getInjectedConnectionRequiredMessage()
            );
            return;
        }
        const uri = await pickPackageXmlUnderWorkspace();
        if (!uri) {
            await vscode.window.showWarningMessage(
                `No package.xml found under ${getWorkspaceRootPath(vscode)}.`
            );
            return;
        }
        const xml = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
        const manifest = parsePackageXml(xml);
        if (!manifest.size) {
            await vscode.window.showErrorMessage('Manifest parse failed or contains no <types>.');
            return;
        }
        const result = await retrieveViaMetadataApi(conn, manifest, {
            title: 'Retrieving via Metadata API…',
        });
        deployTools.invalidateToolingMap();
        try {
            await vscode.commands.executeCommand('salesforceMetadata.refreshProject');
        } catch {
            // ignore
        }
        await vscode.window.showInformationMessage(
            `Retrieved ${result.writtenPaths.length} file(s) via Metadata API.`
        );
    });

    register('salesforceMetadata.retrieveMetadataApiPick', async () => {
        const conn = connectionRuntime.loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.window.showErrorMessage(
                connectionRuntime.getInjectedConnectionRequiredMessage()
            );
            return;
        }

        const types = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Loading Metadata API types…',
                cancellable: false,
            },
            async () =>
                await withMetadataApiClientAuthed(conn, async client => {
                    const doc = await client.describeMetadata(client.apiVersion);
                    return parseDescribeMetadataTypes(doc);
                })
        );
        if (!types?.length) {
            await vscode.window.showErrorMessage(
                'Unable to load Metadata API types (describeMetadata returned none).'
            );
            return;
        }

        const typePick = await vscode.window.showQuickPick(
            types.map(type => ({ label: type })),
            {
                title: 'Retrieve (Metadata API)',
                placeHolder: 'Select a metadata type',
                ignoreFocusOut: true,
            }
        );
        if (!typePick?.label) return;

        let members = [];
        try {
            const listed = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Listing ${typePick.label}…`,
                    cancellable: false,
                },
                async () =>
                    await withMetadataApiClientAuthed(conn, async client => {
                        return await client.listMetadata({
                            queries: [{ type: typePick.label }],
                            asOfVersion: client.apiVersion,
                        });
                    })
            );
            const items = (listed || [])
                .map(row => String(row?.fullName || '').trim())
                .filter(Boolean)
                .slice(0, 300)
                .map(label => ({ label }));
            const picked = await vscode.window.showQuickPick(
                [{ label: '*', description: 'All members' }, ...items],
                {
                    title: `Select ${typePick.label} members`,
                    placeHolder: 'Pick members (or * for all)',
                    canPickMany: true,
                    ignoreFocusOut: true,
                }
            );
            if (!picked?.length) return;
            members = picked.some(item => item.label === '*')
                ? ['*']
                : picked.map(item => item.label).filter(Boolean);
        } catch {
            const raw = await vscode.window.showInputBox({
                title: `Members for ${typePick.label}`,
                prompt: 'Enter * for all, or comma-separated members',
                value: '*',
                ignoreFocusOut: true,
            });
            if (!raw) return;
            const text = String(raw).trim();
            members =
                text === '*'
                    ? ['*']
                    : text
                          .split(',')
                          .map(member => member.trim())
                          .filter(Boolean);
        }

        if (!members.length) return;
        const typesMap = new Map([[typePick.label, new Set(members)]]);
        const result = await retrieveViaMetadataApi(conn, typesMap, {
            title: `Retrieving ${typePick.label} via Metadata API…`,
        });
        deployTools.invalidateToolingMap();
        try {
            await vscode.commands.executeCommand('salesforceMetadata.refreshProject');
        } catch {
            // ignore
        }
        await vscode.window.showInformationMessage(
            `Retrieved ${result.writtenPaths.length} file(s) via Metadata API.`
        );
    });

    register('salesforceMetadata.deployMetadataApi', async () => {
        const conn = connectionRuntime.loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.window.showErrorMessage(
                connectionRuntime.getInjectedConnectionRequiredMessage()
            );
            return;
        }
        const uri = await pickPackageXmlUnderWorkspace();
        if (!uri) {
            await vscode.window.showWarningMessage(
                `No package.xml found under ${getWorkspaceRootPath(vscode)}.`
            );
            return;
        }
        const xml = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
        await deployViaMetadataApi(conn, { packageXmlText: xml, checkOnly: false });
        await vscode.window.showInformationMessage('Deploy succeeded (Metadata API).');
    });

    register('salesforceMetadata.validateDeployMetadataApi', async () => {
        const conn = connectionRuntime.loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.window.showErrorMessage(
                connectionRuntime.getInjectedConnectionRequiredMessage()
            );
            return;
        }
        const uri = await pickPackageXmlUnderWorkspace();
        if (!uri) {
            await vscode.window.showWarningMessage(
                `No package.xml found under ${getWorkspaceRootPath(vscode)}.`
            );
            return;
        }
        const xml = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
        await deployViaMetadataApi(conn, { packageXmlText: xml, checkOnly: true });
        await vscode.window.showInformationMessage('Validation succeeded (Metadata API).');
    });
}

export const __testables = {
    parsePackageXml,
};
