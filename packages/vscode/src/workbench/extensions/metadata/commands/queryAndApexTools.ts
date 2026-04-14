import { ensureDir, writeTextFile } from '../core/workspaceCache';
import { getWorkspacePath, getWorkspaceUri } from '../core/workspacePaths';

import { buildCurrentFileWarningMessage } from './deployAndSourceTrackingHelpers';

/**
 * Shows a QuickPick of .apex files from assets/apex/.
 * Returns the file contents if the user picks one,
 * an empty string if the folder is empty (caller should fall back),
 * or null if the user cancelled.
 */
async function pickAndRunApexScript(vscode): Promise<string | null> {
    const apexDir = getWorkspaceUri(vscode, 'assets/apex');
    let entries: [string, number][] = [];
    try {
        entries = await vscode.workspace.fs.readDirectory(apexDir);
    } catch {
        return '';
    }
    const apexFiles = entries
        .filter(([name, type]) => type === 1 /* File */ && name.endsWith('.apex'))
        .map(([name]) => name);
    if (!apexFiles.length) {
        return '';
    }
    const items = apexFiles.map(name => ({
        label: name,
        description: `assets/apex/${name}`,
        name,
    }));
    const picked = await vscode.window.showQuickPick(items, {
        title: 'Run Anonymous Apex',
        placeHolder: 'Select an Apex script from assets/apex/',
        ignoreFocusOut: true,
    });
    if (!picked) {
        return null;
    }
    const fileUri = vscode.Uri.joinPath(apexDir, picked.name);
    try {
        const fileDoc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(fileDoc, { preview: false });
        const bytes = await vscode.workspace.fs.readFile(fileUri);
        return new TextDecoder().decode(bytes).trim();
    } catch {
        return null;
    }
}

/**
 * After executeAnonymous, queries for the most recent ApexLog created at or after
 * `executedAt` and opens it in the editor if found. Silently ignores errors
 * (e.g. when debug logs are not enabled for the user).
 */
async function tryOpenExecutionLog(vscode, connectionRuntime, conn, executedAt: Date): Promise<void> {
    try {
        const isoTs = executedAt.toISOString().replace(/\.\d+Z$/, 'Z');
        const logs = await connectionRuntime.withToolingClientAuthed(conn, async client => {
            return await client.toolingQueryAll(
                `SELECT Id FROM ApexLog WHERE StartTime >= ${isoTs} ORDER BY StartTime DESC LIMIT 1`
            );
        });
        const logId = logs?.[0]?.Id;
        if (!logId) {
            return;
        }
        const body = await connectionRuntime.withToolingClientAuthed(conn, async client => {
            return await client.requestText(`/tooling/sobjects/ApexLog/${logId}/Body`);
        });
        const logsDir = getWorkspaceUri(vscode, '.salesforce/logs');
        await ensureDir(vscode, logsDir);
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const logUri = vscode.Uri.joinPath(logsDir, `execute-anonymous-${ts}.log`);
        await writeTextFile(vscode, logUri, body || '', { skipCache: true });
        try {
            const logDoc = await vscode.workspace.openTextDocument(logUri);
            await vscode.window.showTextDocument(logDoc, { preview: false });
        } catch {
            // ignore
        }
    } catch {
        // Debug logs might not be enabled — silently skip
    }
}

export function registerQueryAndApexTools({
    connectionRuntime,
    context,
    deployTools,
    commandGroups = ['all'],
}) {
    const { diagnostics, vscode } = context;
    const activeGroups = new Set(
        Array.isArray(commandGroups) && commandGroups.length ? commandGroups : ['all']
    );
    const hasGroup = group => activeGroups.has('all') || activeGroups.has(group);
    const registeredCommandGroups = new Set();

    async function ensureCurrentUserId(conn) {
        if (conn?.userId) return conn;
        const me = await connectionRuntime.withToolingClientAuthed(conn, async client => {
            return await client.requestJson('/chatter/users/me');
        });
        const userId = me?.id || me?.userId || '';
        const username = me?.username || me?.name || '';
        if (!userId) return conn;
        const next = {
            ...conn,
            userId: String(userId),
            username: conn.username || String(username || ''),
        };
        await connectionRuntime.saveConn(next);
        connectionRuntime.setStatus(next);
        return next;
    }

    function register(command, handler) {
        return context.addDisposable(vscode.commands.registerCommand(command, handler));
    }

    if (hasGroup('apex') && !registeredCommandGroups.has('apex')) {
        registeredCommandGroups.add('apex');
        try {
            if (
                typeof vscode.languages?.registerCodeLensProvider === 'function' &&
                typeof vscode.CodeLens === 'function' &&
                typeof vscode.Range === 'function'
            ) {
                context.addDisposable(
                    vscode.languages.registerCodeLensProvider('apex', {
                        provideCodeLenses(doc) {
                            try {
                                if (!doc || doc.languageId !== 'apex') return [];
                                const top = new vscode.Range(0, 0, 0, 0);
                                return [
                                    new vscode.CodeLens(top, {
                                        title: 'Run Anonymous Apex',
                                        command: 'salesforceMetadata.executeAnonymous',
                                    }),
                                ];
                            } catch {
                                return [];
                            }
                        },
                    })
                );
            }
        } catch {
            // ignore
        }
        register('salesforceMetadata.executeAnonymous', async () => {
            const conn = connectionRuntime.loadStoredConn();
            if (!conn.instanceUrl || !conn.accessToken) {
                await vscode.window.showErrorMessage(
                    connectionRuntime.getInjectedConnectionRequiredMessage()
                );
                return;
            }
            const editor = vscode.window?.activeTextEditor;
            const doc = editor?.document || null;
            const selected =
                doc && editor?.selection && !editor.selection.isEmpty
                    ? doc.getText(editor.selection)
                    : '';
            let code = String(selected || '').trim();
            if (
                !code &&
                doc &&
                (doc.languageId === 'apex' ||
                    /\.cls$|\.trigger$|\.apex$/i.test(doc.uri?.path || ''))
            ) {
                code = String(doc.getText?.() || '').trim();
            }
            if (!code) {
                const pickedCode = await pickAndRunApexScript(vscode);
                if (pickedCode === null) {
                    return;
                }
                if (pickedCode) {
                    code = pickedCode;
                } else {
                    const uri = getWorkspaceUri(vscode, '.salesforce/execute-anonymous.apex');
                    try {
                        await writeTextFile(
                            vscode,
                            uri,
                            "/* Paste Apex here and rerun Salesforce: Execute Anonymous Apex */\n\nSystem.debug('Hello from Execute Anonymous');\n",
                            { skipCache: true }
                        );
                    } catch {
                        // ignore
                    }
                    try {
                        const createdDoc = await vscode.workspace.openTextDocument(uri);
                        await vscode.window.showTextDocument(createdDoc, { preview: false });
                    } catch {
                        // ignore
                    }
                    await vscode.window.showInformationMessage(
                        `Open ${getWorkspacePath(vscode, '.salesforce/execute-anonymous.apex')}, edit it, then rerun this command.`
                    );
                    return;
                }
            }
            const targetUri =
                doc?.uri || getWorkspaceUri(vscode, '.salesforce/execute-anonymous.apex');
            const executedAt = new Date(Date.now() - 2000);
            const result = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Executing anonymous Apex…',
                    cancellable: false,
                },
                async () =>
                    await connectionRuntime.withToolingClientAuthed(conn, async client => {
                        return await client.requestJson(
                            `/tooling/executeAnonymous/?anonymousBody=${encodeURIComponent(code)}`
                        );
                    })
            );

            const compiled = Boolean(result?.compiled);
            const success = Boolean(result?.success);
            const line = Number(result?.line);
            const column = Number(result?.column);
            const problem = result?.compileProblem || result?.exceptionMessage || '';
            const stack = result?.exceptionStackTrace || '';

            try {
                if (diagnostics.apexExecuteAnonymous && targetUri) {
                    if (compiled && success) {
                        diagnostics.apexExecuteAnonymous.delete(targetUri);
                    } else {
                        const normalizedLine = Number.isFinite(line) && line > 0 ? line - 1 : 0;
                        const normalizedColumn =
                            Number.isFinite(column) && column > 0 ? column - 1 : 0;
                        const diagnostic = new vscode.Diagnostic(
                            new vscode.Range(
                                normalizedLine,
                                normalizedColumn,
                                normalizedLine,
                                normalizedColumn + 1
                            ),
                            problem || 'Execute Anonymous failed',
                            vscode.DiagnosticSeverity.Error
                        );
                        diagnostic.source = 'executeAnonymous';
                        diagnostics.apexExecuteAnonymous.set(targetUri, [diagnostic]);
                    }
                }
            } catch {
                // ignore
            }

            await tryOpenExecutionLog(vscode, connectionRuntime, conn, executedAt);

            if (compiled && success) {
                await vscode.window.showInformationMessage('Execute Anonymous succeeded.');
                return;
            }
            const details = [problem, stack].filter(Boolean).join('\n\n');
            await vscode.window.showErrorMessage(
                `Execute Anonymous failed.${details ? `\n\n${details}` : ''}`
            );
        });

        register('salesforceMetadata.runApexTests', async () => {
            const conn = connectionRuntime.loadStoredConn();
            if (!conn.instanceUrl || !conn.accessToken) {
                await vscode.window.showErrorMessage(
                    connectionRuntime.getInjectedConnectionRequiredMessage()
                );
                return;
            }
            const activePath = vscode.window?.activeTextEditor?.document?.uri?.path || '';
            const mapItems = await deployTools.loadToolingMapItems();
            const activeResolution = activePath
                ? await deployTools.resolveCurrentToolingPath(activePath)
                : null;
            const activeEntry =
                activeResolution?.status === 'tooling' ? activeResolution.entry : null;
            const activeClassId =
                activeEntry?.type === 'ApexClass' ? String(activeEntry.id || '') : '';

            const candidates = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Loading test classes…',
                    cancellable: false,
                },
                async () =>
                    await connectionRuntime.withToolingClientAuthed(conn, async client => {
                        return await client.toolingQueryAll(
                            "SELECT Id, Name FROM ApexClass WHERE Name LIKE '%Test%' ORDER BY Name LIMIT 200"
                        );
                    })
            );

            const items = (candidates || [])
                .map(row => ({
                    label: String(row?.Name || row?.Id || 'Test'),
                    description: String(row?.Id || ''),
                    picked: activeClassId && String(row?.Id || '') === activeClassId,
                    id: String(row?.Id || ''),
                    name: String(row?.Name || ''),
                }))
                .filter(item => item.id);
            if (!items.length) {
                await vscode.window.showWarningMessage(
                    'No Apex test classes found (Name LIKE %Test%).'
                );
                return;
            }

            const picked = await vscode.window.showQuickPick(items, {
                title: 'Run Apex Tests',
                placeHolder: 'Select test classes to run',
                canPickMany: true,
                ignoreFocusOut: true,
                matchOnDescription: true,
            });
            if (!picked?.length) return;

            const classIds = picked.map(item => item.id).filter(Boolean);
            const classIdToName = new Map(picked.map(item => [item.id, item.name || item.label]));
            const idToPath = new Map();
            for (const [path, entry] of Object.entries(mapItems || {}) as Array<
                [string, { type?: string; id?: string }]
            >) {
                if (entry?.type === 'ApexClass' && entry?.id) {
                    idToPath.set(String(entry.id), path);
                }
            }

            const jobId = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Starting test run…',
                    cancellable: false,
                },
                async () =>
                    await connectionRuntime.withToolingClientAuthed(conn, async client => {
                        const response = await client.requestJson('/tooling/runTestsAsynchronous', {
                            method: 'POST',
                            body: { classIds },
                        });
                        return String(response?.id || response || '');
                    })
            );
            if (!jobId) {
                await vscode.window.showErrorMessage('Failed to start test run.');
                return;
            }

            const startedAt = Date.now();
            const queueItems = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Running tests…',
                    cancellable: false,
                },
                async progress =>
                    await connectionRuntime.withToolingClientAuthed(conn, async client => {
                        for (;;) {
                            // eslint-disable-next-line no-await-in-loop
                            const rows = await client.toolingQueryAll(
                                `SELECT Id, Status, ApexClassId, MethodName, ExtendedStatus FROM ApexTestQueueItem WHERE ParentJobId='${jobId}'`
                            );
                            const total = rows?.length || 0;
                            const doneCount = (rows || []).filter(row =>
                                ['Completed', 'Aborted', 'Failed'].includes(
                                    String(row?.Status || '')
                                )
                            ).length;
                            progress.report({
                                message: total ? `${doneCount}/${total} done` : 'Queued…',
                            });
                            if (total && doneCount === total) return rows || [];
                            if (Date.now() - startedAt > 20 * 60 * 1000) {
                                throw new Error('Test run timed out (20 minutes).');
                            }
                            // eslint-disable-next-line no-await-in-loop
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                    })
            );

            const queueIds = (queueItems || []).map(row => String(row?.Id || '')).filter(Boolean);

            const results = await connectionRuntime.withToolingClientAuthed(conn, async client => {
                try {
                    return await client.toolingQueryAll(
                        `SELECT Id, Outcome, Message, StackTrace, ApexClassId, MethodName, AsyncApexJobId FROM ApexTestResult WHERE AsyncApexJobId='${jobId}' ORDER BY ApexClassId, MethodName`
                    );
                } catch {
                    if (!queueIds.length) return [];
                    const inList = queueIds.map(id => `'${id.replace(/'/g, "\\\\'")}'`).join(',');
                    return await client.toolingQueryAll(
                        `SELECT Id, Outcome, Message, StackTrace, ApexClassId, MethodName, QueueItemId FROM ApexTestResult WHERE QueueItemId IN (${inList}) ORDER BY ApexClassId, MethodName`
                    );
                }
            });

            const failures = (results || []).filter(row => String(row?.Outcome || '') !== 'Pass');

            let coverageRows = [];
            try {
                const inList = classIds.map(id => `'${id.replace(/'/g, "\\\\'")}'`).join(',');
                coverageRows = await connectionRuntime.withToolingClientAuthed(
                    conn,
                    async client =>
                        await client.toolingQueryAll(
                            `SELECT ApexClassOrTriggerId, NumLinesCovered, NumLinesUncovered FROM ApexCodeCoverageAggregate WHERE ApexClassOrTriggerId IN (${inList})`
                        )
                );
            } catch {
                // ignore
            }
            const coverageById = new Map(
                (coverageRows || []).map(row => [String(row?.ApexClassOrTriggerId || ''), row])
            );

            try {
                if (diagnostics.apexTests) {
                    diagnostics.apexTests.clear?.();
                    const diagnosticsByUri = new Map();
                    for (const failure of failures) {
                        const classId = String(failure?.ApexClassId || '');
                        const path = idToPath.get(classId);
                        if (!path) continue;
                        const uri = vscode.Uri.file(path);
                        const diagnostic = new vscode.Diagnostic(
                            new vscode.Range(0, 0, 0, 1),
                            `${failure?.MethodName || 'test'}: ${
                                failure?.Message || failure?.Outcome || 'Fail'
                            }`,
                            vscode.DiagnosticSeverity.Error
                        );
                        diagnostic.source = 'apexTests';
                        const list = diagnosticsByUri.get(uri) || [];
                        list.push(diagnostic);
                        diagnosticsByUri.set(uri, list);
                    }
                    for (const [uri, list] of diagnosticsByUri.entries()) {
                        diagnostics.apexTests.set(uri, list);
                    }
                }
            } catch {
                // ignore
            }

            const dir = getWorkspaceUri(vscode, '.salesforce/test-results');
            await ensureDir(vscode, dir);
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            const reportUri = vscode.Uri.joinPath(dir, `apex-tests-${ts}.md`);
            const lines = [
                '# Apex Test Results',
                '',
                `- Job: \`${jobId}\``,
                `- Classes: ${classIds.length}`,
                `- Total results: ${(results || []).length}`,
                `- Failures: ${failures.length}`,
                '',
                '## Summary',
                '',
                ...classIds.map(id => {
                    const name = classIdToName.get(id) || id;
                    const coverage = coverageById.get(id);
                    const covered = Number(coverage?.NumLinesCovered || 0);
                    const uncovered = Number(coverage?.NumLinesUncovered || 0);
                    const percentage =
                        covered + uncovered
                            ? Math.round((covered / (covered + uncovered)) * 100)
                            : null;
                    return `- ${name}${percentage == null ? '' : ` • coverage ${percentage}%`}`;
                }),
                '',
                '## Failures',
                '',
                ...(failures.length
                    ? failures.map(failure => {
                          const classId = String(failure?.ApexClassId || '');
                          const name = classIdToName.get(classId) || classId;
                          return `- **${name}.${failure?.MethodName || ''}**: ${
                              failure?.Message || failure?.Outcome || 'Fail'
                          }`;
                      })
                    : ['(none)']),
                '',
            ];
            await writeTextFile(vscode, reportUri, lines.join('\n'), { skipCache: true });
            try {
                const doc = await vscode.workspace.openTextDocument(reportUri);
                await vscode.window.showTextDocument(doc, { preview: false });
            } catch {
                // ignore
            }

            if (failures.length) {
                await vscode.window.showErrorMessage(
                    `Apex tests completed with ${failures.length} failure(s).`
                );
            } else {
                await vscode.window.showInformationMessage('Apex tests succeeded.');
            }
        });

        register('salesforceMetadata.enableDebugLogs', async () => {
            let conn = connectionRuntime.loadStoredConn();
            if (!conn.instanceUrl || !conn.accessToken) {
                await vscode.window.showErrorMessage(
                    connectionRuntime.getInjectedConnectionRequiredMessage()
                );
                conn = connectionRuntime.loadStoredConn();
            }
            if (!conn.instanceUrl || !conn.accessToken) return;
            conn = await ensureCurrentUserId(conn);
            if (!conn.userId) {
                await vscode.window.showErrorMessage(
                    'Unable to determine current user id for TraceFlag.'
                );
                return;
            }
            const minutesPick = await vscode.window.showQuickPick(
                [
                    { label: '15 minutes', minutes: 15 },
                    { label: '30 minutes', minutes: 30 },
                    { label: '60 minutes', minutes: 60 },
                ],
                {
                    title: 'Enable debug logs',
                    placeHolder: 'Select duration',
                    ignoreFocusOut: true,
                }
            );
            if (!minutesPick) return;

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Enabling debug logs…',
                    cancellable: false,
                },
                async () =>
                    await connectionRuntime.withToolingClientAuthed(conn, async client => {
                        const debugLevelName = 'WorkbenchDebug';
                        const debugLevelRows = await client.toolingQueryAll(
                            `SELECT Id, DeveloperName FROM DebugLevel WHERE DeveloperName='${debugLevelName}' LIMIT 1`
                        );
                        let debugLevelId = debugLevelRows?.[0]?.Id || '';
                        if (!debugLevelId) {
                            const created = await client.requestJson(
                                '/tooling/sobjects/DebugLevel',
                                {
                                    method: 'POST',
                                    body: {
                                        DeveloperName: debugLevelName,
                                        MasterLabel: debugLevelName,
                                        ApexCode: 'DEBUG',
                                        ApexProfiling: 'INFO',
                                        Callout: 'INFO',
                                        Database: 'INFO',
                                        System: 'DEBUG',
                                        Validation: 'INFO',
                                        Visualforce: 'INFO',
                                        Workflow: 'INFO',
                                    },
                                }
                            );
                            debugLevelId = created?.id || '';
                        }
                        if (!debugLevelId) throw new Error('Failed to create DebugLevel.');
                        const start = new Date();
                        const expiration = new Date(
                            start.getTime() + minutesPick.minutes * 60 * 1000
                        );
                        const body = {
                            TracedEntityId: conn.userId,
                            LogType: 'DEVELOPER_LOG',
                            DebugLevelId: debugLevelId,
                            StartDate: start.toISOString(),
                            ExpirationDate: expiration.toISOString(),
                        };
                        const traceFlagRows = await client.toolingQueryAll(
                            `SELECT Id, ExpirationDate FROM TraceFlag WHERE TracedEntityId='${conn.userId}' AND LogType='DEVELOPER_LOG' ORDER BY ExpirationDate DESC LIMIT 1`
                        );
                        const traceFlagId = traceFlagRows?.[0]?.Id || '';
                        if (traceFlagId) {
                            await client.requestJson(`/tooling/sobjects/TraceFlag/${traceFlagId}`, {
                                method: 'PATCH',
                                body,
                            });
                        } else {
                            await client.requestJson('/tooling/sobjects/TraceFlag', {
                                method: 'POST',
                                body,
                            });
                        }
                    })
            );

            await vscode.window.showInformationMessage(
                `Debug logs enabled for ${minutesPick.minutes} minutes.`
            );
        });

        register('salesforceMetadata.openDebugLogs', async () => {
            let conn = connectionRuntime.loadStoredConn();
            if (!conn.instanceUrl || !conn.accessToken) {
                await vscode.window.showErrorMessage(
                    connectionRuntime.getInjectedConnectionRequiredMessage()
                );
                conn = connectionRuntime.loadStoredConn();
            }
            if (!conn.instanceUrl || !conn.accessToken) return;

            const logs = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Loading debug logs…',
                    cancellable: false,
                },
                async () =>
                    await connectionRuntime.withToolingClientAuthed(conn, async client => {
                        return await client.toolingQueryAll(
                            'SELECT Id, StartTime, LogLength, Operation, Request, Status, DurationMilliseconds FROM ApexLog ORDER BY StartTime DESC LIMIT 50'
                        );
                    })
            );

            const items = (logs || [])
                .map(log => ({
                    label: `${log?.StartTime ? new Date(log.StartTime).toLocaleString() : ''} • ${
                        log?.Operation || log?.Request || 'Log'
                    }`,
                    description: log?.LogLength ? `${log.LogLength}b` : '',
                    detail: log?.Id || '',
                    id: log?.Id,
                }))
                .filter(item => item.id);
            if (!items.length) {
                await vscode.window.showInformationMessage('No Apex logs found.');
                return;
            }
            const picked = await vscode.window.showQuickPick(items, {
                title: 'Debug Logs',
                placeHolder: 'Select a log to open',
                ignoreFocusOut: true,
                matchOnDescription: true,
                matchOnDetail: true,
            });
            if (!picked?.id) return;
            const body = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Downloading log…',
                    cancellable: false,
                },
                async () =>
                    await connectionRuntime.withToolingClientAuthed(conn, async client => {
                        return await client.requestText(
                            `/tooling/sobjects/ApexLog/${picked.id}/Body`
                        );
                    })
            );
            const dir = getWorkspaceUri(vscode, '.salesforce/logs');
            await ensureDir(vscode, dir);
            const uri = vscode.Uri.joinPath(dir, `${picked.id}.log`);
            await writeTextFile(vscode, uri, body || '', { skipCache: true });
            try {
                const doc = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(doc, { preview: false });
            } catch {
                // ignore
            }
        });
    }

    if (hasGroup('metadata') && !registeredCommandGroups.has('metadata')) {
        registeredCommandGroups.add('metadata');
        register('salesforceMetadata.whereUsed', async () => {
            const conn = connectionRuntime.loadStoredConn();
            if (!conn.instanceUrl || !conn.accessToken) {
                await vscode.window.showErrorMessage(
                    connectionRuntime.getInjectedConnectionRequiredMessage()
                );
                return;
            }
            const path = vscode.window?.activeTextEditor?.document?.uri?.path;
            if (!path) return;
            const resolution = await deployTools.resolveCurrentToolingPath(path, {
                includeMetadataApi: true,
            });
            const entry = resolution?.entry;
            if (resolution?.status !== 'tooling' || !entry?.id) {
                await vscode.window.showWarningMessage(
                    buildCurrentFileWarningMessage(resolution, 'Where Used')
                );
                return;
            }
            const id = String(entry.id);
            const [whereUsed, dependsOn] = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Querying dependencies…',
                    cancellable: false,
                },
                async () =>
                    await connectionRuntime.withToolingClientAuthed(conn, async client => {
                        const used = await client.toolingQueryAll(
                            `SELECT MetadataComponentName, MetadataComponentType, RefMetadataComponentName, RefMetadataComponentType FROM MetadataComponentDependency WHERE RefMetadataComponentId='${id}' LIMIT 200`
                        );
                        const deps = await client.toolingQueryAll(
                            `SELECT MetadataComponentName, MetadataComponentType, RefMetadataComponentName, RefMetadataComponentType FROM MetadataComponentDependency WHERE MetadataComponentId='${id}' LIMIT 200`
                        );
                        return [used || [], deps || []];
                    })
            );
            const outDir = getWorkspaceUri(vscode, '.salesforce/where-used');
            await ensureDir(vscode, outDir);
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            const reportUri = vscode.Uri.joinPath(outDir, `where-used-${ts}.md`);
            const lines = [
                '# Where Used / Dependencies',
                '',
                `- File: \`${path}\``,
                `- Component id: \`${id}\``,
                '',
                '## Used by (dependents)',
                '',
                ...(whereUsed.length
                    ? whereUsed.map(
                          row =>
                              `- ${row?.MetadataComponentType || ''}: ${
                                  row?.MetadataComponentName || ''
                              }`
                      )
                    : ['(none)']),
                '',
                '## Depends on (references)',
                '',
                ...(dependsOn.length
                    ? dependsOn.map(
                          row =>
                              `- ${row?.RefMetadataComponentType || ''}: ${
                                  row?.RefMetadataComponentName || ''
                              }`
                      )
                    : ['(none)']),
                '',
            ].join('\n');
            await writeTextFile(vscode, reportUri, lines, { skipCache: true });
            try {
                const doc = await vscode.workspace.openTextDocument(reportUri);
                await vscode.window.showTextDocument(doc, { preview: false });
            } catch {
                // ignore
            }
        });
    }
}
