/* eslint-disable import/no-unresolved */
import {
    hashText,
    loadSourceTracking,
    pickRemoteStamp,
    saveSourceTracking,
} from 'vscode/sourceTracking';

const AUTO_DEPLOY_KEY = 'sf_ext_autoDeployOnSave';
import { createToolingMapStore } from '../core/toolingMapStore';
import { ensureDir, writeTextFile } from '../core/workspaceCache';
import {
    auraFilename,
    getWorkspaceDefaultRootUri,
    getWorkspacePath,
    getWorkspaceUri,
    normalizeLwcResourceRelPath,
    safeSeg,
} from '../core/workspacePaths';

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

    const loadToolingMapItems = ({ force } = {}) => toolingMapStore.loadItems({ force });
    const invalidateToolingMap = () => toolingMapStore.invalidate();

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
        if (
            type !== 'ApexClass' &&
            type !== 'ApexTrigger' &&
            type !== 'LightningComponentResource' &&
            type !== 'AuraDefinition'
        ) {
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

    async function deployPaths(paths, { showProgress, title } = {}) {
        const conn = connectionRuntime.loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
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
            // eslint-disable-next-line no-await-in-loop
            const text = await readTextForPath(path);
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
            new Promise(resolve => {
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
                    connection: conn,
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
                `Target: ${conn.instanceUrl}`,
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

        const successPaths = results.filter(r => r?.ok === true && r?.path).map(r => r.path);
        if (successPaths.length) {
            for (const path of successPaths) changedPaths.delete(path);
            try {
                await updateSourceTrackingForPaths(successPaths);
            } catch {
                // ignore
            }
        }

        return { failures, results, skippedReadOnly };
    }

    async function fetchPathFromSalesforce(path, { showProgress } = {}) {
        const conn = connectionRuntime.loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.window.showErrorMessage(
                connectionRuntime.getInjectedConnectionRequiredMessage()
            );
            return;
        }

        const mapItems = await loadToolingMapItems();
        const entry = mapItems?.[path];
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
            try {
                diagnostics.deploy?.delete?.(vscode.Uri.file(path));
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

    const changedPaths = new Set();
    const deployInFlight = new Set();
    const deployPending = new Map();
    let deployTimer = null;
    let autoDeployUiLock = false;

    function setAutoDeployBusyState(isBusy, { pendingCount } = {}) {
        if (!loadAutoDeployOnSave()) return;
        try {
            if (isBusy) {
                autoDeployUiLock = true;
                const count = Number(pendingCount || 0);
                autoDeployStatusItem.text = `$(sync~spin) AutoDeploy: Deploying${
                    count ? ` (${count} pending)` : ''
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
        for (const [path, entry] of Object.entries(tracking.items)) {
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
                        const mapItems = await loadToolingMapItems();
                        if (mapItems?.[doc?.uri?.path]) enqueueAutoDeploy(doc);
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

            register('salesforceMetadata.deployCurrentFile', async () => {
                const path = vscode.window?.activeTextEditor?.document?.uri?.path;
                if (!path) return;
                await deployPaths([path], {
                    showProgress: true,
                    title: 'Deploying current file...',
                });
            });

            register('salesforceMetadata.fetchCurrentFile', async () => {
                const path = vscode.window?.activeTextEditor?.document?.uri?.path;
                if (!path) return;
                await fetchPathFromSalesforce(path, { showProgress: true });
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
                const mapItems = await loadToolingMapItems();
                const entry = mapItems?.[path];
                if (!entry?.type || !entry?.id) {
                    await vscode.window.showWarningMessage(
                        'This file is not in tooling-map.json. Fetch metadata first.'
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
                const remoteUri = getWorkspaceUri(vscode, `.salesforce/.diff${path}`);
                await writeTextFile(vscode, remoteUri, remoteText, { skipCache: true });
                try {
                    const title = `Diff: ${path.split('/').pop() || path} (local ↔ org)`;
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
                const paths = Array.from(changedPaths);
                await deployPaths(paths, {
                    showProgress: true,
                    title: 'Deploying changed files...',
                });
                changedPaths.clear();
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
                const conn = connectionRuntime.loadStoredConn();
                if (!conn.instanceUrl || !conn.accessToken) {
                    await vscode.window.showErrorMessage(
                        connectionRuntime.getInjectedConnectionRequiredMessage()
                    );
                    return;
                }
                await connectionRuntime.withToolingClientAuthed(conn, async client => {
                    const typePick = await vscode.window.showQuickPick(
                        [
                            { label: 'Apex Classes', type: 'ApexClass' },
                            { label: 'Apex Triggers', type: 'ApexTrigger' },
                            { label: 'LWC Bundles', type: 'LightningComponentBundle' },
                            { label: 'Aura Bundles', type: 'AuraDefinitionBundle' },
                        ],
                        {
                            title: 'Org Browser',
                            placeHolder: 'Select a metadata type',
                            ignoreFocusOut: true,
                        }
                    );
                    if (!typePick) return;
                    const rows = await vscode.window.withProgress(
                        {
                            location: vscode.ProgressLocation.Notification,
                            title: 'Loading org metadata…',
                            cancellable: false,
                        },
                        async () => {
                            if (typePick.type === 'ApexClass') {
                                return await client.toolingQueryAll(
                                    'SELECT Id, Name, Body FROM ApexClass ORDER BY Name'
                                );
                            }
                            if (typePick.type === 'ApexTrigger') {
                                return await client.toolingQueryAll(
                                    'SELECT Id, Name, Body FROM ApexTrigger ORDER BY Name'
                                );
                            }
                            if (typePick.type === 'LightningComponentBundle') {
                                return await client.toolingQueryAll(
                                    'SELECT Id, DeveloperName, NamespacePrefix FROM LightningComponentBundle ORDER BY DeveloperName'
                                );
                            }
                            if (typePick.type === 'AuraDefinitionBundle') {
                                return await client.toolingQueryAll(
                                    'SELECT Id, DeveloperName, NamespacePrefix FROM AuraDefinitionBundle ORDER BY DeveloperName'
                                );
                            }
                            return [];
                        }
                    );
                    if (!rows?.length) {
                        await vscode.window.showInformationMessage('No items found.');
                        return;
                    }
                    const selected = await vscode.window.showQuickPick(
                        rows.map(row => {
                            const name = row?.Name || row?.DeveloperName || row?.Id;
                            const namespace = row?.NamespacePrefix
                                ? String(row.NamespacePrefix)
                                : '';
                            return {
                                label: namespace ? `${name} (${namespace})` : String(name),
                                description: row?.Id,
                                row,
                            };
                        }),
                        {
                            title: 'Org Browser',
                            placeHolder: 'Select item(s) to pull into the workspace',
                            canPickMany: true,
                            ignoreFocusOut: true,
                            matchOnDescription: true,
                        }
                    );
                    if (!selected?.length) return;
                    await vscode.window.withProgress(
                        {
                            location: vscode.ProgressLocation.Notification,
                            title: 'Pulling selected items…',
                            cancellable: false,
                        },
                        async () => {
                            const defaultRoot = getWorkspaceDefaultRootUri(vscode);
                            for (const item of selected) {
                                const row = item?.row;
                                if (!row) continue;
                                if (typePick.type === 'ApexClass') {
                                    const uri = vscode.Uri.joinPath(
                                        defaultRoot,
                                        'classes',
                                        `${safeSeg(row.Name)}.cls`
                                    );
                                    await writeTextFile(vscode, uri, row.Body || '');
                                } else if (typePick.type === 'ApexTrigger') {
                                    const uri = vscode.Uri.joinPath(
                                        defaultRoot,
                                        'triggers',
                                        `${safeSeg(row.Name)}.trigger`
                                    );
                                    await writeTextFile(vscode, uri, row.Body || '');
                                } else if (typePick.type === 'LightningComponentBundle') {
                                    const bundleName = safeSeg(row.DeveloperName);
                                    const bundlePath = vscode.Uri.joinPath(
                                        defaultRoot,
                                        'lwc',
                                        bundleName
                                    );
                                    await ensureDir(vscode, bundlePath);
                                    const resources = await client.toolingQueryAll(
                                        `SELECT Id, FilePath, Format, Source FROM LightningComponentResource WHERE LightningComponentBundleId='${row.Id}' ORDER BY FilePath`
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
                                    }
                                } else if (typePick.type === 'AuraDefinitionBundle') {
                                    const bundleName = safeSeg(row.DeveloperName);
                                    const bundlePath = vscode.Uri.joinPath(
                                        defaultRoot,
                                        'aura',
                                        bundleName
                                    );
                                    await ensureDir(vscode, bundlePath);
                                    const defs = await client.toolingQueryAll(
                                        `SELECT Id, DefType, Format, Source FROM AuraDefinition WHERE AuraDefinitionBundleId='${row.Id}' ORDER BY DefType`
                                    );
                                    const used = new Set();
                                    for (const definition of defs) {
                                        if (!definition?.Source) continue;
                                        let fileName = safeSeg(
                                            auraFilename(
                                                bundleName,
                                                definition.DefType,
                                                definition.Format
                                            )
                                        );
                                        if (used.has(fileName)) {
                                            fileName = `${fileName}.${String(
                                                definition.Id || ''
                                            ).slice(-6)}`;
                                        }
                                        used.add(fileName);
                                        const target = vscode.Uri.joinPath(bundlePath, fileName);
                                        await writeTextFile(
                                            vscode,
                                            target,
                                            definition.Source || ''
                                        );
                                    }
                                }
                            }
                        }
                    );
                    await vscode.window.showInformationMessage(
                        `Pulled ${selected.length} item(s) into the workspace.`
                    );
                    try {
                        await vscode.commands.executeCommand('salesforceMetadata.refreshProject');
                    } catch {
                        // ignore
                    }
                });
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
        registerCommandGroups,
        setLwcDocumentTools(next = {}) {
            if (typeof next.isLwcDoc === 'function') {
                currentIsLwcDoc = next.isLwcDoc;
            }
            if (typeof next.lintLwcDocument === 'function') {
                currentLintLwcDocument = next.lintLwcDocument;
            }
        },
        updateSourceTrackingForPaths,
    };
}
