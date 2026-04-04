/* eslint-disable import/no-unresolved */
import {
    createBashInstance,
    createShellRunner,
    getApexExecutionExitCode,
    registerSalesforceShellCommands,
} from 'core/bash';

import { ensureDir, writeTextFile } from '../core/workspaceCache.js';
import { getWorkspacePath, getWorkspaceRootPath, getWorkspaceUri } from '../core/workspacePaths.js';

export function registerShellIntegration({ connectionRuntime, context }) {
    const { diagnostics, output, vscode } = context;

    function toShellOutputLines(result) {
        const lines = [
            '',
            `=== Shell (${new Date(result?.endedAt || Date.now()).toLocaleString()}) ===`,
            `Command: ${result?.command || ''}`,
            `CWD: ${result?.cwd || getWorkspaceRootPath(vscode)}`,
            `Exit code: ${Number(result?.exitCode ?? 1)}`,
        ];
        const stdout = String(result?.stdout || '').trim();
        const stderr = String(result?.stderr || '').trim();
        if (stdout) {
            lines.push('', '[stdout]', ...stdout.split('\n'));
        }
        if (stderr) {
            lines.push('', '[stderr]', ...stderr.split('\n'));
        }
        return lines;
    }

    async function ensureShellWorkspaceDir() {
        const dir = getWorkspaceUri(vscode, '.salesforce/shell');
        await ensureDir(vscode, dir);
        return dir;
    }

    async function writeShellErrorLog(result) {
        const dir = await ensureShellWorkspaceDir();
        const logUri = vscode.Uri.joinPath(dir, 'last-error.log');
        const text = [
            `Command: ${result?.command || ''}`,
            `CWD: ${result?.cwd || getWorkspaceRootPath(vscode)}`,
            `Exit code: ${Number(result?.exitCode ?? 1)}`,
            '',
            '[stderr]',
            String(result?.stderr || '').trim() || '(empty)',
            '',
            '[stdout]',
            String(result?.stdout || '').trim() || '(empty)',
            '',
        ].join('\n');
        await writeTextFile(vscode, logUri, text, { skipCache: true });
        return logUri;
    }

    function parseHeaderValues(headerValues) {
        const headers = {};
        for (const rawValue of headerValues || []) {
            const line = String(rawValue || '').trim();
            if (!line) continue;
            const index = line.indexOf(':');
            if (index <= 0) {
                throw new Error(`Invalid header "${line}". Expected "Name: Value".`);
            }
            const name = line.slice(0, index).trim();
            const value = line.slice(index + 1).trim();
            if (!name) {
                throw new Error(`Invalid header "${line}". Expected "Name: Value".`);
            }
            headers[name] = value;
        }
        return headers;
    }

    async function getShellOrgEntries() {
        const outputEntries = [];
        const pushEntry = entry => {
            if (!entry?.instanceUrl) return;
            const key = `${entry.instanceUrl}|${entry.alias || ''}|${entry.username || ''}`;
            if (
                outputEntries.some(
                    item => `${item.instanceUrl}|${item.alias || ''}|${item.username || ''}` === key
                )
            ) {
                return;
            }
            outputEntries.push(entry);
        };

        const current = connectionRuntime.loadStoredConn();
        if (current?.instanceUrl && current?.accessToken) {
            let host = current.instanceUrl;
            try {
                host = new URL(current.instanceUrl).host;
            } catch {
                // ignore
            }
            pushEntry({
                alias: current.username || host || 'current',
                username: current.username || '',
                instanceUrl: current.instanceUrl,
                sessionId: current.accessToken,
                authType: current.authType || 'current',
                label: host,
            });
        }

        try {
            const sharedConnections = await connectionRuntime.listSharedConnectionEntries();
            for (const item of sharedConnections) {
                const configuration = item?.configuration;
                if (!configuration?.instanceUrl) continue;
                pushEntry({
                    alias:
                        configuration.alias || configuration.username || item.host || 'saved-org',
                    username: configuration.username || '',
                    instanceUrl: configuration.instanceUrl || '',
                    sessionId: configuration.accessToken || '',
                    authType: connectionRuntime.getConnectionAuthType(configuration),
                    sharedAlias: configuration.alias || '',
                    label: item.host || configuration.instanceUrl || '',
                });
            }
        } catch {
            // ignore
        }

        if (connectionRuntime.isChromeExtensionEnv()) {
            try {
                const tabSessions = await globalThis.chrome?.runtime?.sendMessage({
                    action: 'listOrgSessions',
                });
                for (const item of Array.isArray(tabSessions) ? tabSessions : []) {
                    pushEntry({
                        alias: item?.label || item?.serverUrl || 'tab-session',
                        username: item?.label || '',
                        instanceUrl: item?.serverUrl || '',
                        sessionId: item?.sessionId || '',
                        authType: 'cookie',
                        label: item?.label || item?.serverUrl || '',
                    });
                }
            } catch {
                // ignore
            }
        }

        outputEntries.sort((left, right) =>
            String(left.alias || left.label || '').localeCompare(
                String(right.alias || right.label || '')
            )
        );
        return outputEntries;
    }

    async function ensureShellConn() {
        let conn = connectionRuntime.loadStoredConn();
        conn = await connectionRuntime
            .withToolingClientAuthed(conn, async (_client, effectiveConn) => effectiveConn)
            .catch(() => conn);
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.commands.executeCommand('salesforceMetadata.connect');
            conn = connectionRuntime.loadStoredConn();
        }
        if (!conn.instanceUrl || !conn.accessToken) {
            throw new Error('Not connected to Salesforce.');
        }
        return conn;
    }

    function createWorkbenchShellService() {
        const bash = createBashInstance();
        const runner = createShellRunner({ bash });
        const history = [];
        const listeners = new Set();

        registerSalesforceShellCommands({
            shell: bash,
            handlers: {
                async executeApex({ apexCode, sourceFilePath }) {
                    const conn = await ensureShellConn();
                    const result = await connectionRuntime.withToolingClientAuthed(
                        conn,
                        async client => {
                            return await client.requestJson(
                                `/tooling/executeAnonymous/?anonymousBody=${encodeURIComponent(
                                    apexCode
                                )}`
                            );
                        }
                    );
                    if (diagnostics.shell) {
                        try {
                            const targetUri = sourceFilePath
                                ? vscode.Uri.file(sourceFilePath)
                                : getWorkspaceUri(
                                      vscode,
                                      '.salesforce/shell/execute-anonymous.apex'
                                  );
                            if (!sourceFilePath) {
                                await ensureShellWorkspaceDir();
                                await writeTextFile(vscode, targetUri, apexCode, {
                                    skipCache: true,
                                });
                            }
                            if (result?.compiled && result?.success) {
                                diagnostics.shell.delete(targetUri);
                            } else {
                                const line = Number(result?.line);
                                const column = Number(result?.column);
                                const normalizedLine =
                                    Number.isFinite(line) && line > 0 ? line - 1 : 0;
                                const normalizedColumn =
                                    Number.isFinite(column) && column > 0 ? column - 1 : 0;
                                const range = new vscode.Range(
                                    normalizedLine,
                                    normalizedColumn,
                                    normalizedLine,
                                    normalizedColumn + 1
                                );
                                const diagnostic = new vscode.Diagnostic(
                                    range,
                                    result?.compileProblem ||
                                        result?.exceptionMessage ||
                                        'Execute Anonymous failed',
                                    vscode.DiagnosticSeverity.Error
                                );
                                diagnostic.source = 'salesforce shell';
                                diagnostics.shell.set(targetUri, [diagnostic]);
                            }
                        } catch {
                            // ignore
                        }
                    }
                    return {
                        exitCode: getApexExecutionExitCode(result),
                        result,
                    };
                },
                async executeSoql({ includeDeletedRecords, query, useToolingApi }) {
                    const conn = await ensureShellConn();
                    return {
                        result: await connectionRuntime.withToolingClientAuthed(
                            conn,
                            async client => {
                                const basePath = useToolingApi
                                    ? '/tooling/query'
                                    : includeDeletedRecords
                                      ? '/queryAll'
                                      : '/query';
                                const first = await client.requestJson(
                                    `${basePath}?q=${encodeURIComponent(query)}`
                                );
                                const pages = [first];
                                let nextUrl = first?.nextRecordsUrl;
                                while (nextUrl) {
                                    // eslint-disable-next-line no-await-in-loop
                                    const page = await client.requestJson(nextUrl);
                                    pages.push(page);
                                    nextUrl = page?.nextRecordsUrl;
                                }
                                return {
                                    allRows: Boolean(includeDeletedRecords),
                                    query,
                                    records: pages.flatMap(page => page?.records || []),
                                    tooling: Boolean(useToolingApi),
                                    totalSize: Number(
                                        first?.totalSize ??
                                            pages.flatMap(page => page?.records || []).length
                                    ),
                                };
                            }
                        ),
                    };
                },
                async executeApi({ body, endpoint, headerValues, method }) {
                    const conn = await ensureShellConn();
                    const parsedHeaders = parseHeaderValues(headerValues);
                    let parsedBody;
                    if (body) {
                        try {
                            parsedBody = JSON.parse(body);
                        } catch {
                            throw new Error('API request body must be valid JSON.');
                        }
                    }
                    return {
                        result: await connectionRuntime.withToolingClientAuthed(
                            conn,
                            async client => {
                                const text = await client.requestText(endpoint, {
                                    method,
                                    body: parsedBody,
                                    headers: parsedHeaders,
                                });
                                try {
                                    return JSON.parse(text);
                                } catch {
                                    return text;
                                }
                            }
                        ),
                    };
                },
                async listOrgs() {
                    return { result: await getShellOrgEntries() };
                },
                async openOrg({ alias }) {
                    const targets = await getShellOrgEntries();
                    const normalized = String(alias || '')
                        .trim()
                        .toLowerCase();
                    const match = targets.find(entry => {
                        let host = '';
                        try {
                            host = new URL(entry.instanceUrl).host;
                        } catch {
                            // ignore
                        }
                        return [entry.alias, entry.username, entry.label, entry.instanceUrl, host]
                            .filter(Boolean)
                            .some(value => String(value).trim().toLowerCase() === normalized);
                    });
                    if (!match) {
                        throw new Error(
                            `Unknown org alias "${alias}". Run "sf org list" to inspect available aliases.`
                        );
                    }
                    const url = match.sessionId
                        ? `${String(match.instanceUrl).replace(
                              /\/+$/,
                              ''
                          )}/secur/frontdoor.jsp?sid=${encodeURIComponent(match.sessionId)}`
                        : match.instanceUrl;
                    await vscode.env.openExternal(vscode.Uri.parse(url));
                    return { result: `Opened org ${match.alias || alias}` };
                },
            },
        });

        return {
            getCwd() {
                return runner.getCwd();
            },
            getHistory() {
                return history.slice();
            },
            onDidRun(listener) {
                listeners.add(listener);
                return {
                    dispose() {
                        listeners.delete(listener);
                    },
                };
            },
            async run(command, { cwd, source } = {}) {
                const startedAt = Date.now();
                const result = await runner.run(command, { cwd });
                const event = {
                    ...result,
                    source: source || 'command',
                    startedAt,
                    endedAt: Date.now(),
                };
                history.push(event);
                if (history.length > 100) history.shift();
                for (const listener of listeners) {
                    try {
                        listener(event);
                    } catch {
                        // ignore
                    }
                }
                return event;
            },
        };
    }

    const shellService = createWorkbenchShellService();
    let shellTerminalController = null;

    context.addDisposable(
        shellService.onDidRun(async result => {
            context.logLines(toShellOutputLines(result));
            if (!result || Number(result.exitCode) === 0 || !diagnostics.shell) {
                return;
            }
            try {
                const logUri = await writeShellErrorLog(result);
                const diagnostic = new vscode.Diagnostic(
                    new vscode.Range(0, 0, 0, 1),
                    String(result.stderr || result.stdout || 'Shell command failed'),
                    vscode.DiagnosticSeverity.Error
                );
                diagnostic.source = 'salesforce shell';
                diagnostics.shell.set(logUri, [diagnostic]);
            } catch {
                // ignore
            }
        })
    );

    function ensureShellTerminal() {
        if (shellTerminalController) return shellTerminalController;

        const writeEmitter = new vscode.EventEmitter();
        const closeEmitter = new vscode.EventEmitter();
        let inputBuffer = '';
        let isRunning = false;
        let terminal = null;

        const write = value => {
            if (!value) return;
            writeEmitter.fire(String(value || '').replace(/\r?\n/g, '\r\n'));
        };
        const prompt = () => `sf-shell:${shellService.getCwd()}$ `;
        const renderPrompt = () => {
            write(`\r\n${prompt()}`);
        };

        const runCommand = async (command, { echoCommand = false, source = 'terminal' } = {}) => {
            const text = String(command || '');
            const trimmed = text.trim();
            if (!trimmed) {
                renderPrompt();
                return null;
            }
            if (trimmed === 'clear') {
                writeEmitter.fire('\x1bc');
                write(prompt());
                return null;
            }
            if (trimmed === 'exit') {
                closeEmitter.fire();
                return null;
            }
            if (isRunning) {
                write('\r\n[busy] Waiting for the current shell command to finish.');
                renderPrompt();
                return null;
            }

            isRunning = true;
            try {
                if (echoCommand) {
                    write(`\r\n${prompt()}${text}\r\n`);
                } else {
                    write('\r\n');
                }
                const result = await shellService.run(text, {
                    cwd: shellService.getCwd(),
                    source,
                });
                if (result.stdout) write(result.stdout);
                if (result.stderr) write(result.stderr);
                if (!result.stdout && !result.stderr) {
                    write(`[exit ${Number(result.exitCode ?? 0)}]`);
                }
                renderPrompt();
                return result;
            } finally {
                isRunning = false;
            }
        };

        const pty = {
            onDidWrite: writeEmitter.event,
            onDidClose: closeEmitter.event,
            open: () => {
                write('Salesforce Shell');
                write(
                    `\r\nType sf commands like "sf org list", "sf data query --query \\"SELECT Id FROM Account LIMIT 5\\"" or "sf apex run --file ${getWorkspacePath(
                        vscode,
                        '.salesforce/shell/execute-anonymous.apex'
                    )}".`
                );
                write(`\r\n${prompt()}`);
            },
            close: () => {
                shellTerminalController = null;
                try {
                    writeEmitter.dispose();
                    closeEmitter.dispose();
                } catch {
                    // ignore
                }
            },
            handleInput: async data => {
                if (data === '\r') {
                    const command = inputBuffer;
                    inputBuffer = '';
                    await runCommand(command, { source: 'terminal' });
                    return;
                }
                if (data === '\u007F') {
                    if (!inputBuffer) return;
                    inputBuffer = inputBuffer.slice(0, -1);
                    writeEmitter.fire('\b \b');
                    return;
                }
                if (data === '\u0003') {
                    write('^C');
                    inputBuffer = '';
                    renderPrompt();
                    return;
                }
                if (!data || data.startsWith('\u001b')) return;
                inputBuffer += data;
                writeEmitter.fire(data);
            },
        };

        terminal = vscode.window.createTerminal({
            name: 'Salesforce Shell',
            pty,
        });

        shellTerminalController = {
            dispose() {
                try {
                    terminal?.dispose?.();
                } catch {
                    // ignore
                }
            },
            async runCommand(command, options = {}) {
                if (options.reveal !== false) {
                    terminal?.show?.(true);
                }
                return await runCommand(command, {
                    echoCommand: true,
                    source: options.source || 'command',
                });
            },
            show(preserveFocus = false) {
                terminal?.show?.(preserveFocus);
            },
        };

        context.addDisposable(shellTerminalController);
        return shellTerminalController;
    }

    async function runShellCommand(command, { reveal = true, source = 'command' } = {}) {
        const text = String(command || '').trim();
        if (!text) return null;
        try {
            diagnostics.shell?.clear?.();
        } catch {
            // ignore
        }
        const terminal = ensureShellTerminal();
        const result = await terminal.runCommand(text, { reveal, source });
        if (result && Number(result.exitCode) !== 0) {
            const message = `Shell command failed (${result.exitCode}): ${text}`;
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
        }
        return result;
    }

    context.addDisposable(
        vscode.commands.registerCommand('salesforceMetadata.showOutput', async () => {
            if (!output) {
                await vscode.window.showWarningMessage(
                    'Output channel is not available in this runtime.'
                );
                return;
            }
            try {
                output.show(true);
            } catch {
                // ignore
            }
        })
    );

    context.addDisposable(
        vscode.commands.registerCommand('salesforceMetadata.openShellTerminal', async () => {
            ensureShellTerminal().show(true);
        })
    );

    context.addDisposable(
        vscode.commands.registerCommand('salesforceMetadata.runShellCommand', async () => {
            const editor = vscode.window?.activeTextEditor;
            const selected =
                editor?.document && editor?.selection && !editor.selection.isEmpty
                    ? editor.document.getText(editor.selection)
                    : '';
            const command = await vscode.window.showInputBox({
                title: 'Run Salesforce Shell Command',
                prompt: 'Examples: sf org list, sf data query --query "SELECT Id FROM Account LIMIT 5"',
                value: selected?.trim() || 'sf ',
                ignoreFocusOut: true,
            });
            if (!command) return;
            await runShellCommand(command, { source: 'palette', reveal: true });
        })
    );

    return {
        runShellCommand,
    };
}
