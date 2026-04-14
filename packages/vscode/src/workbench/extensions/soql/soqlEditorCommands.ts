import { runAndShowSoqlQueryPlan } from './soqlQueryPlan';
import { executeSoqlQuery } from './soqlQueryRunner';
import { ensureDir, writeTextFile } from '../metadata/core/workspaceCache';
import { getSalesforceStateDirUri, getWorkspaceUri } from '../metadata/core/workspacePaths';

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

function getDocumentFileName(uri) {
    const path = String(uri?.path || uri?.fsPath || '');
    if (!path) return 'SOQL Query';
    const parts = path.split('/');
    return parts[parts.length - 1] || 'SOQL Query';
}

export function registerSoqlEditorCommands({
    connectionRuntime,
    context,
    soqlUi,
}: {
    connectionRuntime: any;
    context: any;
    soqlUi?: { showQueryResults?: (payload: unknown) => Promise<unknown> } | null;
}) {
    const { vscode } = context;

    function register(command, handler) {
        return context.addDisposable(vscode.commands.registerCommand(command, handler));
    }

    async function showQueryResultsWithUi(result, documentName) {
        if (!result || typeof soqlUi?.showQueryResults !== 'function') {
            return false;
        }
        try {
            return Boolean(
                await soqlUi.showQueryResults({
                    ...result,
                    documentName,
                })
            );
        } catch {
            return false;
        }
    }

    async function runQuery({ soql, tooling }) {
        const conn = connectionRuntime.loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.window.showErrorMessage(
                connectionRuntime.getInjectedConnectionRequiredMessage()
            );
            return null;
        }
        return executeSoqlQuery({ connectionRuntime, conn, soql, tooling });
    }

    async function writeQueryResults({ query, records, tooling, totalSize }) {
        const dir = getWorkspaceUri(vscode, '.salesforce/query-results');
        await ensureDir(vscode, dir);
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const baseName = `${tooling ? 'tooling' : 'soql'}-${ts}`;
        const mdUri = vscode.Uri.joinPath(dir, `${baseName}.md`);
        const jsonUri = vscode.Uri.joinPath(dir, `${baseName}.json`);
        const csvUri = vscode.Uri.joinPath(dir, `${baseName}.csv`);

        const flattened = (records || []).map(flattenRecord) as Record<string, string>[];
        const columns = Array.from(
            flattened.reduce((set: Set<string>, row: Record<string, string>) => {
                for (const key of Object.keys(row || {})) set.add(key);
                return set;
            }, new Set<string>())
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

    const runQueryWithUiFallback = async ({
        soql,
        tooling,
        title,
        documentName,
    }: {
        soql: string;
        tooling: boolean;
        title: string;
        documentName?: string;
    }) => {
        const result = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title,
                cancellable: false,
            },
            async () => await runQuery({ tooling, soql })
        );
        if (!result) return;
        const shownInUi = await showQueryResultsWithUi(result, documentName);
        if (!shownInUi) {
            await writeQueryResults(result);
        }
    };

    const runExplainPlan = async (soql: string) => {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Running SOQL explain plan…',
                cancellable: false,
            },
            async () =>
                await runAndShowSoqlQueryPlan({
                    connectionRuntime,
                    outputChannel: context.output,
                    vscode,
                    soql,
                })
        );
    };

    const pickQueryApi = async () => {
        const picked = await vscode.window.showQuickPick(
            [
                {
                    label: 'REST API',
                    description: 'Query data from standard objects',
                    tooling: false,
                },
                {
                    label: 'Tooling API',
                    description: 'Query metadata/tooling objects',
                    tooling: true,
                },
            ],
            {
                title: 'Run Query With',
                placeHolder: 'Choose an API',
                ignoreFocusOut: true,
            }
        );
        if (!picked) return null;
        return Boolean(picked.tooling);
    };

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
        await runQueryWithUiFallback({
            soql,
            tooling: false,
            title: 'Running SOQL query…',
            documentName: editor?.document
                ? getDocumentFileName(editor.document.uri)
                : undefined,
        });
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
        await runQueryWithUiFallback({
            soql,
            tooling: true,
            title: 'Running Tooling query…',
            documentName: editor?.document
                ? getDocumentFileName(editor.document.uri)
                : undefined,
        });
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
        await runQueryWithUiFallback({
            soql,
            tooling: false,
            title: 'Running SOQL query…',
            documentName: getDocumentFileName(uri),
        });
    });

    register('salesforceMetadata._runToolingEditorDoc', async uriArg => {
        const uri = await toUri(uriArg);
        const soql = await readSelectionOrDocumentText(uri);
        await runQueryWithUiFallback({
            soql,
            tooling: true,
            title: 'Running Tooling query…',
            documentName: getDocumentFileName(uri),
        });
    });

    register('salesforceMetadata._explainSoqlEditorDoc', async uriArg => {
        const uri = await toUri(uriArg);
        const soql = await readSelectionOrDocumentText(uri);
        if (!String(soql || '').trim()) {
            await vscode.window.showInformationMessage('Select or open a SOQL query first.');
            return;
        }
        await runExplainPlan(soql);
    });

    register('sf.data.query.selection', async () => {
        const editor = vscode.window?.activeTextEditor;
        const hasSelection = Boolean(editor?.selection && !editor.selection.isEmpty);
        if (!editor?.document || !hasSelection) {
            await vscode.window.showInformationMessage(
                'Select a SOQL query in the active editor first.'
            );
            return;
        }
        const queryApiTooling = await pickQueryApi();
        if (queryApiTooling == null) return;
        const soql = editor.document.getText(editor.selection);
        await runQueryWithUiFallback({
            soql,
            tooling: queryApiTooling,
            title: queryApiTooling ? 'Running Tooling query…' : 'Running SOQL query…',
            documentName: getDocumentFileName(editor.document.uri),
        });
    });

    register('sf.data.query.document', async () => {
        const editor = vscode.window?.activeTextEditor;
        if (!editor?.document) {
            await vscode.window.showInformationMessage('Open a .soql document first.');
            return;
        }
        const queryApiTooling = await pickQueryApi();
        if (queryApiTooling == null) return;
        const soql = editor.document.getText?.() || '';
        await runQueryWithUiFallback({
            soql,
            tooling: queryApiTooling,
            title: queryApiTooling ? 'Running Tooling query…' : 'Running SOQL query…',
            documentName: getDocumentFileName(editor.document.uri),
        });
    });

    register('sf.data.query.explain.selection', async () => {
        const editor = vscode.window?.activeTextEditor;
        const hasSelection = Boolean(editor?.selection && !editor.selection.isEmpty);
        if (!editor?.document || !hasSelection) {
            await vscode.window.showInformationMessage(
                'Select a SOQL query in the active editor first.'
            );
            return;
        }
        const soql = editor.document.getText(editor.selection);
        await runExplainPlan(soql);
    });

    register('sf.data.query.explain.document', async () => {
        const editor = vscode.window?.activeTextEditor;
        if (!editor?.document) {
            await vscode.window.showInformationMessage('Open a .soql document first.');
            return;
        }
        await runExplainPlan(editor.document.getText?.() || '');
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
                                new vscode.CodeLens(top, {
                                    title: 'Explain SOQL',
                                    command: 'salesforceMetadata._explainSoqlEditorDoc',
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
}
