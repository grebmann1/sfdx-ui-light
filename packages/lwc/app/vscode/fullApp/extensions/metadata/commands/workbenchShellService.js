/* eslint-disable import/no-unresolved */
import {
    createBashInstance,
    createShellRunner,
    getApexExecutionExitCode,
    registerSalesforceShellCommands,
} from 'core/bash';

import { ensureDir, writeTextFile } from '../core/workspaceCache.js';
import { getWorkspaceRootPath, getWorkspaceUri } from '../core/workspacePaths.js';

async function ensureShellWorkspaceDir(vscode) {
    const dir = getWorkspaceUri(vscode, '.salesforce/shell');
    await ensureDir(vscode, dir);
    return dir;
}

async function getShellOrgEntries(connectionRuntime) {
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
                alias: configuration.alias || configuration.username || item.host || 'saved-org',
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

async function ensureShellConn(connectionRuntime, vscode) {
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

export function createWorkbenchShellService({ connectionRuntime, context }) {
    const { diagnostics, vscode } = context;
    const bash = createBashInstance();
    const runner = createShellRunner({ bash });
    const history = [];
    const listeners = new Set();

    registerSalesforceShellCommands({
        shell: bash,
        handlers: {
            async executeApex({ apexCode, sourceFilePath }) {
                const conn = await ensureShellConn(connectionRuntime, vscode);
                const result = await connectionRuntime.withToolingClientAuthed(
                    conn,
                    async client => {
                        return await client.requestJson(
                            `/tooling/executeAnonymous/?anonymousBody=${encodeURIComponent(apexCode)}`
                        );
                    }
                );
                if (diagnostics.shell) {
                    try {
                        const targetUri = sourceFilePath
                            ? vscode.Uri.file(sourceFilePath)
                            : getWorkspaceUri(vscode, '.salesforce/shell/execute-anonymous.apex');
                        if (!sourceFilePath) {
                            await ensureShellWorkspaceDir(vscode);
                            await writeTextFile(vscode, targetUri, apexCode, {
                                skipCache: true,
                            });
                        }
                        if (result?.compiled && result?.success) {
                            diagnostics.shell.delete(targetUri);
                        } else {
                            const line = Number(result?.line);
                            const column = Number(result?.column);
                            const normalizedLine = Number.isFinite(line) && line > 0 ? line - 1 : 0;
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
                const conn = await ensureShellConn(connectionRuntime, vscode);
                return {
                    result: await connectionRuntime.withToolingClientAuthed(conn, async client => {
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
                    }),
                };
            },
            async executeApi({ body, endpoint, headerValues, method }) {
                const conn = await ensureShellConn(connectionRuntime, vscode);
                const parsedHeaders = {};
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
                    parsedHeaders[name] = value;
                }
                let parsedBody;
                if (body) {
                    try {
                        parsedBody = JSON.parse(body);
                    } catch {
                        throw new Error('API request body must be valid JSON.');
                    }
                }
                return {
                    result: await connectionRuntime.withToolingClientAuthed(conn, async client => {
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
                    }),
                };
            },
            async listOrgs() {
                return { result: await getShellOrgEntries(connectionRuntime) };
            },
            async openOrg({ alias }) {
                const targets = await getShellOrgEntries(connectionRuntime);
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

export function getShellOutputLines(result, vscode) {
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
