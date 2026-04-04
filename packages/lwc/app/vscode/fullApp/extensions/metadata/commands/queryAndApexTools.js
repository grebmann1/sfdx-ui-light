/* eslint-disable import/no-unresolved */
import { createToolingClient } from 'vscode/toolingApi';

import { resolveStoredConnection } from '../../../workbench/sharedConnection.js';
import { ensureDir, writeTextFile } from '../core/workspaceCache.js';
import {
    getSalesforceStateDirUri,
    getWorkspacePath,
    getWorkspaceUri,
} from '../core/workspacePaths.js';

function csvEscape(value) {
    const stringValue = value == null ? '' : String(value);
    if (/[",\n\r]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

function flattenRecord(record) {
    const output = {};
    for (const [key, value] of Object.entries(record || {})) {
        if (key === 'attributes') continue;
        if (value == null) output[key] = '';
        else if (typeof value === 'object') output[key] = JSON.stringify(value);
        else output[key] = String(value);
    }
    return output;
}

export function registerQueryAndApexTools({ connectionRuntime, context, deployTools }) {
    const { diagnostics, vscode } = context;

    async function runQuery({ soql, tooling }) {
        const conn = connectionRuntime.loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.commands.executeCommand('salesforceMetadata.connect');
            return null;
        }
        const query = String(soql || '').trim();
        if (!query) return null;
        const path = tooling
            ? `/tooling/query?q=${encodeURIComponent(query)}`
            : `/query?q=${encodeURIComponent(query)}`;
        return await connectionRuntime.withToolingClientAuthed(conn, async client => {
            const first = await client.requestJson(path);
            const pages = [first];
            let nextUrl = first?.nextRecordsUrl;
            while (nextUrl) {
                // eslint-disable-next-line no-await-in-loop
                const page = await client.requestJson(nextUrl);
                pages.push(page);
                nextUrl = page?.nextRecordsUrl;
            }
            const records = pages.flatMap(page => page?.records || []);
            return {
                query,
                tooling: Boolean(tooling),
                totalSize: Number(first?.totalSize ?? records.length),
                records,
            };
        });
    }

    async function writeQueryResults({ query, records, tooling, totalSize }) {
        const dir = getWorkspaceUri(vscode, '.salesforce/query-results');
        await ensureDir(vscode, dir);
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const baseName = `${tooling ? 'tooling' : 'soql'}-${ts}`;
        const mdUri = vscode.Uri.joinPath(dir, `${baseName}.md`);
        const jsonUri = vscode.Uri.joinPath(dir, `${baseName}.json`);
        const csvUri = vscode.Uri.joinPath(dir, `${baseName}.csv`);

        const flattened = (records || []).map(flattenRecord);
        const columns = Array.from(
            flattened.reduce((set, row) => {
                for (const key of Object.keys(row || {})) set.add(key);
                return set;
            }, new Set())
        ).sort((left, right) => left.localeCompare(right));

        const csvLines = [
            columns.map(csvEscape).join(','),
            ...flattened.map(row =>
                columns.map(column => csvEscape(row?.[column] ?? '')).join(',')
            ),
        ];

        const previewCount = Math.min(50, flattened.length);
        const previewColumns = columns.slice(0, 20);
        const markdownLines = [
            `# ${tooling ? 'Tooling Query' : 'SOQL Query'} Results`,
            '',
            `- Query: \`${query.replace(/`/g, '\\`')}\``,
            `- Records: ${flattened.length}${
                Number.isFinite(totalSize) ? ` (totalSize: ${totalSize})` : ''
            }`,
            `- Files: \`${mdUri.path}\`, \`${csvUri.path}\`, \`${jsonUri.path}\``,
            '',
            `## Preview (${previewCount} rows)`,
            '',
            `Columns shown: ${previewColumns.length}/${columns.length}`,
            '',
            `| ${previewColumns.join(' | ')} |`,
            `| ${previewColumns.map(() => '---').join(' | ')} |`,
            ...flattened.slice(0, previewCount).map(row => {
                return `| ${previewColumns
                    .map(column => row?.[column] ?? '')
                    .map(value => String(value).replace(/\|/g, '\\|'))
                    .join(' | ')} |`;
            }),
            '',
        ];

        await writeTextFile(
            vscode,
            jsonUri,
            JSON.stringify({ tooling, query, totalSize, records }, null, 2),
            { skipCache: true }
        );
        await writeTextFile(vscode, csvUri, csvLines.join('\n'), { skipCache: true });
        await writeTextFile(vscode, mdUri, markdownLines.join('\n'), { skipCache: true });

        try {
            const doc = await vscode.workspace.openTextDocument(mdUri);
            await vscode.window.showTextDocument(doc, { preview: false });
        } catch {
            // ignore
        }
    }

    async function toUri(arg) {
        const value = arg?.uri || arg;
        if (value?.scheme && typeof value?.toString === 'function') return value;
        const path = value?.path || value;
        if (!path) return null;
        return vscode.Uri.file(String(path));
    }

    async function readSelectionOrDocumentText(targetUri) {
        const editor = vscode.window?.activeTextEditor;
        const doc = editor?.document;
        const same = Boolean(doc && targetUri && doc.uri?.toString?.() === targetUri.toString?.());
        if (same && editor?.selection && !editor.selection.isEmpty) {
            return doc.getText(editor.selection) || '';
        }
        if (same && doc) {
            return doc.getText?.() || '';
        }
        if (!targetUri) return '';
        try {
            const targetDoc = await vscode.workspace.openTextDocument(targetUri);
            return targetDoc.getText?.() || '';
        } catch {
            return '';
        }
    }

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

    async function listConnectionsForCompare() {
        const current = connectionRuntime.loadStoredConn();
        const workspaceApiVersion = await connectionRuntime.getWorkspaceApiVersion(
            current.apiVersion
        );
        const items = [];
        if (current.instanceUrl && current.accessToken) {
            let host = current.instanceUrl;
            try {
                host = new URL(current.instanceUrl).host;
            } catch {
                // ignore
            }
            items.push({
                label: `Current: ${host}${current.username ? ` (${current.username})` : ''}`,
                description: current.authType || 'current',
                detail: current.instanceUrl,
                serverUrl: current.instanceUrl,
                sessionId: current.accessToken,
                apiVersion: workspaceApiVersion,
                authType: current.authType || '',
                sharedAlias: current.sharedAlias || '',
                _current: true,
            });
        }

        const sharedConnections = await connectionRuntime
            .listSharedConnectionEntries()
            .catch(() => []);
        for (const item of sharedConnections) {
            const configuration = item?.configuration;
            if (!configuration?.instanceUrl) continue;
            items.push({
                label: `Saved: ${item.label}`,
                description: connectionRuntime.getConnectionTypeLabel(configuration),
                detail: configuration.alias || configuration.instanceUrl,
                serverUrl: configuration.instanceUrl,
                sessionId: configuration.accessToken || '',
                apiVersion: workspaceApiVersion,
                authType: connectionRuntime.getConnectionAuthType(configuration),
                sharedAlias: configuration.alias || '',
                _shared: true,
            });
        }

        if (connectionRuntime.isChromeExtensionEnv()) {
            const sessions = await globalThis.chrome?.runtime
                .sendMessage({ action: 'listOrgSessions' })
                .catch(() => []);
            if (Array.isArray(sessions)) {
                for (const session of sessions) {
                    items.push({
                        label: `Cookie: ${session?.label || session?.serverUrl || 'Org'}`,
                        description: 'cookie',
                        detail: session?.detail || session?.serverUrl || '',
                        serverUrl: session?.serverUrl,
                        sessionId: session?.sessionId,
                        apiVersion: workspaceApiVersion,
                        authType: 'cookie',
                        _cookie: true,
                    });
                }
            }
        }

        const seen = new Set();
        return items.filter(item => {
            const key = `${item.serverUrl}|${item.sessionId || item.detail || item.description || ''}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return Boolean(item.serverUrl && (item.sessionId || item._shared));
        });
    }

    async function resolveConnectionForUse(connItem) {
        if (!connItem) return null;
        if (connItem._current) {
            const current = connectionRuntime.loadStoredConn();
            const stored = await resolveStoredConnection(current, { persist: false }).catch(
                () => current
            );
            return {
                ...connItem,
                serverUrl: stored.instanceUrl,
                sessionId: stored.accessToken,
                apiVersion: connItem.apiVersion || stored.apiVersion,
                authType: stored.authType,
                sharedAlias: stored.sharedAlias || '',
            };
        }
        if (connItem.sharedAlias) {
            const stored = await resolveStoredConnection(
                {
                    instanceUrl: connItem.serverUrl,
                    accessToken: connItem.sessionId,
                    apiVersion: connItem.apiVersion,
                    authType: connItem.authType,
                    sharedAlias: connItem.sharedAlias,
                },
                { persist: false }
            ).catch(() => null);
            if (stored?.instanceUrl && stored?.accessToken) {
                return {
                    ...connItem,
                    serverUrl: stored.instanceUrl,
                    sessionId: stored.accessToken,
                    apiVersion: connItem.apiVersion || stored.apiVersion,
                    authType: stored.authType,
                    sharedAlias: stored.sharedAlias || connItem.sharedAlias,
                };
            }
        }
        return connItem;
    }

    function register(command, handler) {
        return context.addDisposable(vscode.commands.registerCommand(command, handler));
    }

    register('salesforceMetadata.runSoqlQuery', async () => {
        const editor = vscode.window?.activeTextEditor;
        const selected =
            editor?.document && editor?.selection && !editor.selection.isEmpty
                ? editor.document.getText(editor.selection)
                : '';
        const soql = await vscode.window.showInputBox({
            title: 'Run SOQL Query',
            prompt: 'Example: SELECT Id, Name FROM Account LIMIT 50',
            value: selected?.trim() || '',
            ignoreFocusOut: true,
        });
        if (!soql) return;
        const result = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Running SOQL query…',
                cancellable: false,
            },
            async () => await runQuery({ tooling: false, soql })
        );
        if (!result) return;
        await writeQueryResults(result);
    });

    register('salesforceMetadata.runToolingQuery', async () => {
        const editor = vscode.window?.activeTextEditor;
        const selected =
            editor?.document && editor?.selection && !editor.selection.isEmpty
                ? editor.document.getText(editor.selection)
                : '';
        const soql = await vscode.window.showInputBox({
            title: 'Run Tooling Query',
            prompt: 'Example: SELECT Id, Name FROM ApexClass LIMIT 50',
            value: selected?.trim() || '',
            ignoreFocusOut: true,
        });
        if (!soql) return;
        const result = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Running Tooling query…',
                cancellable: false,
            },
            async () => await runQuery({ tooling: true, soql })
        );
        if (!result) return;
        await writeQueryResults(result);
    });

    register('salesforceMetadata.openSoqlScratch', async () => {
        const sfDir = getSalesforceStateDirUri(vscode);
        const scratchUri = getWorkspaceUri(vscode, '.salesforce/soql-editor.soql');
        await ensureDir(vscode, sfDir);
        try {
            await vscode.workspace.fs.stat(scratchUri);
        } catch {
            try {
                await writeTextFile(
                    vscode,
                    scratchUri,
                    'SELECT Id, Name\nFROM Account\nLIMIT 50\n',
                    { skipCache: true }
                );
            } catch {
                // ignore
            }
        }
        try {
            const doc = await vscode.workspace.openTextDocument(scratchUri);
            await vscode.window.showTextDocument(doc, { preview: false });
        } catch {
            // ignore
        }
    });

    register('salesforceMetadata._runSoqlEditorDoc', async uriArg => {
        const uri = await toUri(uriArg);
        const soql = await readSelectionOrDocumentText(uri);
        const result = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Running SOQL query…',
                cancellable: false,
            },
            async () => await runQuery({ tooling: false, soql })
        );
        if (!result) return;
        await writeQueryResults(result);
    });

    register('salesforceMetadata._runToolingEditorDoc', async uriArg => {
        const uri = await toUri(uriArg);
        const soql = await readSelectionOrDocumentText(uri);
        const result = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Running Tooling query…',
                cancellable: false,
            },
            async () => await runQuery({ tooling: true, soql })
        );
        if (!result) return;
        await writeQueryResults(result);
    });

    try {
        if (
            typeof vscode.languages?.registerCodeLensProvider === 'function' &&
            typeof vscode.CodeLens === 'function' &&
            typeof vscode.Range === 'function'
        ) {
            context.addDisposable(
                vscode.languages.registerCodeLensProvider('soql', {
                    provideCodeLenses(doc) {
                        try {
                            if (!doc || doc.languageId !== 'soql') return [];
                            const top = new vscode.Range(0, 0, 0, 0);
                            return [
                                new vscode.CodeLens(top, {
                                    title: 'Run SOQL',
                                    command: 'salesforceMetadata._runSoqlEditorDoc',
                                    arguments: [doc.uri],
                                }),
                                new vscode.CodeLens(top, {
                                    title: 'Run Tooling',
                                    command: 'salesforceMetadata._runToolingEditorDoc',
                                    arguments: [doc.uri],
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
            await vscode.commands.executeCommand('salesforceMetadata.connect');
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
            (doc.languageId === 'apex' || /\.cls$|\.trigger$/i.test(doc.uri?.path || ''))
        ) {
            code = String(doc.getText?.() || '').trim();
        }
        if (!code) {
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
        const targetUri = doc?.uri || getWorkspaceUri(vscode, '.salesforce/execute-anonymous.apex');
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
                    const normalizedColumn = Number.isFinite(column) && column > 0 ? column - 1 : 0;
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
            await vscode.commands.executeCommand('salesforceMetadata.connect');
            return;
        }
        const activePath = vscode.window?.activeTextEditor?.document?.uri?.path || '';
        const mapItems = await deployTools.loadToolingMapItems();
        const activeEntry = activePath ? mapItems?.[activePath] : null;
        const activeClassId = activeEntry?.type === 'ApexClass' ? String(activeEntry.id || '') : '';

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
        for (const [path, entry] of Object.entries(mapItems || {})) {
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
                            ['Completed', 'Aborted', 'Failed'].includes(String(row?.Status || ''))
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
            await vscode.commands.executeCommand('salesforceMetadata.connect');
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
                        const created = await client.requestJson('/tooling/sobjects/DebugLevel', {
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
                        });
                        debugLevelId = created?.id || '';
                    }
                    if (!debugLevelId) throw new Error('Failed to create DebugLevel.');
                    const start = new Date();
                    const expiration = new Date(start.getTime() + minutesPick.minutes * 60 * 1000);
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
            await vscode.commands.executeCommand('salesforceMetadata.connect');
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
                    return await client.requestText(`/tooling/sobjects/ApexLog/${picked.id}/Body`);
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

    register('salesforceMetadata.compareOrgs', async () => {
        const connections = await listConnectionsForCompare();
        if (connections.length < 2) {
            await vscode.window.showWarningMessage(
                'Need at least 2 org connections (OAuth or cookie tabs) to compare.'
            );
            return;
        }
        const leftPick = await vscode.window.showQuickPick(connections, {
            title: 'Compare Orgs',
            placeHolder: 'Select LEFT org',
            ignoreFocusOut: true,
            matchOnDescription: true,
            matchOnDetail: true,
        });
        if (!leftPick) return;
        const rightPick = await vscode.window.showQuickPick(
            connections.filter(connection => connection !== leftPick),
            {
                title: 'Compare Orgs',
                placeHolder: 'Select RIGHT org',
                ignoreFocusOut: true,
                matchOnDescription: true,
                matchOnDetail: true,
            }
        );
        if (!rightPick) return;

        const left = await resolveConnectionForUse(leftPick);
        const right = await resolveConnectionForUse(rightPick);
        if (!left?.serverUrl || !left?.sessionId || !right?.serverUrl || !right?.sessionId) {
            await vscode.window.showErrorMessage('Missing connection details for comparison.');
            return;
        }

        const typePick = await vscode.window.showQuickPick(
            [
                { label: 'Apex Classes', type: 'ApexClass' },
                { label: 'Apex Triggers', type: 'ApexTrigger' },
            ],
            {
                title: 'Compare Orgs',
                placeHolder: 'Select metadata type',
                ignoreFocusOut: true,
            }
        );
        if (!typePick) return;

        const proxyUrl = connectionRuntime.isChromeExtensionEnv()
            ? undefined
            : window.location.origin;
        const leftClient = createToolingClient({
            instanceUrl: left.serverUrl,
            accessToken: left.sessionId,
            apiVersion: left.apiVersion,
            proxyUrl,
        });
        const rightClient = createToolingClient({
            instanceUrl: right.serverUrl,
            accessToken: right.sessionId,
            apiVersion: right.apiVersion,
            proxyUrl,
        });

        const fetchList = async client => {
            if (typePick.type === 'ApexClass') {
                return await client.toolingQueryAll(
                    'SELECT Id, Name, LastModifiedDate, SystemModstamp FROM ApexClass ORDER BY Name'
                );
            }
            return await client.toolingQueryAll(
                'SELECT Id, Name, LastModifiedDate, SystemModstamp FROM ApexTrigger ORDER BY Name'
            );
        };

        const [leftRows, rightRows] = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Comparing orgs…',
                cancellable: false,
            },
            async () => await Promise.all([fetchList(leftClient), fetchList(rightClient)])
        );

        const leftByName = new Map(
            (leftRows || []).map(row => [String(row?.Name || ''), row]).filter(entry => entry[0])
        );
        const rightByName = new Map(
            (rightRows || []).map(row => [String(row?.Name || ''), row]).filter(entry => entry[0])
        );
        const names = Array.from(new Set([...leftByName.keys(), ...rightByName.keys()])).sort(
            (leftName, rightName) => leftName.localeCompare(rightName)
        );

        const onlyLeft = [];
        const onlyRight = [];
        const changed = [];
        for (const name of names) {
            const leftRecord = leftByName.get(name);
            const rightRecord = rightByName.get(name);
            if (leftRecord && !rightRecord) onlyLeft.push(name);
            else if (!leftRecord && rightRecord) onlyRight.push(name);
            else if (leftRecord && rightRecord) {
                const leftStamp = String(
                    leftRecord?.SystemModstamp || leftRecord?.LastModifiedDate || ''
                );
                const rightStamp = String(
                    rightRecord?.SystemModstamp || rightRecord?.LastModifiedDate || ''
                );
                if (leftStamp && rightStamp && leftStamp !== rightStamp) {
                    changed.push(name);
                }
            }
        }

        const outDir = getWorkspaceUri(vscode, '.salesforce/org-compare');
        await ensureDir(vscode, outDir);
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const reportUri = vscode.Uri.joinPath(
            outDir,
            `compare-${typePick.type.toLowerCase()}-${ts}.md`
        );
        const report = [
            '# Org Compare Report',
            '',
            `- Type: ${typePick.type}`,
            `- Left: ${left.label}`,
            `- Right: ${right.label}`,
            '',
            `- Only in left: ${onlyLeft.length}`,
            `- Only in right: ${onlyRight.length}`,
            `- Changed (stamp differs): ${changed.length}`,
            '',
            '## Changed',
            '',
            ...(changed.length ? changed.map(name => `- ${name}`) : ['(none)']),
            '',
            '## Only in left',
            '',
            ...(onlyLeft.length ? onlyLeft.map(name => `- ${name}`) : ['(none)']),
            '',
            '## Only in right',
            '',
            ...(onlyRight.length ? onlyRight.map(name => `- ${name}`) : ['(none)']),
            '',
        ].join('\n');
        await writeTextFile(vscode, reportUri, report, { skipCache: true });
        try {
            const doc = await vscode.workspace.openTextDocument(reportUri);
            await vscode.window.showTextDocument(doc, { preview: false });
        } catch {
            // ignore
        }

        if (!changed.length) return;
        const action = await vscode.window.showQuickPick(
            [
                { label: 'Open diff for a changed item…', _diff: true },
                { label: 'Done', _done: true },
            ],
            { title: 'Org Compare', ignoreFocusOut: true }
        );
        if (!action?._diff) return;
        const itemPick = await vscode.window.showQuickPick(
            changed.slice(0, 200).map(name => ({ label: name })),
            {
                title: 'Diff remote vs remote',
                placeHolder: 'Select an item to diff',
                ignoreFocusOut: true,
            }
        );
        if (!itemPick?.label) return;
        const name = itemPick.label;
        const leftRecord = leftByName.get(name);
        const rightRecord = rightByName.get(name);
        if (!leftRecord?.Id || !rightRecord?.Id) return;
        const leftText =
            typePick.type === 'ApexClass'
                ? await leftClient
                      .toolingQueryAll(`SELECT Body FROM ApexClass WHERE Id='${leftRecord.Id}'`)
                      .then(rows => rows?.[0]?.Body ?? '')
                : await leftClient
                      .toolingQueryAll(`SELECT Body FROM ApexTrigger WHERE Id='${leftRecord.Id}'`)
                      .then(rows => rows?.[0]?.Body ?? '');
        const rightText =
            typePick.type === 'ApexClass'
                ? await rightClient
                      .toolingQueryAll(`SELECT Body FROM ApexClass WHERE Id='${rightRecord.Id}'`)
                      .then(rows => rows?.[0]?.Body ?? '')
                : await rightClient
                      .toolingQueryAll(`SELECT Body FROM ApexTrigger WHERE Id='${rightRecord.Id}'`)
                      .then(rows => rows?.[0]?.Body ?? '');
        const diffDir = getWorkspaceUri(vscode, '.salesforce/.diff-orgs');
        await ensureDir(vscode, diffDir);
        const extension = typePick.type === 'ApexClass' ? 'cls' : 'trigger';
        const leftUri = vscode.Uri.joinPath(diffDir, `left-${name}.${extension}`);
        const rightUri = vscode.Uri.joinPath(diffDir, `right-${name}.${extension}`);
        await writeTextFile(vscode, leftUri, leftText || '', { skipCache: true });
        await writeTextFile(vscode, rightUri, rightText || '', { skipCache: true });
        try {
            await vscode.commands.executeCommand(
                'vscode.diff',
                leftUri,
                rightUri,
                `Org Diff: ${name}`
            );
        } catch {
            // ignore
        }
    });

    register('salesforceMetadata.whereUsed', async () => {
        const conn = connectionRuntime.loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.commands.executeCommand('salesforceMetadata.connect');
            return;
        }
        const path = vscode.window?.activeTextEditor?.document?.uri?.path;
        if (!path) return;
        const mapItems = await deployTools.loadToolingMapItems();
        const entry = mapItems?.[path];
        if (!entry?.id) {
            await vscode.window.showWarningMessage(
                'This file is not in tooling-map.json. Fetch metadata first.'
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
