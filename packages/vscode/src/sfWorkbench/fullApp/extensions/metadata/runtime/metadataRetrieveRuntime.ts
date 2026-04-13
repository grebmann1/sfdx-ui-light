/* eslint-disable import/no-unresolved */
import { createMetadataApiClient, unzipRetrieveZip } from 'vscode/metadataApi';

import { createToolingMapStore } from '../core/toolingMapStore';
import { ensureDir, writeBytesFile, writeTextFile } from '../core/workspaceCache';
import {
    auraFilename,
    getSalesforceStateDirUri,
    getWorkspaceDefaultRootUri,
    getWorkspaceUri,
    normalizeLwcResourceRelPath,
    safeSeg,
} from '../core/workspacePaths';

import {
    CUSTOM_OBJECT_CHILD_TYPE_RULES,
    inferMetadataMemberFromRelativePath,
    normalizeMetadataPath,
} from './metadataPathInference';
import {
    buildMetadataMemberKey,
    isToolingMetadataType,
    membersOrAll,
    mergeRetrievedMetadataMembers,
} from './metadataRetrieveRuntimeHelpers';

const METADATA_API_MAP_PATH = '.salesforce/metadata-api-map.json';
const INFERRED_OBJECT_METADATA_TYPES = new Set([
    'CustomObject',
    ...Object.values(CUSTOM_OBJECT_CHILD_TYPE_RULES).map(rule => rule.type),
]);

function escapeSoqlLiteral(value) {
    return String(value || '').replace(/'/g, "\\\\'");
}

function collectMemberPathArtifactsFromWrittenPaths(writtenPaths) {
    const memberPathsByKey = {};
    const additionalMembersByKey = new Map();
    for (const path of Array.isArray(writtenPaths) ? writtenPaths : []) {
        const normalizedPath = normalizeMetadataPath(path);
        const relativeIndex = normalizedPath.indexOf('/force-app/main/default/');
        const relativePath =
            relativeIndex >= 0
                ? normalizedPath.slice(relativeIndex + '/force-app/main/default/'.length)
                : normalizedPath.replace(/^\/+/, '');
        const inferred = inferMetadataMemberFromRelativePath(relativePath);
        if (
            !inferred?.type ||
            !inferred?.fullName ||
            !INFERRED_OBJECT_METADATA_TYPES.has(inferred.type)
        ) {
            continue;
        }
        const key = buildMetadataMemberKey(inferred.type, inferred.fullName);
        if (!memberPathsByKey[key]) {
            memberPathsByKey[key] = [];
        }
        memberPathsByKey[key].push(normalizedPath);
        additionalMembersByKey.set(key, {
            type: inferred.type,
            fullName: inferred.fullName,
        });
    }
    return {
        additionalMembers: Array.from(additionalMembersByKey.values()),
        memberPathsByKey,
    };
}

async function loadMetadataApiMapJson(vscode, state) {
    if (state?.metadataApiMapCache) {
        return state.metadataApiMapCache;
    }
    try {
        const uri = getWorkspaceUri(vscode, METADATA_API_MAP_PATH);
        const bytes = await vscode.workspace.fs.readFile(uri);
        const text = new TextDecoder().decode(bytes || new Uint8Array());
        const parsed = JSON.parse(text || '{}');
        const next =
            parsed && typeof parsed === 'object'
                ? parsed
                : {
                      items: {},
                      members: {},
                  };
        if (!next.items || typeof next.items !== 'object') {
            next.items = {};
        }
        if (!next.members || typeof next.members !== 'object') {
            next.members = {};
        }
        if (state) {
            state.metadataApiMapCache = next;
        }
        return next;
    } catch {
        const next = { items: {}, members: {} };
        if (state) {
            state.metadataApiMapCache = next;
        }
        return next;
    }
}

async function saveMetadataApiMapJson(vscode, state, value) {
    const next =
        value && typeof value === 'object'
            ? {
                  ...value,
                  items: value.items && typeof value.items === 'object' ? { ...value.items } : {},
                  members:
                      value.members && typeof value.members === 'object'
                          ? { ...value.members }
                          : {},
              }
            : { items: {}, members: {} };
    next.generatedAt = new Date().toISOString();
    await writeTextFile(
        vscode,
        getWorkspaceUri(vscode, METADATA_API_MAP_PATH),
        JSON.stringify(next, null, 2),
        { skipCache: true }
    );
    if (state) {
        state.metadataApiMapCache = next;
    }
    return next;
}

export function createMetadataRetrieveRuntime({
    connectionRuntime,
    state,
    vscode,
    updateSourceTrackingForPaths,
}) {
    const toolingMapStore = createToolingMapStore(vscode, state);

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
            if (!connectionRuntime.isAuthError(error)) {
                throw error;
            }
            const refreshedRaw = await connectionRuntime
                .refreshConnectionRecord(effectiveCurrent)
                .catch(() => null);
            const refreshed = await connectionRuntime.applyWorkspaceApiVersion(
                refreshedRaw,
                effectiveCurrent?.apiVersion
            );
            if (!refreshed) {
                throw error;
            }
            const retryContext = connectionRuntime.requireCurrentContext();
            const retryClient = createMetadataApiClient({
                connection: retryContext.connector.conn,
                apiVersion: refreshed.apiVersion,
            });
            return await fn(retryClient, refreshed);
        }
    }

    async function retrieveViaMetadataApi(conn, typesMap, { title }: { title?: string } = {}) {
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
                title: title || 'Retrieving via Metadata API...',
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
                    if (nextStatus.done) {
                        return nextStatus;
                    }
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
        const previousMap = await loadMetadataApiMapJson(vscode, state);
        const nextMap = {
            ...previousMap,
            generatedAt: new Date().toISOString(),
            instanceUrl: (effectiveConn || conn).instanceUrl,
            apiVersion: (effectiveConn || conn).apiVersion,
            items:
                previousMap?.items && typeof previousMap.items === 'object'
                    ? { ...previousMap.items }
                    : {},
            members:
                previousMap?.members && typeof previousMap.members === 'object'
                    ? { ...previousMap.members }
                    : {},
        };
        const root = getWorkspaceDefaultRootUri(vscode);
        const base = root.path;
        await ensureDir(vscode, root);

        for (const [zipPathRaw, bytes] of Object.entries(files || {})) {
            const zipPath = String(zipPathRaw || '');
            if (!zipPath || zipPath.endsWith('/')) {
                continue;
            }
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
            nextMap.items[target.path] = { zipPath };
        }

        const memberPathArtifacts = collectMemberPathArtifactsFromWrittenPaths(writtenPaths);
        nextMap.members = mergeRetrievedMetadataMembers(
            previousMap?.members,
            typesMap,
            writtenPaths,
            {
                additionalMembers: memberPathArtifacts.additionalMembers,
                memberPathsByKey: memberPathArtifacts.memberPathsByKey,
            }
        );
        await saveMetadataApiMapJson(vscode, state, nextMap);

        return { writtenPaths };
    }

    async function retrieveToolingTypes(conn, typesMap, { title }: { title?: string } = {}) {
        const toolingMap = await toolingMapStore.loadJson();
        const pulledPaths = [];

        const ensureDefaultDirs = async () => {
            await ensureDir(vscode, getWorkspaceUri(vscode, 'force-app/main/default/classes'));
            await ensureDir(vscode, getWorkspaceUri(vscode, 'force-app/main/default/triggers'));
            await ensureDir(vscode, getWorkspaceUri(vscode, 'force-app/main/default/lwc'));
            await ensureDir(vscode, getWorkspaceUri(vscode, 'force-app/main/default/aura'));
            await ensureDir(vscode, getSalesforceStateDirUri(vscode));
        };

        const pullApex = async (client, sobject, dir, ext, members) => {
            const { all, members: names } = membersOrAll(members);
            const soql =
                all || !names.length
                    ? `SELECT Id, Name, Body FROM ${sobject} ORDER BY Name`
                    : `SELECT Id, Name, Body FROM ${sobject} WHERE Name IN (${names.map(name => `'${escapeSoqlLiteral(name)}'`).join(',')}) ORDER BY Name`;
            const rows = await client.toolingQueryAll(soql);
            for (const row of rows || []) {
                if (!row?.Id || !row?.Name) {
                    continue;
                }
                const uri = getWorkspaceUri(
                    vscode,
                    `force-app/main/default/${dir}/${safeSeg(row.Name)}.${ext}`
                );
                // eslint-disable-next-line no-await-in-loop
                await writeTextFile(vscode, uri, row.Body || '');
                pulledPaths.push(uri.path);
                toolingMap.items[uri.path] = { type: sobject, id: row.Id };
            }
        };

        const pullLwcBundles = async (client, members) => {
            const { all, members: names } = membersOrAll(members);
            const soql =
                all || !names.length
                    ? 'SELECT Id, DeveloperName FROM LightningComponentBundle ORDER BY DeveloperName'
                    : `SELECT Id, DeveloperName FROM LightningComponentBundle WHERE DeveloperName IN (${names.map(name => `'${escapeSoqlLiteral(name)}'`).join(',')}) ORDER BY DeveloperName`;
            const bundles = await client.toolingQueryAll(soql);
            for (const bundle of bundles || []) {
                if (!bundle?.Id || !bundle?.DeveloperName) {
                    continue;
                }
                const bundleName = safeSeg(bundle.DeveloperName);
                const bundlePath = getWorkspaceUri(
                    vscode,
                    `force-app/main/default/lwc/${bundleName}`
                );
                // eslint-disable-next-line no-await-in-loop
                await ensureDir(vscode, bundlePath);
                // eslint-disable-next-line no-await-in-loop
                const resources = await client.toolingQueryAll(
                    `SELECT Id, FilePath, Format, Source FROM LightningComponentResource WHERE LightningComponentBundleId='${escapeSoqlLiteral(bundle.Id)}' ORDER BY FilePath`
                );
                for (const resource of resources || []) {
                    if (!resource?.Id || !resource?.Source) {
                        continue;
                    }
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
                    // eslint-disable-next-line no-await-in-loop
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

        const pullAuraBundles = async (client, members) => {
            const { all, members: names } = membersOrAll(members);
            const soql =
                all || !names.length
                    ? 'SELECT Id, DeveloperName FROM AuraDefinitionBundle ORDER BY DeveloperName'
                    : `SELECT Id, DeveloperName FROM AuraDefinitionBundle WHERE DeveloperName IN (${names.map(name => `'${escapeSoqlLiteral(name)}'`).join(',')}) ORDER BY DeveloperName`;
            const bundles = await client.toolingQueryAll(soql);
            for (const bundle of bundles || []) {
                if (!bundle?.Id || !bundle?.DeveloperName) {
                    continue;
                }
                const bundleName = safeSeg(bundle.DeveloperName);
                const bundlePath = getWorkspaceUri(
                    vscode,
                    `force-app/main/default/aura/${bundleName}`
                );
                // eslint-disable-next-line no-await-in-loop
                await ensureDir(vscode, bundlePath);
                // eslint-disable-next-line no-await-in-loop
                const defs = await client.toolingQueryAll(
                    `SELECT Id, DefType, Format, Source FROM AuraDefinition WHERE AuraDefinitionBundleId='${escapeSoqlLiteral(bundle.Id)}' ORDER BY DefType`
                );
                const used = new Set();
                for (const definition of defs || []) {
                    if (!definition?.Id || !definition?.Source) {
                        continue;
                    }
                    let fileName = safeSeg(
                        auraFilename(bundleName, definition.DefType, definition.Format)
                    );
                    if (used.has(fileName)) {
                        fileName = `${fileName}.${String(definition.Id || '').slice(-6)}`;
                    }
                    used.add(fileName);
                    const target = vscode.Uri.joinPath(bundlePath, fileName);
                    // eslint-disable-next-line no-await-in-loop
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

        await ensureDefaultDirs();
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: title || 'Retrieving manifest contents...',
                cancellable: false,
            },
            async () =>
                await connectionRuntime.withToolingClientAuthed(conn, async client => {
                    if (typesMap.has('ApexClass')) {
                        await pullApex(
                            client,
                            'ApexClass',
                            'classes',
                            'cls',
                            typesMap.get('ApexClass')
                        );
                    }
                    if (typesMap.has('ApexTrigger')) {
                        await pullApex(
                            client,
                            'ApexTrigger',
                            'triggers',
                            'trigger',
                            typesMap.get('ApexTrigger')
                        );
                    }
                    if (typesMap.has('LightningComponentBundle')) {
                        await pullLwcBundles(client, typesMap.get('LightningComponentBundle'));
                    }
                    if (typesMap.has('AuraDefinitionBundle')) {
                        await pullAuraBundles(client, typesMap.get('AuraDefinitionBundle'));
                    }
                })
        );

        await toolingMapStore.saveJson(toolingMap);
        if (typeof updateSourceTrackingForPaths === 'function' && pulledPaths.length) {
            await updateSourceTrackingForPaths(pulledPaths);
        }
        return { writtenPaths: pulledPaths };
    }

    return {
        loadMetadataApiMapJson: async () => await loadMetadataApiMapJson(vscode, state),
        retrieveToolingTypes,
        retrieveViaMetadataApi,
        saveMetadataApiMapJson: async value => await saveMetadataApiMapJson(vscode, state, value),
        withMetadataApiClientAuthed,
    };
}

export const __testables = {
    buildMetadataMemberKey,
    isToolingMetadataType,
    membersOrAll,
    mergeRetrievedMetadataMembers,
};
