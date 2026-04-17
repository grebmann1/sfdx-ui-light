import { ensureDir, writeTextFile } from '../core/workspaceCache';
import { getWorkspacePath, getWorkspaceUri } from '../core/workspacePaths';

import { buildCurrentFileWarningMessage } from './deployAndSourceTrackingHelpers';
import {
    createTraceFlagServices,
    ensureCurrentUserId as ensureCurrentUserIdShared,
} from './traceFlagsAndLogs';

export { ensureCurrentUserId } from './traceFlagsAndLogs';

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
 * After executeAnonymous, polls for the ApexLog created at or after `executedAt`
 * and opens it in the editor. Salesforce creates the log asynchronously, so we
 * retry up to `maxAttempts` times with an increasing delay before giving up.
 *
 * Pass `showNotFound` to surface a message in the output when no log appears
 * (useful for "Run with Logs" flows where the user explicitly expects a log).
 */
async function tryOpenExecutionLog(
    vscode,
    connectionRuntime,
    conn,
    executedAt: Date,
    { showNotFound = false, output = null } = {}
): Promise<void> {
    const MAX_ATTEMPTS = 5;
    const RETRY_DELAY_MS = [1500, 2000, 2500, 3000, 3000];
    const isoTs = executedAt.toISOString().replace(/\.\d+Z$/, 'Z');

    let logId: string | null = null;
    try {
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            await new Promise(resolve =>
                setTimeout(resolve, RETRY_DELAY_MS[attempt] ?? 3000)
            );
            const logs = await connectionRuntime.withToolingClientAuthed(conn, async client => {
                return await client.toolingQueryAll(
                    `SELECT Id FROM ApexLog WHERE StartTime >= ${isoTs} ORDER BY StartTime DESC LIMIT 1`
                );
            });
            logId = logs?.[0]?.Id || null;
            if (logId) break;
        }

        if (!logId) {
            if (showNotFound) {
                const msg = 'No debug log found. Make sure a Trace Flag is active for your user (Salesforce: Enable Debug Logs).';
                if (output) {
                    (output as any).appendLine?.(`[Execute Anonymous] ${msg}`);
                    (output as any).show?.(true);
                }
                await vscode.window.showWarningMessage(msg);
            }
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
        if (output) {
            (output as any).appendLine?.(`[Execute Anonymous] Log saved → ${logUri.path}`);
        }
        try {
            const logDoc = await vscode.workspace.openTextDocument(logUri);
            // Mark it as an Apex log so Lana's decorations/CodeLens activate
            try {
                await vscode.languages.setTextDocumentLanguage(logDoc, 'apexlog');
            } catch {
                // ignore — language may not be registered yet
            }
            await vscode.window.showTextDocument(logDoc, { preview: false });
            // Open the Lana visual log analyzer
            try {
                await vscode.commands.executeCommand('lana.showLogAnalysis', logUri);
            } catch {
                // Lana extension may not be loaded — the raw file is still shown
            }
        } catch {
            // ignore — file is still on disk even if we can't open it
        }
    } catch {
        // Debug logs might not be enabled or query failed — silently skip
    }
}

/**
 * Parses a StackTrace string from ApexTestResult and returns the 0-based line number.
 * StackTrace format: "Class.ClassName.methodName: line 42, column 1\n..."
 */
function parseStackTraceLine(stackTrace: string): number {
    const match = String(stackTrace || '').match(/line\s+(\d+)/i);
    if (!match) return 0;
    const line = Number(match[1]);
    return Number.isFinite(line) && line > 0 ? line - 1 : 0;
}

/**
 * Builds a Map<classId, localFilePath> from the tooling-map items.
 */
function buildIdToPathMap(mapItems): Map<string, string> {
    const idToPath = new Map<string, string>();
    for (const [path, entry] of Object.entries(mapItems || {}) as Array<
        [string, { type?: string; id?: string }]
    >) {
        if (entry?.type === 'ApexClass' && entry?.id) {
            idToPath.set(String(entry.id), path);
        }
    }
    return idToPath;
}

export function registerQueryAndApexTools({
    connectionRuntime,
    context,
    deployTools,
    commandGroups = ['all'],
}) {
    const { diagnostics, output, vscode } = context;
    const activeGroups = new Set(
        Array.isArray(commandGroups) && commandGroups.length ? commandGroups : ['all']
    );
    const hasGroup = group => activeGroups.has('all') || activeGroups.has(group);
    const registeredCommandGroups = new Set();

    const traceFlagServices = createTraceFlagServices(connectionRuntime);
    const ensureCurrentUserId = conn => ensureCurrentUserIdShared(connectionRuntime, conn);

    function register(command, handler) {
        return context.addDisposable(vscode.commands.registerCommand(command, handler));
    }

    /**
     * Fetches all Apex test classes from the org using the Tooling REST test discovery
     * endpoint (API v65+). Returns an array of { id, name, testMethods: [{ name, line }] }.
     * Falls back to a SOQL query if the endpoint is unavailable.
     */
    async function discoverTestClasses(conn) {
        try {
            const result = await connectionRuntime.withToolingClientAuthed(
                conn,
                async client => await client.requestJson('/tooling/tests?showAllMethods=true')
            );
            if (Array.isArray(result?.classes)) {
                return (result.classes as Array<Record<string, unknown>>).map(cls => ({
                    id: String(cls.id || ''),
                    name: String(cls.name || ''),
                    testMethods: Array.isArray(cls.testMethods)
                        ? (cls.testMethods as Array<Record<string, unknown>>).map(m => ({
                              name: String(m.name || ''),
                              line: Number(m.line || 0),
                          }))
                        : [],
                }));
            }
        } catch {
            // fall through to SOQL fallback
        }
        // SOQL fallback for older API versions or when the endpoint is unavailable
        const rows = await connectionRuntime.withToolingClientAuthed(
            conn,
            async client =>
                await client.toolingQueryAll(
                    "SELECT Id, Name FROM ApexClass WHERE Name LIKE '%Test%' ORDER BY Name LIMIT 500"
                )
        );
        return (rows || []).map(row => ({
            id: String(row?.Id || ''),
            name: String(row?.Name || ''),
            testMethods: [] as Array<{ name: string; line: number }>,
        }));
    }

    /**
     * Shared test execution engine. Accepts either:
     *   { classIds: string[] }                               — run all methods in these classes
     *   { tests: [{ classId, testMethods: string[] }] }      — run specific methods
     *
     * Handles polling, result collection, diagnostics, output-panel logging, and the
     * Markdown report. Adapted from the salesforcedx-vscode-apex-testing patterns.
     */
    async function executeApexTestRun(
        conn,
        payload: { classIds: string[] } | { tests: Array<{ classId: string; testMethods: string[] }> },
        classIdToName: Map<string, string>,
        idToPath: Map<string, string>
    ) {
        // Collect all class IDs involved so we can query coverage later
        const allClassIds: string[] = 'classIds' in payload
            ? payload.classIds
            : payload.tests.map(t => t.classId);

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
                        body: payload,
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
                                `SELECT Id, Status, ApexClassId, ExtendedStatus FROM ApexTestQueueItem WHERE ParentJobId='${jobId}'`
                            );
                        const total = rows?.length || 0;
                        const doneCount = (rows || []).filter(row =>
                            ['Completed', 'Aborted', 'Failed'].includes(String(row?.Status || ''))
                        ).length;
                        progress.report({ message: total ? `${doneCount}/${total} done` : 'Queued…' });
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
        const passes = (results || []).filter(row => String(row?.Outcome || '') === 'Pass');

        let coverageRows = [];
        try {
            if (allClassIds.length) {
                const inList = allClassIds.map(id => `'${id.replace(/'/g, "\\\\'")}'`).join(',');
                coverageRows = await connectionRuntime.withToolingClientAuthed(
                    conn,
                    async client =>
                        await client.toolingQueryAll(
                            `SELECT ApexClassOrTriggerId, NumLinesCovered, NumLinesUncovered FROM ApexCodeCoverageAggregate WHERE ApexClassOrTriggerId IN (${inList})`
                        )
                );
            }
        } catch {
            // ignore
        }
        const coverageById = new Map(
            (coverageRows || []).map(row => [String(row?.ApexClassOrTriggerId || ''), row])
        );

        // --- Diagnostics with stack-trace line numbers (adapted from reference extension) ---
        try {
            if (diagnostics.apexTests) {
                diagnostics.apexTests.clear?.();
                const diagnosticsByUri = new Map();
                for (const failure of failures) {
                    const classId = String(failure?.ApexClassId || '');
                    const path = idToPath.get(classId);
                    if (!path) continue;
                    const uri = vscode.Uri.file(path);
                    const lineNum = parseStackTraceLine(String(failure?.StackTrace || ''));
                    const diagnostic = new vscode.Diagnostic(
                        new vscode.Range(lineNum, 0, lineNum, 1),
                        `${failure?.MethodName || 'test'}: ${failure?.Message || failure?.Outcome || 'Fail'}`,
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

        // --- Output panel (Salesforce (Workbench)) — always shown ---
        try {
            const logLines: string[] = [
                '',
                `=== Apex Test Run (${new Date().toLocaleString()}) ===`,
                `Job ID:  ${jobId}`,
                `Target:  ${connectionRuntime.loadStoredConn()?.instanceUrl || 'bridge'}`,
                `Tests:   ${(results || []).length} total  •  ${passes.length} passed  •  ${failures.length} failed`,
                '',
            ];
            if (failures.length) {
                logLines.push('Failures:');
                for (const f of failures) {
                    const classId = String(f?.ApexClassId || '');
                    const name = classIdToName.get(classId) || classId;
                    const lineNum = parseStackTraceLine(String(f?.StackTrace || ''));
                    logLines.push(`  FAIL  ${name}.${f?.MethodName || ''}${lineNum ? ` (line ${lineNum + 1})` : ''}`);
                    if (f?.Message) logLines.push(`        ${f.Message}`);
                    if (f?.StackTrace) logLines.push(`        ${String(f.StackTrace).split('\n')[0]}`);
                }
                logLines.push('');
            }
            if (passes.length) {
                logLines.push(`Success: ${passes.length} method(s) passed`);
                for (const p of passes) {
                    const classId = String(p?.ApexClassId || '');
                    const name = classIdToName.get(classId) || classId;
                    logLines.push(`  OK    ${name}.${p?.MethodName || ''}`);
                }
            }
            if (coverageRows.length) {
                logLines.push('');
                logLines.push('Coverage:');
                for (const [id] of classIdToName.entries()) {
                    const cov = coverageById.get(id);
                    if (!cov) continue;
                    const covered = Number(cov?.NumLinesCovered || 0);
                    const uncovered = Number(cov?.NumLinesUncovered || 0);
                    const pct = covered + uncovered
                        ? Math.round((covered / (covered + uncovered)) * 100)
                        : null;
                    if (pct != null) {
                        logLines.push(`  ${classIdToName.get(id) || id}  ${pct}%`);
                    }
                }
            }
            context.logLines(logLines);
            if (output) {
                output.show(true);
            }
        } catch {
            // ignore logging errors
        }

        // --- Markdown report ---
        const dir = getWorkspaceUri(vscode, '.salesforce/test-results');
        await ensureDir(vscode, dir);
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const reportUri = vscode.Uri.joinPath(dir, `apex-tests-${ts}.md`);
        const mdLines = [
            '# Apex Test Results',
            '',
            `- Job: \`${jobId}\``,
            `- Classes: ${allClassIds.length}`,
            `- Total results: ${(results || []).length}`,
            `- Failures: ${failures.length}`,
            '',
            '## Summary',
            '',
            ...allClassIds.map(id => {
                const name = classIdToName.get(id) || id;
                const coverage = coverageById.get(id);
                const covered = Number(coverage?.NumLinesCovered || 0);
                const uncovered = Number(coverage?.NumLinesUncovered || 0);
                const percentage = covered + uncovered
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
                      return `- **${name}.${failure?.MethodName || ''}**: ${failure?.Message || failure?.Outcome || 'Fail'}`;
                  })
                : ['(none)']),
            '',
        ];
        await writeTextFile(vscode, reportUri, mdLines.join('\n'), { skipCache: true });
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
    }

    if (hasGroup('apex') && !registeredCommandGroups.has('apex')) {
        registeredCommandGroups.add('apex');

        // -----------------------------------------------------------------------
        // CodeLens provider — detects test classes and individual test methods
        // via document-text scanning (no API call, no LSP dependency).
        // Adapted from the salesforcedx-vscode-apex-testing CodeLens approach.
        // -----------------------------------------------------------------------
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
                                const lenses = [];
                                const filePath = doc.uri?.path || '';

                                // Anonymous Apex lenses — .apex files inside an apex/ folder
                                const isAnonymousApex =
                                    /\.apex$/i.test(filePath) &&
                                    /\/apex\//i.test(filePath);
                                if (isAnonymousApex) {
                                    lenses.push(
                                        new vscode.CodeLens(top, {
                                            title: '$(play) Run Anonymous',
                                            command: 'salesforceMetadata.executeAnonymous',
                                            arguments: [],
                                        }),
                                        new vscode.CodeLens(top, {
                                            title: '$(list-flat) Run Anonymous with Logs',
                                            command: 'salesforceMetadata.executeAnonymousWithLogs',
                                            arguments: [],
                                        })
                                    );
                                    return lenses;
                                }

                                const docText = doc.getText();
                                const isTestClass = /@isTest\b/i.test(docText);
                                if (!isTestClass) return lenses;

                                const className =
                                    (doc.uri?.path || '').split('/').pop()?.replace(/\.cls$/i, '') || '';

                                // "Run All Tests" at the top of the file
                                lenses.push(
                                    new vscode.CodeLens(top, {
                                        title: 'Run All Tests',
                                        command: 'salesforceMetadata.runApexTestsCurrentFile',
                                        arguments: [doc.uri],
                                    })
                                );

                                // Per-method "Run Test" lenses
                                for (let i = 0; i < doc.lineCount; i++) {
                                    const lineText = doc.lineAt(i).text;
                                    if (
                                        /@isTest\b/i.test(lineText) ||
                                        /\btestMethod\b/i.test(lineText)
                                    ) {
                                        // Look ahead up to 3 lines for: [modifiers] void methodName(
                                        for (let j = i + 1; j <= i + 3 && j < doc.lineCount; j++) {
                                            const match = doc.lineAt(j).text.match(/\bvoid\s+(\w+)\s*\(/i);
                                            if (match) {
                                                const methodName = match[1];
                                                const range = new vscode.Range(j, 0, j, 0);
                                                lenses.push(
                                                    new vscode.CodeLens(range, {
                                                        title: 'Run Test',
                                                        command: 'salesforceMetadata.runApexTestMethod',
                                                        arguments: [{ className, methodName }],
                                                    })
                                                );
                                                break;
                                            }
                                        }
                                    }
                                }

                                return lenses;
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

        // -----------------------------------------------------------------------
        // salesforceMetadata.executeAnonymous
        // -----------------------------------------------------------------------
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

            await tryOpenExecutionLog(vscode, connectionRuntime, conn, executedAt, { output });

            if (compiled && success) {
                await vscode.window.showInformationMessage('Execute Anonymous succeeded.');
                return;
            }
            const details = [problem, stack].filter(Boolean).join('\n\n');
            await vscode.window.showErrorMessage(
                `Execute Anonymous failed.${details ? `\n\n${details}` : ''}`
            );
        });

        // -----------------------------------------------------------------------
        // salesforceMetadata.executeAnonymousWithLogs
        // Ensures a trace flag is active (creates/extends a 30-min WorkbenchDebug
        // flag for the current user), then executes anonymous Apex and polls for
        // the resulting ApexLog, opening it once available.
        // -----------------------------------------------------------------------
        register('salesforceMetadata.executeAnonymousWithLogs', async () => {
            let conn = connectionRuntime.loadStoredConn();
            if (!conn.instanceUrl || !conn.accessToken) {
                await vscode.window.showErrorMessage(
                    connectionRuntime.getInjectedConnectionRequiredMessage()
                );
                return;
            }

            // Capture the active editor NOW (before any async work that could shift focus)
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
                await vscode.window.showWarningMessage(
                    'No Apex code found. Open an Apex file or select code to execute.'
                );
                return;
            }
            const targetUri =
                doc?.uri || getWorkspaceUri(vscode, '.salesforce/execute-anonymous.apex');

            // Ensure a 30-minute trace flag exists for the current user
            let traceFlagOk = false;
            try {
                conn = await ensureCurrentUserId(conn);
                if (conn.userId) {
                    await traceFlagServices.ensureTraceFlag(conn, conn.userId, 30);
                    traceFlagOk = true;
                }
            } catch {
                // Non-fatal — continue and still try to fetch a log
            }

            if (!traceFlagOk && output) {
                output.appendLine(
                    '[Execute Anonymous] Warning: could not create/extend trace flag. A log may not be generated.'
                );
                output.show(true);
            }

            // Run the code and poll for the resulting log
            const executedAt = new Date(Date.now() - 1000);
            const result = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Executing anonymous Apex (with logs)…',
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

            // Always poll for the log (showNotFound so the user gets feedback)
            await tryOpenExecutionLog(vscode, connectionRuntime, conn, executedAt, {
                showNotFound: true,
                output,
            });

            if (compiled && success) {
                await vscode.window.showInformationMessage(
                    'Execute Anonymous succeeded. Check the opened log file for debug output.'
                );
                return;
            }
            const details = [problem, stack].filter(Boolean).join('\n\n');
            await vscode.window.showErrorMessage(
                `Execute Anonymous failed.${details ? `\n\n${details}` : ''}`
            );
        });

        // -----------------------------------------------------------------------
        // salesforceMetadata.runApexTests — picker-based class selector
        // Uses /tooling/tests?showAllMethods=true (falls back to SOQL %Test%)
        // -----------------------------------------------------------------------
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
                () => discoverTestClasses(conn)
            );

            const items = candidates
                .map(cls => ({
                    label: cls.name,
                    description: cls.id,
                    picked: Boolean(activeClassId && cls.id === activeClassId),
                    id: cls.id,
                    name: cls.name,
                }))
                .filter(item => item.id);
            if (!items.length) {
                await vscode.window.showWarningMessage('No Apex test classes found in org.');
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
            const idToPath = buildIdToPathMap(mapItems);

            await executeApexTestRun(conn, { classIds }, classIdToName, idToPath);
        });

        // -----------------------------------------------------------------------
        // salesforceMetadata.runApexTestsCurrentFile
        // Runs all tests in the currently active .cls file without a picker.
        // Also invoked from the "Run All Tests" CodeLens and the editor context menu.
        // -----------------------------------------------------------------------
        register('salesforceMetadata.runApexTestsCurrentFile', async (resourceUri?) => {
            const conn = connectionRuntime.loadStoredConn();
            if (!conn.instanceUrl || !conn.accessToken) {
                await vscode.window.showErrorMessage(
                    connectionRuntime.getInjectedConnectionRequiredMessage()
                );
                return;
            }
            const path =
                resourceUri?.path ||
                vscode.window?.activeTextEditor?.document?.uri?.path ||
                '';
            if (!path) {
                await vscode.window.showWarningMessage('No active Apex file.');
                return;
            }
            const className = path.split('/').pop()?.replace(/\.cls$/i, '') || '';
            if (!className) {
                await vscode.window.showWarningMessage('Could not determine Apex class name.');
                return;
            }

            // Resolve classId: prefer tooling-map.json, then fall back to org query
            const mapItems = await deployTools.loadToolingMapItems();
            const resolution = await deployTools.resolveCurrentToolingPath(path);
            let classId =
                resolution?.status === 'tooling' && resolution.entry?.type === 'ApexClass'
                    ? String(resolution.entry.id || '')
                    : '';
            if (!classId) {
                try {
                    const rows = await connectionRuntime.withToolingClientAuthed(
                        conn,
                        async client =>
                            await client.toolingQueryAll(
                                `SELECT Id FROM ApexClass WHERE Name='${className.replace(/'/g, "\\'")}' LIMIT 1`
                            )
                    );
                    classId = String(rows?.[0]?.Id || '');
                } catch {
                    // ignore
                }
            }
            if (!classId) {
                await vscode.window.showWarningMessage(
                    `Apex class "${className}" not found in org. Deploy it first.`
                );
                return;
            }

            const idToPath = buildIdToPathMap(mapItems);
            await executeApexTestRun(
                conn,
                { classIds: [classId] },
                new Map([[classId, className]]),
                idToPath
            );
        });

        // -----------------------------------------------------------------------
        // salesforceMetadata.runApexTestMethod
        // Runs a single test method. Invoked exclusively from CodeLens buttons.
        // Args: { className: string, methodName: string }
        // -----------------------------------------------------------------------
        register(
            'salesforceMetadata.runApexTestMethod',
            async (args: { className: string; methodName: string }) => {
                const conn = connectionRuntime.loadStoredConn();
                if (!conn.instanceUrl || !conn.accessToken) {
                    await vscode.window.showErrorMessage(
                        connectionRuntime.getInjectedConnectionRequiredMessage()
                    );
                    return;
                }
                const className = String(args?.className || '');
                const methodName = String(args?.methodName || '');
                if (!className || !methodName) {
                    await vscode.window.showWarningMessage(
                        'Missing className or methodName for test run.'
                    );
                    return;
                }

                let classId = '';
                try {
                    const rows = await connectionRuntime.withToolingClientAuthed(
                        conn,
                        async client =>
                            await client.toolingQueryAll(
                                `SELECT Id FROM ApexClass WHERE Name='${className.replace(/'/g, "\\'")}' LIMIT 1`
                            )
                    );
                    classId = String(rows?.[0]?.Id || '');
                } catch {
                    // ignore
                }
                if (!classId) {
                    await vscode.window.showWarningMessage(
                        `Apex class "${className}" not found in org. Deploy it first.`
                    );
                    return;
                }

                const mapItems = await deployTools.loadToolingMapItems();
                const idToPath = buildIdToPathMap(mapItems);
                await executeApexTestRun(
                    conn,
                    { tests: [{ classId, testMethods: [methodName] }] },
                    new Map([[classId, className]]),
                    idToPath
                );
            }
        );

        // -----------------------------------------------------------------------
        // salesforceMetadata.enableDebugLogs
        // -----------------------------------------------------------------------
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
                async () => {
                    await traceFlagServices.ensureTraceFlag(conn, conn.userId, minutesPick.minutes);
                }
            );

            await vscode.window.showInformationMessage(
                `Debug logs enabled for ${minutesPick.minutes} minutes.`
            );
        });

        // -----------------------------------------------------------------------
        // salesforceMetadata.openDebugLogs
        // -----------------------------------------------------------------------
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
