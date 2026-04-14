/* eslint-disable import/no-unresolved */
import {
    hashText,
    loadSourceTracking,
    pickRemoteStamp,
    saveSourceTracking,
} from 'vscode/sourceTracking';

import { createToolingMapStore } from '../core/toolingMapStore';
import { writeTextFile } from '../core/workspaceCache';
import { getWorkspacePath, getWorkspaceUri } from '../core/workspacePaths';

import {
    buildChangedFileDeployQuickPickItems,
    buildCurrentFileWarningMessage,
    buildDeployWorkerConnection,
    classifyDeployPath,
    classifyToolingCommandPath,
    DEPLOYABLE_TOOLING_TYPES,
    partitionChangedPathsForDeploy,
    pruneChangedPathsForSuccessfulDeploys,
} from './deployAndSourceTrackingHelpers';

const AUTO_DEPLOY_KEY = 'sf_ext_autoDeployOnSave';
const METADATA_API_MAP_PATH = '.salesforce/metadata-api-map.json';

type ToolingMapEntry = {
    id?: string;
    namespace?: string;
    readOnly?: boolean;
    type?: string;
};

type ToolingMapItems = Record<string, ToolingMapEntry>;

export function createDeployAndSourceTracking({
    connectionRuntime,
    context,
    isLwcDoc,
    lintLwcDocument,
    commandGroups = ['all'],
}) {
    const { diagnostics, output, state, statusItem, vscode } = context;
    let currentIsLwcDoc = isLwcDoc;
    let currentLintLwcDocument = lintLwcDocument;
    const registeredCommandGroups = new Set();
    const toolingMapStore = createToolingMapStore(vscode, state);
    let metadataApiDeployFn: ((conn: unknown, paths: string[], options?: Record<string, unknown>) => Promise<unknown>) | null = null;

    function loadAutoDeployOnSave() {
        try {
            const raw = localStorage.getItem(AUTO_DEPLOY_KEY);
            if (raw === null) {
                return connectionRuntime.isChromeExtensionEnv();
            }
            return raw === 'true';
        } catch {
            return false;
        }
    }

    function saveAutoDeployOnSave(value) {
        try {
            localStorage.setItem(AUTO_DEPLOY_KEY, value ? 'true' : 'false');
        } catch {
            // ignore
        }
    }

    const autoDeployStatusItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        99
    );
    function setAutoDeployStatus() {
        const enabled = loadAutoDeployOnSave();
        autoDeployStatusItem.text = enabled
            ? '$(cloud-upload) AutoDeploy: On'
            : '$(cloud-upload) AutoDeploy: Off';
        autoDeployStatusItem.tooltip = 'Click to toggle auto deploy on save';
        autoDeployStatusItem.command = 'salesforceMetadata.toggleAutoDeploy';
    }
    setAutoDeployStatus();
    autoDeployStatusItem.show();
    context.addDisposable(autoDeployStatusItem);

    const loadToolingMapItems = (options: { force?: boolean } = {}): Promise<ToolingMapItems> =>
        toolingMapStore.loadItems({ force: Boolean(options?.force) }) as Promise<ToolingMapItems>;
    const invalidateToolingMap = () => toolingMapStore.invalidate();

    async function loadMetadataApiMapItems(options: { force?: boolean } = {}) {
        const force = Boolean(options?.force);
        if (!force && state?.metadataApiMapCache?.items) {
            return state.metadataApiMapCache.items;
        }
        try {
            const uri = getWorkspaceUri(vscode, METADATA_API_MAP_PATH);
            const bytes = await vscode.workspace.fs.readFile(uri);
            const text = new TextDecoder().decode(bytes || new Uint8Array());
            const parsed = JSON.parse(text || '{}');
            const next = parsed && typeof parsed === 'object' ? parsed : { items: {}, members: {} };
            if (!next.items || typeof next.items !== 'object') {
                next.items = {};
            }
            if (!next.members || typeof next.members !== 'object') {
                next.members = {};
            }
            if (state) {
                state.metadataApiMapCache = next;
            }
            return next.items;
        } catch {
            const next = { items: {}, members: {} };
            if (state) {
                state.metadataApiMapCache = next;
            }
            return next.items;
        }
    }

    async function resolveCurrentPath(
        path,
        resolver: (
            path: string,
            toolingMapItems: ToolingMapItems,
            metadataApiItems: Record<string, unknown> | null,
            workspaceRoot: string
        ) => {
            entry?: ToolingMapEntry;
            path: string;
            reason?: string;
            source?: string;
            status: string;
        },
        options: { includeMetadataApi?: boolean } = {}
    ) {
        const includeMetadataApi = Boolean(options?.includeMetadataApi);
        const run = async force => {
            const toolingMapItems = await loadToolingMapItems({ force });
            const metadataApiItems = includeMetadataApi
                ? await loadMetadataApiMapItems({ force })
                : null;
            return resolver(path, toolingMapItems, metadataApiItems, getWorkspacePath(vscode));
        };

        let resolution = await run(false);
        if (resolution?.status === 'missing') {
            resolution = await run(true);
        }
        return resolution;
    }

    async function resolveCurrentToolingPath(path, options: { includeMetadataApi?: boolean } = {}) {
        return await resolveCurrentPath(path, classifyToolingCommandPath, {
            includeMetadataApi: Boolean(options?.includeMetadataApi),
        });
    }

    async function resolveCurrentDeployPath(path) {
        return await resolveCurrentPath(path, classifyDeployPath, { includeMetadataApi: true });
    }

    function ensureDeployWorker() {
        if (state.deployWorker) return state.deployWorker;
        state.deployWorker = new Worker('/libs/extensions/salesforce-deploy/deploy.worker.js', {
            type: 'module',
            name: 'SF Deploy',
        });
        context.addDisposable({
            dispose: () => state.deployWorker?.terminate?.(),
        });
        return state.deployWorker;
    }

    function toDeployItemFromMapEntry(path, entry, text) {
        if (entry?.readOnly) return null;
        const type = entry?.type;
        const id = entry?.id;
        if (!type || !id) return null;
        if (!DEPLOYABLE_TOOLING_TYPES.has(type)) {
            return null;
        }
        const field = type === 'ApexClass' || type === 'ApexTrigger' ? 'Body' : 'Source';
        return { path, sobject: type, id, field, text: String(text ?? '') };
    }

    async function readTextForPath(path) {
        try {
            const open = vscode.workspace?.textDocuments?.find(doc => doc?.uri?.path === path);
            if (open) return open.getText();
        } catch {
            // ignore
        }
        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(path));
        return new TextDecoder().decode(bytes || new Uint8Array());
    }

    async function deployPaths(
        paths,
        options: {
            showProgress?: boolean;
            textOverrides?: Record<string, string>;
            title?: string;
        } = {}
    ) {
        const showProgress = Boolean(options?.showProgress);
        const textOverrides = options?.textOverrides || {};
        const title = options?.title;
        const storedConnection = connectionRuntime.loadStoredConn();
        const liveConnection =
            typeof connectionRuntime.loadLiveConnection === 'function'
                ? connectionRuntime.loadLiveConnection()
                : storedConnection;
        const deployConnection = buildDeployWorkerConnection(liveConnection, storedConnection);
        if (!deployConnection.instanceUrl || !deployConnection.accessToken) {
            await vscode.window.showErrorMessage(
                connectionRuntime.getInjectedConnectionRequiredMessage()
            );
            return null;
        }

        const mapItems = await loadToolingMapItems();
        const items = [];
        let skippedReadOnly = 0;
        for (const path of paths) {
            const entry = mapItems?.[path];
            if (!entry) continue;
            if (entry.readOnly) {
                skippedReadOnly += 1;
                continue;
            }
            const text = Object.prototype.hasOwnProperty.call(textOverrides, path)
                ? textOverrides[path]
                : // eslint-disable-next-line no-await-in-loop
                  await readTextForPath(path);
            const item = toDeployItemFromMapEntry(path, entry, text);
            if (item) items.push(item);
        }

        if (!items.length) {
            if (showProgress) {
                const message = skippedReadOnly
                    ? `No deployable files selected (${skippedReadOnly} read-only namespaced/managed file(s) were skipped).`
                    : 'No deployable files selected (missing tooling-map entry). Fetch metadata first.';
                await vscode.window.showWarningMessage(message);
            }
            return { failures: [], results: [], skippedReadOnly };
        }

        const worker = ensureDeployWorker();
        const requestId = `deploy_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const results = [];
        const run = () =>
            new Promise<void>(resolve => {
                const onMessage = event => {
                    const message = event?.data;
                    if (!message || message.requestId !== requestId) return;
                    if (message.type === 'result') results.push(message);
                    if (message.type === 'done') {
                        try {
                            worker.removeEventListener('message', onMessage);
                        } catch {
                            // ignore
                        }
                        resolve();
                    }
                };
                worker.addEventListener('message', onMessage);
                worker.postMessage({
                    type: 'deploy',
                    requestId,
                    connection: deployConnection,
                    items,
                });
            });

        if (showProgress) {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: title || 'Deploying to Salesforce...',
                    cancellable: true,
                },
                async (progress, token) => {
                    try {
                        token?.onCancellationRequested?.(() => {
                            try {
                                worker.postMessage({ type: 'cancel', requestId });
                            } catch {
                                // ignore
                            }
                        });
                    } catch {
                        // ignore
                    }

                    let lastPercent = 0;
                    const onMessage = event => {
                        const message = event?.data;
                        if (!message || message.requestId !== requestId) return;
                        if (message.type === 'progress') {
                            const total = message.total || 0;
                            const done = message.done || 0;
                            const percent = total
                                ? Math.max(0, Math.min(100, Math.round((done / total) * 100)))
                                : 0;
                            progress.report({
                                message: message.currentPath
                                    ? `Deploying ${message.currentPath}`
                                    : undefined,
                                increment: Math.max(0, percent - lastPercent),
                            });
                            lastPercent = percent;
                        }
                    };
                    worker.addEventListener('message', onMessage);
                    try {
                        await run();
                    } finally {
                        try {
                            worker.removeEventListener('message', onMessage);
                        } catch {
                            // ignore
                        }
                    }
                }
            );
        } else {
            await run();
        }

        const failures = results.filter(result => result && result.ok === false);
        try {
            const successes = results.filter(result => result && result.ok === true);
            context.logLines([
                '',
                `=== Deploy (${new Date().toLocaleString()}) ===`,
                `Target: ${deployConnection.instanceUrl}`,
                `Items: ${results.length} • Success: ${successes.length} • Failed: ${failures.length}`,
                '',
                'Success:',
                ...successes.map(result => `  OK   ${result.path}`),
                ...(failures.length
                    ? [
                          '',
                          'Failures:',
                          ...failures.map(
                              result => `  FAIL ${result.path} • ${result.error || 'Unknown error'}`
                          ),
                      ]
                    : []),
            ]);
        } catch {
            // ignore
        }

        try {
            if (diagnostics.deploy) {
                for (const result of results) {
                    if (!result?.path) continue;
                    const uri = vscode.Uri.file(result.path);
                    if (result.ok) {
                        diagnostics.deploy.delete(uri);
                    } else {
                        const diagnostic = new vscode.Diagnostic(
                            new vscode.Range(0, 0, 0, 1),
                            result.error || 'Deploy failed',
                            vscode.DiagnosticSeverity.Error
                        );
                        diagnostic.source = 'salesforce deploy';
                        diagnostics.deploy.set(uri, [diagnostic]);
                    }
                }
            }
        } catch {
            // ignore
        }

        if (failures.length) {
            const first = failures[0];
            const message = `Deploy failed for ${first.path}: ${first.error || 'Unknown error'}`;
            if (output) {
                const action = await vscode.window.showErrorMessage(message, 'Open Output');
                if (action === 'Open Output') {
                    try {
                        output.show(true);
                    } catch {
                        // ignore
                    }
                }
            } else {
                await vscode.window.showErrorMessage(message);
            }
        } else if (showProgress) {
            await vscode.window.showInformationMessage('Deploy complete.');
        }

        const successPaths = pruneChangedPathsForSuccessfulDeploys(changedPaths, results);
        if (successPaths.length) {
            try {
                await updateSourceTrackingForPaths(successPaths);
            } catch {
                // ignore
            }
        }

        return { failures, results, skippedReadOnly };
    }

    async function fetchPathFromSalesforce(
        path,
        options: {
            lookupPath?: string;
            mirrorPath?: string;
            showProgress?: boolean;
        } = {}
    ) {
        const lookupPath = options?.lookupPath || path;
        const mirrorPath =
            options?.mirrorPath && options.mirrorPath !== path ? options.mirrorPath : '';
        const showProgress = Boolean(options?.showProgress);
        const conn = connectionRuntime.loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.window.showErrorMessage(
                connectionRuntime.getInjectedConnectionRequiredMessage()
            );
            return;
        }

        const mapItems = await loadToolingMapItems();
        const entry = mapItems?.[lookupPath];
        if (!entry?.type || !entry?.id) {
            await vscode.window.showWarningMessage(
                'This file is not in tooling-map.json. Fetch metadata first.'
            );
            return;
        }

        const run = async () => {
            const text = await connectionRuntime.withToolingClientAuthed(conn, async client => {
                const id = String(entry.id);
                if (entry.type === 'ApexClass') {
                    const rows = await client.toolingQueryAll(
                        `SELECT Id, Body FROM ApexClass WHERE Id='${id}'`
                    );
                    return rows?.[0]?.Body ?? null;
                }
                if (entry.type === 'ApexTrigger') {
                    const rows = await client.toolingQueryAll(
                        `SELECT Id, Body FROM ApexTrigger WHERE Id='${id}'`
                    );
                    return rows?.[0]?.Body ?? null;
                }
                if (entry.type === 'LightningComponentResource') {
                    const rows = await client.toolingQueryAll(
                        `SELECT Id, Source FROM LightningComponentResource WHERE Id='${id}'`
                    );
                    return rows?.[0]?.Source ?? null;
                }
                if (entry.type === 'AuraDefinition') {
                    const rows = await client.toolingQueryAll(
                        `SELECT Id, Source FROM AuraDefinition WHERE Id='${id}'`
                    );
                    return rows?.[0]?.Source ?? null;
                }
                return null;
            });
            if (text == null) {
                await vscode.window.showWarningMessage(
                    `Salesforce returned no source for ${entry.type}/${entry.id}.`
                );
                return;
            }
            await writeTextFile(vscode, vscode.Uri.file(path), text);
            if (mirrorPath) {
                await writeTextFile(vscode, vscode.Uri.file(mirrorPath), text);
            }
            try {
                diagnostics.deploy?.delete?.(vscode.Uri.file(path));
                if (mirrorPath) {
                    diagnostics.deploy?.delete?.(vscode.Uri.file(mirrorPath));
                }
            } catch {
                // ignore
            }
        };

        if (showProgress) {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Fetching file from Salesforce...',
                    cancellable: false,
                },
                run
            );
        } else {
            await run();
        }

        await vscode.window.showInformationMessage('File refreshed from Salesforce.');
    }

    async function fetchRemoteTextForEntry(client, entry) {
        const id = String(entry?.id || '');
        if (!id) return null;
        if (entry.type === 'ApexClass') {
            const rows = await client.toolingQueryAll(
                `SELECT Id, Body FROM ApexClass WHERE Id='${id}'`
            );
            return rows?.[0]?.Body ?? null;
        }
        if (entry.type === 'ApexTrigger') {
            const rows = await client.toolingQueryAll(
                `SELECT Id, Body FROM ApexTrigger WHERE Id='${id}'`
            );
            return rows?.[0]?.Body ?? null;
        }
        if (entry.type === 'LightningComponentResource') {
            const rows = await client.toolingQueryAll(
                `SELECT Id, Source FROM LightningComponentResource WHERE Id='${id}'`
            );
            return rows?.[0]?.Source ?? null;
        }
        if (entry.type === 'AuraDefinition') {
            const rows = await client.toolingQueryAll(
                `SELECT Id, Source FROM AuraDefinition WHERE Id='${id}'`
            );
            return rows?.[0]?.Source ?? null;
        }
        return null;
    }

    const changedPaths = new Set<string>();
    const deployInFlight = new Set<string>();
    const deployPending = new Map<string, { uri?: { path?: string } }>();
    let deployTimer = null;
    let autoDeployUiLock = false;

    function setAutoDeployBusyState(isBusy, options: { pendingCount?: number } = {}) {
        const pendingCount = Number(options?.pendingCount || 0);
        if (!loadAutoDeployOnSave()) return;
        try {
            if (isBusy) {
                autoDeployUiLock = true;
                autoDeployStatusItem.text = `$(sync~spin) AutoDeploy: Deploying${
                    pendingCount ? ` (${pendingCount} pending)` : ''
                }`;
                autoDeployStatusItem.tooltip = 'Auto deploy is running in the background';
                return;
            }
        } catch {
            // ignore
        } finally {
            if (!isBusy) {
                autoDeployUiLock = false;
                setAutoDeployStatus();
            }
        }
    }

    async function flushAutoDeployQueue() {
        const docs = Array.from(deployPending.values());
        deployPending.clear();
        if (!docs.length) return;

        const paths = [];
        for (const doc of docs) {
            const path = doc?.uri?.path;
            if (!path) continue;
            if (deployInFlight.has(path)) {
                deployPending.set(path, doc);
                continue;
            }
            deployInFlight.add(path);
            paths.push(path);
        }

        if (!paths.length) return;
        try {
            setAutoDeployBusyState(true, { pendingCount: deployPending.size });
            const summary = await deployPaths(paths, { showProgress: false });
            const failures = summary?.failures || [];
            if (failures.length) {
                const first = failures[0];
                const message = first?.error || 'Deploy failed';
                try {
                    if (output) {
                        const action = await vscode.window.showErrorMessage(
                            `Auto deploy failed: ${message}`,
                            'Open Output'
                        );
                        if (action === 'Open Output') {
                            try {
                                output.show(true);
                            } catch {
                                // ignore
                            }
                        }
                    } else {
                        await vscode.window.showErrorMessage(`Auto deploy failed: ${message}`);
                    }
                } catch {
                    // ignore
                }
            }
        } finally {
            for (const path of paths) deployInFlight.delete(path);
            setAutoDeployBusyState(false);
            if (deployPending.size && !deployTimer) {
                deployTimer = setTimeout(() => {
                    deployTimer = null;
                    void flushAutoDeployQueue();
                }, 350);
            }
        }
    }

    function enqueueAutoDeploy(doc) {
        const path = doc?.uri?.path;
        if (!path) return;
        deployPending.set(path, doc);
        if (deployTimer) clearTimeout(deployTimer);
        if (!autoDeployUiLock && loadAutoDeployOnSave()) {
            try {
                autoDeployStatusItem.text = `$(cloud-upload) AutoDeploy: On${
                    deployPending.size ? ` (${deployPending.size})` : ''
                }`;
                autoDeployStatusItem.tooltip = 'Click to toggle auto deploy on save';
            } catch {
                // ignore
            }
        }
        deployTimer = setTimeout(() => {
            deployTimer = null;
            void flushAutoDeployQueue();
        }, 350);
    }

    async function queryRemoteStampsByType(client, sobject, ids) {
        const list = Array.from(ids || []).filter(Boolean);
        const outputMap = new Map();
        const chunkSize = 100;

        const tryQuery = async soql => {
            const rows = await client.toolingQueryAll(soql);
            for (const row of rows || []) {
                if (!row?.Id) continue;
                const stamp = pickRemoteStamp(row);
                if (stamp) outputMap.set(String(row.Id), stamp);
            }
        };

        for (let index = 0; index < list.length; index += chunkSize) {
            const chunk = list.slice(index, index + chunkSize);
            const inList = chunk
                .map(value => `'${String(value).replace(/'/g, "\\\\'")}'`)
                .join(',');
            try {
                // eslint-disable-next-line no-await-in-loop
                await tryQuery(
                    `SELECT Id, LastModifiedDate, SystemModstamp FROM ${sobject} WHERE Id IN (${inList})`
                );
            } catch {
                try {
                    // eslint-disable-next-line no-await-in-loop
                    await tryQuery(
                        `SELECT Id, LastModifiedDate FROM ${sobject} WHERE Id IN (${inList})`
                    );
                } catch {
                    // ignore
                }
            }
        }
        return outputMap;
    }

    function toMs(stamp) {
        if (!stamp) return null;
        const value = Date.parse(String(stamp));
        return Number.isFinite(value) ? value : null;
    }

    async function computeRemoteChangeStatus() {
        const conn = connectionRuntime.loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.window.showErrorMessage(
                connectionRuntime.getInjectedConnectionRequiredMessage()
            );
            return {
                remoteChangedPaths: [],
                localChangedPaths: [],
                conflictPaths: [],
                note: 'Not connected.',
            };
        }

        const mapItems = await loadToolingMapItems();
        const paths = Object.keys(mapItems || {});
        const localChangedPaths = Array.from(changedPaths).filter(path =>
            Boolean(mapItems?.[path])
        );
        const tracking = await loadSourceTracking(vscode);
        const trackingInstanceUrl = tracking?.instanceUrl ? String(tracking.instanceUrl) : '';
        if (!tracking?.items || trackingInstanceUrl !== conn.instanceUrl) {
            return {
                remoteChangedPaths: [],
                localChangedPaths,
                conflictPaths: [],
                note: 'No source-tracking snapshot for this org. Run Sync Project first.',
            };
        }

        const idsByType = {
            ApexClass: new Set(),
            ApexTrigger: new Set(),
            LightningComponentResource: new Set(),
            AuraDefinition: new Set(),
        };
        for (const path of paths) {
            const entry = mapItems?.[path];
            if (!entry?.type || !entry?.id) continue;
            if (idsByType[entry.type]) idsByType[entry.type].add(entry.id);
        }

        return await connectionRuntime.withToolingClientAuthed(conn, async client => {
            const [classStamps, triggerStamps, lwcStamps, auraStamps] = await Promise.all([
                queryRemoteStampsByType(client, 'ApexClass', idsByType.ApexClass),
                queryRemoteStampsByType(client, 'ApexTrigger', idsByType.ApexTrigger),
                queryRemoteStampsByType(
                    client,
                    'LightningComponentResource',
                    idsByType.LightningComponentResource
                ),
                queryRemoteStampsByType(client, 'AuraDefinition', idsByType.AuraDefinition),
            ]);

            const getRemoteStamp = (type, id) => {
                const key = String(id || '');
                if (!key) return null;
                if (type === 'ApexClass') return classStamps.get(key) || null;
                if (type === 'ApexTrigger') return triggerStamps.get(key) || null;
                if (type === 'LightningComponentResource') return lwcStamps.get(key) || null;
                if (type === 'AuraDefinition') return auraStamps.get(key) || null;
                return null;
            };

            const remoteChangedPaths = [];
            for (const path of paths) {
                const entry = mapItems?.[path];
                if (!entry?.type || !entry?.id) continue;
                const remoteStamp = getRemoteStamp(entry.type, entry.id);
                const previousStamp = tracking?.items?.[path]?.remoteStamp || null;
                if (!remoteStamp || !previousStamp) continue;
                const remoteMs = toMs(remoteStamp);
                const previousMs = toMs(previousStamp);
                if (remoteMs != null && previousMs != null) {
                    if (remoteMs > previousMs) remoteChangedPaths.push(path);
                } else if (String(remoteStamp) !== String(previousStamp)) {
                    remoteChangedPaths.push(path);
                }
            }

            const localSet = new Set(localChangedPaths);
            return {
                conflictPaths: remoteChangedPaths.filter(path => localSet.has(path)),
                localChangedPaths,
                note: null,
                remoteChangedPaths,
            };
        });
    }

    async function updateSourceTrackingForPaths(paths) {
        const conn = connectionRuntime.loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) return;
        const mapItems = await loadToolingMapItems();
        const tracking = (await loadSourceTracking(vscode)) || {};
        if (!tracking.items || typeof tracking.items !== 'object') tracking.items = {};
        tracking.instanceUrl = conn.instanceUrl;
        tracking.apiVersion = conn.apiVersion;
        tracking.generatedAt = new Date().toISOString();

        const idsByType = {
            ApexClass: new Set(),
            ApexTrigger: new Set(),
            LightningComponentResource: new Set(),
            AuraDefinition: new Set(),
        };
        for (const path of paths || []) {
            const entry = mapItems?.[path];
            if (!entry?.type || !entry?.id) continue;
            if (idsByType[entry.type]) idsByType[entry.type].add(entry.id);
        }

        const stampsByType = await connectionRuntime.withToolingClientAuthed(
            conn,
            async client => ({
                ApexClass: await queryRemoteStampsByType(client, 'ApexClass', idsByType.ApexClass),
                ApexTrigger: await queryRemoteStampsByType(
                    client,
                    'ApexTrigger',
                    idsByType.ApexTrigger
                ),
                LightningComponentResource: await queryRemoteStampsByType(
                    client,
                    'LightningComponentResource',
                    idsByType.LightningComponentResource
                ),
                AuraDefinition: await queryRemoteStampsByType(
                    client,
                    'AuraDefinition',
                    idsByType.AuraDefinition
                ),
            })
        );

        for (const path of paths || []) {
            const entry = mapItems?.[path];
            if (!entry?.type || !entry?.id) continue;
            // eslint-disable-next-line no-await-in-loop
            const text = await readTextForPath(path);
            const stamp = stampsByType[entry.type]?.get(String(entry.id)) || null;
            tracking.items[path] = {
                type: entry.type,
                id: entry.id,
                ...(entry.namespace ? { namespace: entry.namespace } : {}),
                ...(entry.readOnly ? { readOnly: true } : {}),
                remoteStamp: stamp,
                hash: hashText(text ?? ''),
            };
        }

        try {
            await saveSourceTracking(vscode, tracking);
        } catch {
            // ignore
        }
    }

    async function restoreLocalChangedPaths() {
        const tracking = await loadSourceTracking(vscode);
        if (!tracking?.items) return;
        const conn = connectionRuntime.loadStoredConn();
        if (tracking.instanceUrl && tracking.instanceUrl !== conn?.instanceUrl) return;
        for (const [path, entry] of Object.entries(
            tracking.items as Record<string, { hash?: string }>
        )) {
            if (!entry?.hash) continue;
            try {
                // eslint-disable-next-line no-await-in-loop
                const text = await readTextForPath(path);
                if (hashText(text ?? '') !== entry.hash) changedPaths.add(path);
            } catch {
                // file may not exist yet
            }
        }
    }

    async function registerEditorLifecycle() {
        void restoreLocalChangedPaths();

        if (vscode.workspace?.onDidSaveTextDocument) {
            context.addDisposable(
                vscode.workspace.onDidSaveTextDocument(async doc => {
                    try {
                        await currentLintLwcDocument?.(doc);
                    } catch (error) {
                        // eslint-disable-next-line no-console
                        console.warn('LWC lint failed:', error);
                    }
                    try {
                        if (!loadAutoDeployOnSave()) return;
                        const conn = connectionRuntime.loadStoredConn();
                        if (!conn.instanceUrl || !conn.accessToken) return;
                        const path = doc?.uri?.path;
                        if (!path) return;
                        const toolingMapItems = await loadToolingMapItems();
                        if (toolingMapItems?.[path]) {
                            enqueueAutoDeploy(doc);
                            return;
                        }
                        if (typeof metadataApiDeployFn === 'function') {
                            const metaApiItems = await loadMetadataApiMapItems();
                            if (metaApiItems?.[path]) {
                                void (async () => {
                                    try {
                                        await metadataApiDeployFn(conn, [path], {
                                            showProgress: false,
                                        });
                                    } catch (error) {
                                        try {
                                            await vscode.window.showErrorMessage(
                                                `Auto deploy failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                                            );
                                        } catch {
                                            // ignore
                                        }
                                    }
                                })();
                            }
                        }
                    } catch {
                        // ignore
                    }
                })
            );
        }

        if (vscode.workspace?.onDidCloseTextDocument && (diagnostics.lwc || diagnostics.deploy)) {
            context.addDisposable(
                vscode.workspace.onDidCloseTextDocument(doc => {
                    try {
                        if (currentIsLwcDoc?.(doc)) {
                            diagnostics.lwc?.delete(doc.uri);
                        }
                    } catch {
                        // ignore
                    }
                    try {
                        diagnostics.deploy?.delete?.(doc?.uri);
                    } catch {
                        // ignore
                    }
                })
            );
        }

        if (vscode.workspace?.onDidChangeTextDocument) {
            context.addDisposable(
                vscode.workspace.onDidChangeTextDocument(event => {
                    try {
                        const path = event?.document?.uri?.path;
                        if (path) changedPaths.add(path);
                    } catch {
                        // ignore
                    }
                })
            );
        }
    }

    function register(command, handler) {
        return context.addDisposable(vscode.commands.registerCommand(command, handler));
    }

    function registerCommandGroups(nextGroups = ['all']) {
        const groupSet = new Set(
            Array.isArray(nextGroups) && nextGroups.length ? nextGroups : ['all']
        );
        const hasRequestedGroup = group => groupSet.has('all') || groupSet.has(group);

        if (hasRequestedGroup('lwc') && !registeredCommandGroups.has('lwc')) {
            registeredCommandGroups.add('lwc');
            register('salesforceMetadata.lintCurrentFile', async () => {
                const doc = vscode.window?.activeTextEditor?.document;
                if (!doc) return;
                await currentLintLwcDocument?.(doc);
            });

            register('salesforceMetadata.deployCurrentFile', async (resourceUri?) => {
                // Support invocation from editor/context and explorer/context (resourceUri arg)
                const path =
                    resourceUri?.path ||
                    vscode.window?.activeTextEditor?.document?.uri?.path;
                if (!path) return;
                const resolution = await resolveCurrentDeployPath(path);

                if (resolution?.status === 'deployable') {
                    const doc = vscode.window?.activeTextEditor?.document;
                    await deployPaths([resolution.path], {
                        showProgress: true,
                        textOverrides: { [resolution.path]: doc?.getText?.() ?? '' },
                        title: 'Deploying current file...',
                    });
                    return;
                }

                if (
                    resolution?.status === 'unsupported' &&
                    resolution?.reason === 'metadataApi' &&
                    typeof metadataApiDeployFn === 'function'
                ) {
                    const conn = connectionRuntime.loadStoredConn();
                    if (!conn.instanceUrl || !conn.accessToken) {
                        await vscode.window.showErrorMessage(
                            connectionRuntime.getInjectedConnectionRequiredMessage()
                        );
                        return;
                    }
                    try {
                        await metadataApiDeployFn(conn, [path], {
                            showProgress: true,
                            title: 'Deploying current file (Metadata API)...',
                        });
                        await vscode.window.showInformationMessage('Deploy succeeded.');
                    } catch (error) {
                        await vscode.window.showErrorMessage(
                            error instanceof Error
                                ? error.message
                                : 'Deploy failed (Metadata API).'
                        );
                    }
                    return;
                }

                await vscode.window.showWarningMessage(
                    buildCurrentFileWarningMessage(resolution, 'Deploy current file')
                );
            });

            register('salesforceMetadata.fetchCurrentFile', async () => {
                const path = vscode.window?.activeTextEditor?.document?.uri?.path;
                if (!path) return;
                const resolution = await resolveCurrentToolingPath(path, {
                    includeMetadataApi: true,
                });
                if (
                    resolution?.status !== 'tooling' ||
                    !resolution?.entry?.type ||
                    !resolution?.entry?.id
                ) {
                    await vscode.window.showWarningMessage(
                        buildCurrentFileWarningMessage(resolution, 'Fetch current file')
                    );
                    return;
                }
                await fetchPathFromSalesforce(path, {
                    lookupPath: resolution.path,
                    mirrorPath: resolution.path !== path ? resolution.path : undefined,
                    showProgress: true,
                });
            });

            register('salesforceMetadata.diffCurrentFile', async () => {
                const doc = vscode.window?.activeTextEditor?.document;
                const path = doc?.uri?.path;
                if (!path) return;
                const conn = connectionRuntime.loadStoredConn();
                if (!conn.instanceUrl || !conn.accessToken) {
                    await vscode.window.showErrorMessage(
                        connectionRuntime.getInjectedConnectionRequiredMessage()
                    );
                    return;
                }
                const resolution = await resolveCurrentToolingPath(path, {
                    includeMetadataApi: true,
                });
                const entry = resolution?.entry;
                if (resolution?.status !== 'tooling' || !entry?.type || !entry?.id) {
                    await vscode.window.showWarningMessage(
                        buildCurrentFileWarningMessage(resolution, 'Diff current file')
                    );
                    return;
                }
                const remoteText = await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Fetching remote source…',
                        cancellable: false,
                    },
                    async () =>
                        await connectionRuntime.withToolingClientAuthed(
                            conn,
                            async client => await fetchRemoteTextForEntry(client, entry)
                        )
                );
                if (remoteText == null) {
                    await vscode.window.showWarningMessage(
                        'Salesforce returned no source for this file.'
                    );
                    return;
                }
                const remoteUri = getWorkspaceUri(vscode, `.salesforce/.diff${resolution.path}`);
                await writeTextFile(vscode, remoteUri, remoteText, { skipCache: true });
                try {
                    const title = `Diff: ${resolution.path.split('/').pop() || resolution.path} (local ↔ org)`;
                    await vscode.commands.executeCommand('vscode.diff', remoteUri, doc.uri, title);
                    return;
                } catch {
                    // ignore
                }
                try {
                    const commands = await vscode.commands.getCommands(true);
                    const candidate = [
                        'workbench.action.compareEditorWith',
                        'workbench.action.compareEditorWithPrevious',
                        'workbench.action.compareWithClipboard',
                    ].find(command => commands.includes(command));
                    if (candidate) {
                        const remoteDoc = await vscode.workspace.openTextDocument(remoteUri);
                        await vscode.window.showTextDocument(remoteDoc, { preview: true });
                        await vscode.window.showTextDocument(doc, { preview: true });
                        await vscode.commands.executeCommand(candidate);
                        return;
                    }
                } catch {
                    // ignore
                }
                try {
                    const remoteDoc = await vscode.workspace.openTextDocument(remoteUri);
                    await vscode.window.showTextDocument(remoteDoc, { preview: true });
                } catch {
                    await vscode.window.showInformationMessage(
                        `Remote source written under ${getWorkspacePath(
                            vscode,
                            '.salesforce/.diff'
                        )} (diff command unavailable).`
                    );
                }
            });

            register('salesforceMetadata.deployChangedFiles', async () => {
                const trackedPaths = Array.from(changedPaths);
                if (!trackedPaths.length) {
                    await vscode.window.showInformationMessage(
                        'No changed files are currently tracked for deployment.'
                    );
                    return;
                }

                const toolingMapItems = await loadToolingMapItems();
                const metadataApiMapItems = await loadMetadataApiMapItems();
                const {
                    deployablePaths,
                    metadataApiPaths,
                    missingPaths,
                    readOnlyPaths,
                    unsupportedPaths,
                } = partitionChangedPathsForDeploy(
                    trackedPaths,
                    toolingMapItems,
                    metadataApiMapItems
                );

                if (!deployablePaths.length && !metadataApiPaths.length) {
                    const skippedCount =
                        missingPaths.length + readOnlyPaths.length + unsupportedPaths.length;
                    await vscode.window.showWarningMessage(
                        skippedCount
                            ? `No deployable tracked files found (${readOnlyPaths.length} read-only, ${unsupportedPaths.length} unsupported, ${missingPaths.length} missing map entries).`
                            : 'No deployable tracked files found.'
                    );
                    return;
                }

                const toolingItems = buildChangedFileDeployQuickPickItems(
                    deployablePaths,
                    toolingMapItems
                );
                const metaApiItems = metadataApiPaths.map(path => {
                    const segments = String(path || '')
                        .split('/')
                        .filter(Boolean);
                    const label = segments[segments.length - 1] || path;
                    return {
                        label,
                        description: path,
                        detail: `Metadata API • /${segments.slice(0, -1).join('/')}`,
                        picked: true,
                        path,
                        _isMetadataApi: true,
                    };
                });

                const selected = await vscode.window.showQuickPick(
                    [...toolingItems, ...metaApiItems],
                    {
                        title: 'Review changed files to deploy',
                        placeHolder: 'Select the tracked files to deploy',
                        canPickMany: true,
                        ignoreFocusOut: true,
                        matchOnDescription: true,
                        matchOnDetail: true,
                    }
                );
                if (!selected) {
                    return;
                }

                const selectedToolingPaths = selected
                    .filter(item => !item._isMetadataApi)
                    .map(item => item.path)
                    .filter(Boolean);
                const selectedMetaApiPaths = selected
                    .filter(item => item._isMetadataApi)
                    .map(item => item.path)
                    .filter(Boolean);

                if (!selectedToolingPaths.length && !selectedMetaApiPaths.length) {
                    await vscode.window.showInformationMessage('Nothing selected to deploy.');
                    return;
                }

                if (selectedToolingPaths.length) {
                    await deployPaths(selectedToolingPaths, {
                        showProgress: true,
                        title: 'Deploying changed files...',
                    });
                }

                if (selectedMetaApiPaths.length) {
                    if (typeof metadataApiDeployFn !== 'function') {
                        await vscode.window.showWarningMessage(
                            'Metadata API deploy is not yet available. Try again after the workspace fully loads.'
                        );
                        return;
                    }
                    const conn = connectionRuntime.loadStoredConn();
                    if (!conn.instanceUrl || !conn.accessToken) {
                        await vscode.window.showErrorMessage(
                            connectionRuntime.getInjectedConnectionRequiredMessage()
                        );
                        return;
                    }
                    try {
                        await metadataApiDeployFn(conn, selectedMetaApiPaths, {
                            showProgress: true,
                            title: 'Deploying changed files (Metadata API)...',
                        });
                        await vscode.window.showInformationMessage(
                            'Metadata API deploy succeeded.'
                        );
                    } catch (error) {
                        await vscode.window.showErrorMessage(
                            error instanceof Error
                                ? error.message
                                : 'Metadata API deploy failed.'
                        );
                    }
                }
            });

            register('salesforceMetadata.toggleAutoDeploy', async () => {
                const next = !loadAutoDeployOnSave();
                saveAutoDeployOnSave(next);
                setAutoDeployStatus();
                await vscode.window.showInformationMessage(
                    `Auto deploy on save: ${next ? 'ON' : 'OFF'}.`
                );
            });

            void registerEditorLifecycle();
        }

        if (hasRequestedGroup('metadata') && !registeredCommandGroups.has('metadata')) {
            registeredCommandGroups.add('metadata');
            register('salesforceMetadata.sourceStatus', async () => {
                const status = await computeRemoteChangeStatus();
                const local = status.localChangedPaths?.length || 0;
                const remote = status.remoteChangedPaths?.length || 0;
                const conflicts = status.conflictPaths?.length || 0;
                const message = `Local changes: ${local} • Remote changes: ${remote} • Conflicts: ${conflicts}`;
                try {
                    statusItem.tooltip = status.note ? `${message}\n\n${status.note}` : message;
                } catch {
                    // ignore
                }
                if (status.note) {
                    await vscode.window.showWarningMessage(`${message}\n\n${status.note}`);
                } else {
                    await vscode.window.showInformationMessage(message);
                }
            });

            register('salesforceMetadata.pullRemoteChanges', async () => {
                const status = await computeRemoteChangeStatus();
                if (status.note && !status.remoteChangedPaths?.length) {
                    await vscode.window.showWarningMessage(status.note);
                    return;
                }
                const remoteChanged = status.remoteChangedPaths || [];
                if (!remoteChanged.length) {
                    await vscode.window.showInformationMessage('No remote changes found.');
                    return;
                }
                const conflicts = status.conflictPaths || [];
                const conflictSet = new Set(conflicts);
                const nonConflicting = remoteChanged.filter(path => !conflictSet.has(path));
                let toPull = [...nonConflicting];
                if (conflicts.length) {
                    const action = await vscode.window.showQuickPick(
                        [
                            {
                                label: 'Pull non-conflicting changes',
                                detail: `Pull ${nonConflicting.length} file(s) and skip ${conflicts.length} conflict(s).`,
                                id: 'nonconflict',
                            },
                            {
                                label: 'Review conflicts…',
                                detail: 'Choose which conflicting files to overwrite locally.',
                                id: 'review',
                            },
                            { label: 'Cancel', detail: '', id: 'cancel' },
                        ],
                        {
                            title: 'Remote changes detected',
                            placeHolder: 'Choose how to handle conflicts',
                            ignoreFocusOut: true,
                        }
                    );
                    if (!action || action.id === 'cancel') return;
                    if (action.id === 'review') {
                        const picks = conflicts.map(path => ({
                            label: path.split('/').pop() || path,
                            description: path,
                            picked: true,
                            path,
                        }));
                        const selected = await vscode.window.showQuickPick(picks, {
                            title: 'Conflicts: select files to pull (overwrite local)',
                            placeHolder: 'Choose conflicting files',
                            canPickMany: true,
                            ignoreFocusOut: true,
                            matchOnDescription: true,
                        });
                        if (!selected) return;
                        toPull = [
                            ...nonConflicting,
                            ...selected.map(item => item.path).filter(Boolean),
                        ];
                    }
                }
                if (!toPull.length) {
                    await vscode.window.showInformationMessage('Nothing selected to pull.');
                    return;
                }
                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Pulling remote changes...',
                        cancellable: true,
                    },
                    async (progress, token) => {
                        const total = toPull.length;
                        let done = 0;
                        for (const path of toPull) {
                            if (token?.isCancellationRequested) break;
                            progress.report({
                                message: path,
                                increment: total ? 100 / total : 0,
                            });
                            // eslint-disable-next-line no-await-in-loop
                            await fetchPathFromSalesforce(path, { showProgress: false });
                            done += 1;
                        }
                        progress.report({ message: `Pulled ${done}/${total}` });
                    }
                );
                await updateSourceTrackingForPaths(toPull);
                try {
                    context.logLines([
                        '',
                        `=== Pull (${new Date().toLocaleString()}) ===`,
                        `Items: ${toPull.length}`,
                        ...toPull.map(path => `  PULL ${path}`),
                    ]);
                } catch {
                    // ignore
                }
                await vscode.window.showInformationMessage(
                    `Pulled ${toPull.length} file(s) from Salesforce.`
                );
            });

            register('salesforceMetadata.orgBrowser', async () => {
                try {
                    await vscode.commands.executeCommand('salesforceOrgBrowser.openView');
                } catch {
                    await vscode.window.showInformationMessage(
                        'The Org Browser is unavailable right now. Try reopening the workbench.'
                    );
                }
            });

            register('salesforceMetadata.refreshProject', async () => {
                const candidates = [
                    'workbench.files.action.refreshFilesExplorer',
                    'workbench.action.files.refreshExplorer',
                    'workbench.action.refreshExplorerView',
                    'workbench.explorer.fileView.refresh',
                ];
                const commands = await vscode.commands.getCommands(true);
                const command = candidates.find(candidate => commands.includes(candidate));
                try {
                    await vscode.commands.executeCommand('workbench.view.explorer');
                } catch {
                    // ignore
                }
                if (command) {
                    await vscode.commands.executeCommand(command);
                }
            });

            register('salesforceMetadata.openNamespaceReport', async () => {
                try {
                    const uri = getWorkspaceUri(vscode, '.salesforce/namespaces.json');
                    const bytes = await vscode.workspace.fs.readFile(uri);
                    if (!bytes || !bytes.length) {
                        await vscode.window.showWarningMessage(
                            'Namespace report is empty. Fetch metadata first.'
                        );
                        return;
                    }
                    if (vscode.window?.showTextDocument) {
                        await vscode.window.showTextDocument(uri);
                    } else {
                        await vscode.window.showInformationMessage(
                            `Namespace report written to ${getWorkspacePath(
                                vscode,
                                '.salesforce/namespaces.json'
                            )}`
                        );
                    }
                } catch {
                    await vscode.window.showWarningMessage(
                        'Namespace report not found. Fetch metadata first.'
                    );
                }
            });

            register('salesforceMetadata.installExtensions', async () => {
                const extensionIds = [
                    'salesforce.salesforcedx-vscode-core',
                    'salesforce.salesforcedx-vscode-apex',
                    'salesforce.salesforcedx-vscode-lwc',
                    'dbaeumer.vscode-eslint',
                ];
                const commands = await vscode.commands.getCommands(true);
                const hasInstall = commands.includes('workbench.extensions.installExtension');
                const hasSearch = commands.includes('workbench.extensions.search');
                const hasOpenView = commands.includes('workbench.view.extensions');
                if (hasOpenView) {
                    await vscode.commands.executeCommand('workbench.view.extensions');
                }
                if (hasSearch) {
                    await vscode.commands.executeCommand(
                        'workbench.extensions.search',
                        '@recommended'
                    );
                }
                if (!hasInstall) {
                    await vscode.window.showWarningMessage(
                        'This workbench runtime does not expose the extension install command. Use the Extensions view to install from Open VSX manually.'
                    );
                    return;
                }
                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Installing extensions from Open VSX...',
                        cancellable: false,
                    },
                    async () => {
                        for (const extensionId of extensionIds) {
                            try {
                                await vscode.commands.executeCommand(
                                    'workbench.extensions.installExtension',
                                    extensionId
                                );
                            } catch (error) {
                                // eslint-disable-next-line no-console
                                console.warn('Failed to install extension', extensionId, error);
                            }
                        }
                    }
                );
                await vscode.window.showInformationMessage(
                    'Install triggered. Note: many official Salesforce extensions require desktop VS Code/CLI and may not work fully in a browser workbench.'
                );
            });
        }
    }

    registerCommandGroups(commandGroups);

    return {
        deployPaths,
        fetchPathFromSalesforce,
        invalidateToolingMap,
        loadToolingMapItems,
        resolveCurrentToolingPath,
        registerCommandGroups,
        setLwcDocumentTools(next) {
            const tools = next || {};
            if (typeof tools.isLwcDoc === 'function') {
                currentIsLwcDoc = tools.isLwcDoc;
            }
            if (typeof tools.lintLwcDocument === 'function') {
                currentLintLwcDocument = tools.lintLwcDocument;
            }
        },
        setMetadataApiDeploy(fn) {
            if (typeof fn === 'function') {
                metadataApiDeployFn = fn;
            }
        },
        updateSourceTrackingForPaths,
    };
}

export const __testables = {
    buildCurrentFileWarningMessage,
    buildDeployWorkerConnection,
    buildChangedFileDeployQuickPickItems,
    classifyDeployPath,
    classifyToolingCommandPath,
    partitionChangedPathsForDeploy,
    pruneChangedPathsForSuccessfulDeploys,
};
