/* eslint-disable import/no-unresolved */
import {
    ITerminalChildProcess,
    SimpleTerminalBackend,
    SimpleTerminalProcess,
} from '@codingame/monaco-vscode-terminal-service-override';
import * as vscode from 'vscode';
import { Bash } from 'just-bash';
import { connectIframeFsBridgeClient } from 'vscode/bridge/iframeFsBridgeClient';
import { getIframeBridgeWorkspaceRoot, isIframeFsBridgeEnabled } from 'vscode/bridge/bootstrapIframeBridge';
import { getApexExecutionExitCode } from '../core/bash';
import { BridgeFsAdapter } from './bridgeFsAdapter';

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------

const ANSI = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    brightBlack: '\x1b[90m',
};

function colorize(value, ...styles) {
    const text = String(value ?? '');
    if (!text || styles.length === 0) return text;
    return `${styles.join('')}${text}${ANSI.reset}`;
}

// ---------------------------------------------------------------------------
// Lazy config — set by the terminal extension activation before any terminal
// is opened, so it is always available when SalesforceTerminalProcess.start()
// runs.
// ---------------------------------------------------------------------------

interface SalesforceTerminalConfig {
    connectionRuntime: unknown;
    vscode: typeof vscode;
}

let terminalConfig: SalesforceTerminalConfig | null = null;

export function configureSalesforceTerminal(config: SalesforceTerminalConfig): void {
    terminalConfig = config;
}

// ---------------------------------------------------------------------------
// Salesforce shell handlers (Apex, SOQL, REST, org list/open)
// ---------------------------------------------------------------------------

async function getShellOrgEntries(connectionRuntime) {
    const outputEntries: Array<{
        alias: string;
        username: string;
        instanceUrl: string;
        sessionId: string;
        authType: string;
        label: string;
    }> = [];
    const current = (connectionRuntime as any).loadStoredConn();
    if (current?.instanceUrl && current?.accessToken) {
        let host = current.instanceUrl;
        try {
            host = new URL(current.instanceUrl).host;
        } catch {
            // ignore
        }
        outputEntries.push({
            alias: current.username || host || 'current',
            username: current.username || '',
            instanceUrl: current.instanceUrl,
            sessionId: current.accessToken,
            authType: current.authType || 'current',
            label: host,
        });
    }
    outputEntries.sort((a, b) =>
        String(a.alias || a.label || '').localeCompare(String(b.alias || b.label || ''))
    );
    return outputEntries;
}

async function ensureConn(connectionRuntime, vs: typeof vscode) {
    let conn = (connectionRuntime as any).loadStoredConn();
    conn = await (connectionRuntime as any)
        .withToolingClientAuthed(conn, async (_client, effectiveConn) => effectiveConn)
        .catch(() => conn);
    if (!conn.instanceUrl || !conn.accessToken) {
        await vs.window.showErrorMessage(
            (connectionRuntime as any).getInjectedConnectionRequiredMessage()
        );
        conn = (connectionRuntime as any).loadStoredConn();
    }
    if (!conn.instanceUrl || !conn.accessToken) {
        throw new Error('Not connected to Salesforce.');
    }
    return conn;
}

function buildSalesforceHandlers(connectionRuntime, vs: typeof vscode) {
    return {
        async executeApex({ apexCode, sourceFilePath: _sf }) {
            const conn = await ensureConn(connectionRuntime, vs);
            const result = await (connectionRuntime as any).withToolingClientAuthed(
                conn,
                async client => {
                    return await client.requestJson(
                        `/tooling/executeAnonymous/?anonymousBody=${encodeURIComponent(apexCode)}`
                    );
                }
            );
            return { exitCode: getApexExecutionExitCode(result), result };
        },

        async executeSoql({ query, useToolingApi, includeDeletedRecords }) {
            const conn = await ensureConn(connectionRuntime, vs);
            return {
                result: await (connectionRuntime as any).withToolingClientAuthed(
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
                                first?.totalSize ?? pages.flatMap(p => p?.records || []).length
                            ),
                        };
                    }
                ),
            };
        },

        async executeApi({ body, endpoint, headerValues, method }) {
            const conn = await ensureConn(connectionRuntime, vs);
            const parsedHeaders: Record<string, string> = {};
            for (const rawValue of headerValues || []) {
                const line = String(rawValue || '').trim();
                if (!line) continue;
                const index = line.indexOf(':');
                if (index <= 0)
                    throw new Error(`Invalid header "${line}". Expected "Name: Value".`);
                const name = line.slice(0, index).trim();
                const value = line.slice(index + 1).trim();
                if (!name) throw new Error(`Invalid header "${line}". Expected "Name: Value".`);
                parsedHeaders[name] = value;
            }
            let parsedBody: unknown;
            if (body) {
                try {
                    parsedBody = JSON.parse(body);
                } catch {
                    throw new Error('API request body must be valid JSON.');
                }
            }
            return {
                result: await (connectionRuntime as any).withToolingClientAuthed(
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
                    .some(v => String(v).trim().toLowerCase() === normalized);
            });
            if (!match) {
                throw new Error(
                    `Unknown org alias "${alias}". Run "sf org list" to inspect available aliases.`
                );
            }
            const url = match.sessionId
                ? `${String(match.instanceUrl).replace(/\/+$/, '')}/secur/frontdoor.jsp?sid=${encodeURIComponent(match.sessionId)}`
                : match.instanceUrl;
            await vs.env.openExternal(vs.Uri.parse(url));
            return { result: `Opened org ${match.alias || alias}` };
        },
    };
}

// ---------------------------------------------------------------------------
// Backend
// ---------------------------------------------------------------------------

class SalesforceTerminalBackend extends SimpleTerminalBackend {
    override getDefaultSystemShell = async (): Promise<string> => 'bash';

    override createProcess = async (): Promise<ITerminalChildProcess> => {
        const dataEmitter = new vscode.EventEmitter<string>();
        const workspaceRoot = getIframeBridgeWorkspaceRoot() || '/workspace';

        // Inner class captures dataEmitter + workspaceRoot from the closure.
        // Each terminal instance gets its own independent PTY state (buffer,
        // history, cwd) while sharing the same bridge connection.
        class SalesforceTerminalProcess extends SimpleTerminalProcess {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            private bash: InstanceType<typeof Bash> | null = null;
            private inputBuffer = '';
            private isRunning = false;
            private lastExitCode = 0;
            private currentCwd = workspaceRoot;
            private history: string[] = [];
            private historyIndex = -1;
            private savedInput = '';

            // ----- output helpers -----

            private write(value: string): void {
                if (!value) return;
                dataEmitter.fire(String(value).replace(/\r?\n/g, '\r\n'));
            }

            // Emit OSC 7 (set-cwd) so VS Code adds CwdDetection capability and
            // removes the fallback Enter-key listener that otherwise throws
            // "cwd is not a string undefined".
            private emitCwdSequence(): void {
                const encoded = encodeURIComponent(this.currentCwd).replace(/%2F/g, '/');
                dataEmitter.fire(`\x1b]7;file://localhost${encoded}\x07`);
            }

            private prompt(): string {
                const exitMark =
                    this.lastExitCode !== 0
                        ? colorize(`[${this.lastExitCode}] `, ANSI.bold, ANSI.red)
                        : '';
                const dollar = colorize(
                    '$',
                    this.lastExitCode !== 0 ? ANSI.red : ANSI.green
                );
                return `${colorize('sf-terminal', ANSI.bold, ANSI.cyan)}:${colorize(this.currentCwd, ANSI.brightBlack)} ${exitMark}${dollar} `;
            }

            // Rewrite the current line (used for history navigation and tab-completion).
            private rewriteLine(content: string): void {
                dataEmitter.fire(`\r\x1b[K${content}`);
            }

            // ----- ls colorizer -----

            private colorizeLsOutput(stdout: string): string {
                return stdout
                    .split('\n')
                    .map(line =>
                        line
                            .split(/(\s+)/)
                            .map(token => {
                                if (!token || /^\s+$/.test(token)) return token;
                                if (token.endsWith('/'))
                                    return colorize(token, ANSI.bold, ANSI.cyan);
                                if (token.endsWith('*')) return colorize(token, ANSI.green);
                                if (token.endsWith('@')) return colorize(token, ANSI.dim);
                                return token;
                            })
                            .join('')
                    )
                    .join('\n');
            }

            // ----- tab completion -----

            private async handleTab(): Promise<void> {
                if (this.isRunning || !this.bash) return;

                const tokens = this.inputBuffer.match(/\S+/g) ?? [];
                const endsWithSpace =
                    this.inputBuffer.endsWith(' ') || this.inputBuffer === '';
                const currentWord = endsWithSpace ? '' : (tokens[tokens.length - 1] ?? '');
                const isFirstWord =
                    tokens.length === 0 || (tokens.length === 1 && !endsWithSpace);

                const compgenFlag = isFirstWord ? '-c' : '-f';
                const compgenArg = currentWord ? ` -- ${currentWord}` : '';
                const compgenCmd = `compgen ${compgenFlag}${compgenArg}`;

                let matches: string[];
                try {
                    const result = await this.bash.exec(compgenCmd, { cwd: this.currentCwd });
                    matches = result.stdout
                        .split('\n')
                        .map(s => s.trim())
                        .filter(Boolean)
                        .sort();
                } catch {
                    matches = [];
                }

                if (matches.length === 0) {
                    dataEmitter.fire('\u0007');
                    return;
                }

                const commonPfx = this.commonPrefix(matches);

                if (matches.length === 1 || commonPfx.length > currentWord.length) {
                    const completion =
                        matches.length === 1 ? `${commonPfx} ` : commonPfx;
                    const before = endsWithSpace
                        ? this.inputBuffer
                        : this.inputBuffer.slice(
                              0,
                              this.inputBuffer.length - currentWord.length
                          );
                    this.inputBuffer = before + completion;
                    this.rewriteLine(this.prompt() + this.inputBuffer);
                    return;
                }

                const cols = 4;
                const colWidth = Math.max(...matches.map(m => m.length)) + 2;
                const rows: string[] = [];
                for (let i = 0; i < matches.length; i += cols) {
                    rows.push(
                        matches
                            .slice(i, i + cols)
                            .map(m => m.padEnd(colWidth))
                            .join('')
                    );
                }
                this.write(`\r\n${rows.join('\r\n')}`);
                this.write(`\r\n${this.prompt()}${this.inputBuffer}`);
            }

            private commonPrefix(strs: string[]): string {
                if (strs.length === 0) return '';
                let prefix = strs[0];
                for (let i = 1; i < strs.length; i++) {
                    while (!strs[i].startsWith(prefix)) {
                        prefix = prefix.slice(0, -1);
                        if (!prefix) return '';
                    }
                }
                return prefix;
            }

            // ----- command runner -----

            private async runCommand(command: string): Promise<void> {
                const trimmed = command.trim();
                if (!trimmed) {
                    this.write(`\r\n${this.prompt()}`);
                    return;
                }

                if (
                    this.history.length === 0 ||
                    this.history[this.history.length - 1] !== trimmed
                ) {
                    this.history.push(trimmed);
                }
                this.historyIndex = -1;
                this.savedInput = '';

                if (trimmed === 'clear') {
                    dataEmitter.fire('\x1bc');
                    this.write(this.prompt());
                    return;
                }
                if (trimmed === 'exit') {
                    this.shutdown(false);
                    return;
                }
                if (this.isRunning) {
                    this.write(
                        `\r\n${colorize('[busy]', ANSI.bold, ANSI.yellow)} Waiting for the current command to finish.`
                    );
                    this.write(`\r\n${this.prompt()}`);
                    return;
                }
                this.isRunning = true;
                this.write('\r\n');

                const baseCmd = trimmed.split(/\s+/)[0];
                const isLs = baseCmd === 'ls';
                const needsTypeFlag = isLs && !/(?:^|\s)-[a-zA-Z]*[lF]/.test(trimmed);
                const execCmd = needsTypeFlag
                    ? trimmed.replace(/^ls(\s|$)/, 'ls -F$1')
                    : trimmed;

                console.log('[sf-terminal] exec:', execCmd, '| cwd before:', this.currentCwd);
                try {
                    const result = await this.bash!.exec(execCmd, { cwd: this.currentCwd });
                    this.lastExitCode = Number(result?.exitCode ?? 0);
                    if (result?.env?.PWD) this.currentCwd = result.env.PWD;
                    let stdout = String(result?.stdout || '');
                    const stderr = String(result?.stderr || '');
                    console.log('[sf-terminal] result:', {
                        exitCode: this.lastExitCode,
                        stdout,
                        stderr,
                        cwdAfter: this.currentCwd,
                    });
                    if (stdout) {
                        if (needsTypeFlag) stdout = this.colorizeLsOutput(stdout);
                        this.write(stdout);
                    }
                    if (stderr) this.write(colorize(stderr, ANSI.red));
                    if (!stdout && !stderr && this.lastExitCode !== 0) {
                        this.write(colorize(`exit ${this.lastExitCode}`, ANSI.bold, ANSI.red));
                    }
                } catch (err) {
                    this.lastExitCode = 1;
                    console.error('[sf-terminal] exec error:', err);
                    this.write(
                        colorize(
                            `Error: ${err instanceof Error ? err.message : String(err)}`,
                            ANSI.red
                        )
                    );
                } finally {
                    this.isRunning = false;
                    this.emitCwdSequence();
                    this.write(`\r\n${this.prompt()}`);
                }
            }

            // ----- SimpleTerminalProcess overrides -----

            override async start(): Promise<undefined> {
                if (!isIframeFsBridgeEnabled()) {
                    this.write(
                        colorize(
                            'Salesforce Terminal is not available in standalone mode.',
                            ANSI.red
                        )
                    );
                    return undefined;
                }

                try {
                    const client = await connectIframeFsBridgeClient();
                    const fsAdapter = new BridgeFsAdapter(client);
                    this.bash = new Bash({
                        fs: fsAdapter,
                        cwd: this.currentCwd,
                        executionLimits: {
                            maxCallDepth: 50,
                            maxCommandCount: 5000,
                            maxLoopIterations: 5000,
                        },
                    });
                } catch (err) {
                    console.warn(
                        '[salesforce-terminal] Failed to initialise bash + fs bridge:',
                        err
                    );
                    this.write(
                        colorize(
                            `Failed to connect to workspace fs bridge: ${err instanceof Error ? err.message : String(err)}`,
                            ANSI.red
                        )
                    );
                    return undefined;
                }

                // Register `sf` as a native just-bash command so the user can run
                // SF CLI subcommands directly in the terminal.
                // registerSalesforceShellCommands() from core/bash.ts only sets
                // shell.handlers for the agent shell-runner abstraction — it does NOT
                // call just-bash's registerCommand and therefore has no effect here.
                if (terminalConfig) {
                    const { connectionRuntime, vscode: vs } = terminalConfig;
                    const handlers = buildSalesforceHandlers(connectionRuntime, vs);

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (this.bash as any).registerCommand({
                        name: 'sf',
                        async execute(
                            argv: string[],
                            ctx: {
                                cwd: string;
                                fs: {
                                    resolvePath(cwd: string, p: string): string;
                                    readFile(p: string): Promise<string>;
                                };
                            }
                        ) {
                            const sub1 = argv[0];
                            const sub2 = argv[1];

                            if (!sub1 || sub1 === '--help' || sub1 === '-h') {
                                return {
                                    stdout: [
                                        'Salesforce CLI (workbench)',
                                        '',
                                        'Commands:',
                                        '  sf apex run --file <path>         Execute anonymous Apex',
                                        '  sf data query --query <soql>       Run a SOQL query',
                                        '  sf data query --query <soql> --use-tooling-api',
                                        '  sf data query --query <soql> --all-rows',
                                        '  sf api request --endpoint <path> [--method <method>] [--body <json>]',
                                        '  sf org list                        List connected orgs',
                                        '  sf org open [--target-org <alias>] Open org in browser',
                                        '',
                                    ].join('\n'),
                                    stderr: '',
                                    exitCode: 0,
                                };
                            }

                            try {
                                if (sub1 === 'apex' && sub2 === 'run') {
                                    const fileFlag = argv.indexOf('--file') !== -1
                                        ? argv[argv.indexOf('--file') + 1]
                                        : argv.indexOf('-f') !== -1
                                          ? argv[argv.indexOf('-f') + 1]
                                          : null;
                                    let apexCode = '';
                                    if (fileFlag) {
                                        const abs = ctx.fs.resolvePath(ctx.cwd, fileFlag);
                                        apexCode = await ctx.fs.readFile(abs);
                                    }
                                    const { exitCode, result } = await handlers.executeApex({ apexCode });
                                    return {
                                        stdout: JSON.stringify(result, null, 2),
                                        stderr: '',
                                        exitCode: exitCode ?? 0,
                                    };
                                }

                                if (sub1 === 'data' && sub2 === 'query') {
                                    const qIdx = argv.indexOf('--query') !== -1
                                        ? argv.indexOf('--query')
                                        : argv.indexOf('-q');
                                    const query = qIdx >= 0 ? (argv[qIdx + 1] ?? '') : '';
                                    const { result } = await handlers.executeSoql({
                                        query,
                                        includeDeletedRecords: argv.includes('--all-rows'),
                                        useToolingApi: argv.includes('--use-tooling-api'),
                                    });
                                    return {
                                        stdout: JSON.stringify(result, null, 2),
                                        stderr: '',
                                        exitCode: 0,
                                    };
                                }

                                if (sub1 === 'api' && sub2 === 'request') {
                                    const epIdx = argv.indexOf('--endpoint');
                                    const endpoint = epIdx >= 0 ? (argv[epIdx + 1] ?? '/') : '/';
                                    const methodIdx = argv.indexOf('--method');
                                    const method = methodIdx >= 0 ? (argv[methodIdx + 1] ?? 'GET') : 'GET';
                                    const bodyIdx = argv.indexOf('--body');
                                    const body = bodyIdx >= 0 ? (argv[bodyIdx + 1] ?? '') : '';
                                    const { result } = await handlers.executeApi({
                                        endpoint,
                                        method,
                                        body,
                                        headerValues: [],
                                    });
                                    return {
                                        stdout: JSON.stringify(result, null, 2),
                                        stderr: '',
                                        exitCode: 0,
                                    };
                                }

                                if (sub1 === 'org' && sub2 === 'list') {
                                    const { result } = await handlers.listOrgs();
                                    return {
                                        stdout: JSON.stringify(result, null, 2),
                                        stderr: '',
                                        exitCode: 0,
                                    };
                                }

                                if (sub1 === 'org' && sub2 === 'open') {
                                    const orgIdx = argv.indexOf('--target-org') !== -1
                                        ? argv.indexOf('--target-org')
                                        : argv.indexOf('-o');
                                    const alias = orgIdx >= 0 ? (argv[orgIdx + 1] ?? '') : (argv[2] ?? '');
                                    const { result } = await handlers.openOrg({ alias });
                                    return {
                                        stdout: String(result ?? ''),
                                        stderr: '',
                                        exitCode: 0,
                                    };
                                }

                                return {
                                    stdout: '',
                                    stderr: `sf: unknown command "sf ${[sub1, sub2].filter(Boolean).join(' ')}". Run "sf --help" for usage.\n`,
                                    exitCode: 1,
                                };
                            } catch (err) {
                                return {
                                    stdout: '',
                                    stderr: `sf: ${err instanceof Error ? err.message : String(err)}\n`,
                                    exitCode: 1,
                                };
                            }
                        },
                    });

                    // `code <file>` — open files in the VS Code editor.
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (this.bash as any).registerCommand({
                        name: 'code',
                        async execute(
                            argv: string[],
                            ctx: {
                                cwd: string;
                                fs: { resolvePath(cwd: string, p: string): string };
                            }
                        ) {
                            const targets = argv.filter(a => a && !a.startsWith('--'));
                            if (targets.length === 0) {
                                return {
                                    stdout: '',
                                    stderr: 'Usage: code <file> [file...]\n',
                                    exitCode: 1,
                                };
                            }
                            const errors: string[] = [];
                            for (const target of targets) {
                                const abs = ctx.fs.resolvePath(ctx.cwd, target);
                                try {
                                    const uri = vs.Uri.file(abs);
                                    const doc = await vs.workspace.openTextDocument(uri);
                                    await vs.window.showTextDocument(doc, { preview: false });
                                } catch (err) {
                                    errors.push(
                                        `code: ${target}: ${err instanceof Error ? err.message : String(err)}`
                                    );
                                }
                            }
                            return {
                                stdout: '',
                                stderr: errors.length ? errors.join('\n') + '\n' : '',
                                exitCode: errors.length ? 1 : 0,
                            };
                        },
                    });
                }

                // Defer OSC 7 until the xterm canvas renderer is ready — firing
                // it synchronously triggers _refreshDecorations before the renderer
                // dimensions are initialised.
                setTimeout(() => this.emitCwdSequence(), 0);

                this.write(colorize('Salesforce Terminal', ANSI.bold, ANSI.cyan));
                this.write(
                    `\r\n${colorize(
                        'Bash shell connected to workspace fs bridge. Type',
                        ANSI.dim
                    )} sf --help ${colorize('for Salesforce commands.', ANSI.dim)}`
                );
                this.write(`\r\n${this.prompt()}`);

                return undefined;
            }

            // input() must be synchronous per ITerminalChildProcess; async work
            // is kicked off as a fire-and-forget promise.
            override input(data: string): void {
                void this.handleInput(data);
            }

            private async handleInput(data: string): Promise<void> {
                if (data === '\r') {
                    const command = this.inputBuffer;
                    this.inputBuffer = '';
                    await this.runCommand(command);
                    return;
                }
                if (data === '\u007F') {
                    if (!this.inputBuffer) return;
                    this.inputBuffer = this.inputBuffer.slice(0, -1);
                    dataEmitter.fire('\b \b');
                    return;
                }
                if (data === '\u0003') {
                    this.write(colorize('^C', ANSI.yellow));
                    this.inputBuffer = '';
                    this.historyIndex = -1;
                    this.write(`\r\n${this.prompt()}`);
                    return;
                }
                if (data === '\t') {
                    await this.handleTab();
                    return;
                }
                // Arrow up
                if (data === '\u001b[A') {
                    if (this.history.length === 0) return;
                    if (this.historyIndex === -1) {
                        this.savedInput = this.inputBuffer;
                        this.historyIndex = this.history.length - 1;
                    } else if (this.historyIndex > 0) {
                        this.historyIndex--;
                    }
                    this.inputBuffer = this.history[this.historyIndex];
                    this.rewriteLine(this.prompt() + this.inputBuffer);
                    return;
                }
                // Arrow down
                if (data === '\u001b[B') {
                    if (this.historyIndex === -1) return;
                    if (this.historyIndex < this.history.length - 1) {
                        this.historyIndex++;
                        this.inputBuffer = this.history[this.historyIndex];
                    } else {
                        this.historyIndex = -1;
                        this.inputBuffer = this.savedInput;
                    }
                    this.rewriteLine(this.prompt() + this.inputBuffer);
                    return;
                }
                // Ignore remaining escape sequences
                if (!data || data.startsWith('\u001b')) return;
                this.inputBuffer += data;
                dataEmitter.fire(data);
            }

            override resize(_cols: number, _rows: number): void {
                // just-bash does not support resize
            }

            override shutdown(_immediate: boolean): void {
                try {
                    dataEmitter.dispose();
                } catch {
                    // ignore
                }
            }

            override clearBuffer(): void {
                // no-op
            }

            override sendSignal(signal: string): void {
                if (signal === 'SIGINT') {
                    this.input('\u0003');
                }
            }
        }

        return new SalesforceTerminalProcess(1, 1, workspaceRoot, dataEmitter.event);
    };
}

export const salesforceTerminalBackend = new SalesforceTerminalBackend();
