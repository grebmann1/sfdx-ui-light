/* eslint-disable import/no-unresolved */
import { Bash } from 'just-bash';
import { connectIframeFsBridgeClient } from 'vscode/bridge/iframeFsBridgeClient';
import { getIframeBridgeWorkspaceRoot, isIframeFsBridgeEnabled } from 'vscode/bridge/bootstrapIframeBridge';
import { getApexExecutionExitCode } from 'core/bash';
import { buildSalesforceExtensionConfig } from '../core/extensionManifest';
import { registerSalesforceExtension } from '../core/extensionRegistration';
import { resolveCoreServices, type CoreServices } from '../core/coreServices';
// LWC version: handles --file flag and other args via ctx.fs (backed by BridgeFsAdapter)
import { registerSalesforceShellCommands } from '../../../../../lwc/app/core/bash/salesforceShellCommands';
import { BridgeFsAdapter } from './bridgeFsAdapter';

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

function buildTerminalExtensionConfig() {
    return buildSalesforceExtensionConfig({
        name: 'sf-terminal',
        displayName: 'Salesforce Terminal (Workbench)',
        description: 'Bash terminal connected to the workspace fs bridge for the Salesforce workbench',
        contributes: {
            commands: [
                {
                    command: 'salesforceTerminal.openTerminal',
                    title: 'Salesforce: Open Terminal',
                },
            ],
            menus: {
                commandPalette: [{ command: 'salesforceTerminal.openTerminal' }],
            },
        },
    });
}

async function getShellOrgEntries(connectionRuntime) {
    const outputEntries: Array<{
        alias: string;
        username: string;
        instanceUrl: string;
        sessionId: string;
        authType: string;
        label: string;
    }> = [];
    const current = connectionRuntime.loadStoredConn();
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

async function ensureConn(connectionRuntime, vscode) {
    let conn = connectionRuntime.loadStoredConn();
    conn = await connectionRuntime
        .withToolingClientAuthed(conn, async (_client, effectiveConn) => effectiveConn)
        .catch(() => conn);
    if (!conn.instanceUrl || !conn.accessToken) {
        await vscode.window.showErrorMessage(
            connectionRuntime.getInjectedConnectionRequiredMessage()
        );
        conn = connectionRuntime.loadStoredConn();
    }
    if (!conn.instanceUrl || !conn.accessToken) {
        throw new Error('Not connected to Salesforce.');
    }
    return conn;
}

function buildSalesforceHandlers(connectionRuntime, vscode) {
    return {
        async executeApex({ apexCode, sourceFilePath: _sf }) {
            const conn = await ensureConn(connectionRuntime, vscode);
            const result = await connectionRuntime.withToolingClientAuthed(
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
            const conn = await ensureConn(connectionRuntime, vscode);
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
                            first?.totalSize ?? pages.flatMap(p => p?.records || []).length
                        ),
                    };
                }),
            };
        },

        async executeApi({ body, endpoint, headerValues, method }) {
            const conn = await ensureConn(connectionRuntime, vscode);
            const parsedHeaders: Record<string, string> = {};
            for (const rawValue of headerValues || []) {
                const line = String(rawValue || '').trim();
                if (!line) continue;
                const index = line.indexOf(':');
                if (index <= 0) throw new Error(`Invalid header "${line}". Expected "Name: Value".`);
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
            await vscode.env.openExternal(vscode.Uri.parse(url));
            return { result: `Opened org ${match.alias || alias}` };
        },
    };
}

function createTerminalPty(bash: InstanceType<typeof Bash>, vscode, initialCwd: string) {
    const writeEmitter = new vscode.EventEmitter();
    const closeEmitter = new vscode.EventEmitter();
    let inputBuffer = '';
    let isRunning = false;
    let lastExitCode = 0;

    // just-bash exec() runs in an isolated state snapshot — cwd changes from `cd`
    // are not reflected in bash.getCwd(). We track cwd manually via result.env.PWD.
    let currentCwd = initialCwd;
    const getCwd = () => currentCwd;

    // Command history — up/down arrow navigation
    const history: string[] = [];
    let historyIndex = -1;
    let savedInput = '';

    const write = (value: string) => {
        if (!value) return;
        writeEmitter.fire(String(value).replace(/\r?\n/g, '\r\n'));
    };

    // Emit OSC 7 (set-cwd) so VS Code adds CwdDetection capability and removes the
    // fallback Enter-key listener that otherwise throws "cwd is not a string undefined".
    const emitCwdSequence = () => {
        const cwd = getCwd();
        const encoded = encodeURIComponent(cwd).replace(/%2F/g, '/');
        writeEmitter.fire(`\x1b]7;file://localhost${encoded}\x07`);
    };

    const prompt = () => {
        const exitMark =
            lastExitCode !== 0 ? colorize(`[${lastExitCode}] `, ANSI.bold, ANSI.red) : '';
        const dollar = colorize('$', lastExitCode !== 0 ? ANSI.red : ANSI.green);
        return `${colorize('sf-terminal', ANSI.bold, ANSI.cyan)}:${colorize(getCwd(), ANSI.brightBlack)} ${exitMark}${dollar} `;
    };

    // just-bash ls has no built-in colors. We transparently add -F (type indicators)
    // and post-process: directories (/) → cyan, executables (*) → green, symlinks (@) → dim.
    // VS Code's terminal is rendered by xterm.js, so standard ANSI codes work fine.
    const colorizeLsOutput = (stdout: string): string =>
        stdout
            .split('\n')
            .map(line =>
                line
                    .split(/(\s+)/)
                    .map(token => {
                        if (!token || /^\s+$/.test(token)) return token;
                        if (token.endsWith('/')) return colorize(token, ANSI.bold, ANSI.cyan);
                        if (token.endsWith('*')) return colorize(token, ANSI.green);
                        if (token.endsWith('@')) return colorize(token, ANSI.dim);
                        return token;
                    })
                    .join('')
            )
            .join('\n');

    // Rewrite the current terminal line (used for history navigation).
    const rewriteLine = (content: string) => {
        writeEmitter.fire(`\r\x1b[K${content}`);
    };

    /** Longest common prefix shared by all strings in an array. */
    const commonPrefix = (strs: string[]): string => {
        if (strs.length === 0) return '';
        let prefix = strs[0];
        for (let i = 1; i < strs.length; i++) {
            while (!strs[i].startsWith(prefix)) {
                prefix = prefix.slice(0, -1);
                if (!prefix) return '';
            }
        }
        return prefix;
    };

    /**
     * Handle a Tab keypress: resolve completions via compgen then either
     * inline-complete (single match / unique prefix) or list all matches.
     */
    const handleTab = async () => {
        if (isRunning) return;

        // Split buffer into tokens. The "current word" is the last token
        // (may be empty if the buffer ends with a space).
        const tokens = inputBuffer.match(/\S+/g) ?? [];
        const endsWithSpace = inputBuffer.endsWith(' ') || inputBuffer === '';
        const currentWord = endsWithSpace ? '' : (tokens[tokens.length - 1] ?? '');
        const isFirstWord = tokens.length === 0 || (tokens.length === 1 && !endsWithSpace);

        // Use compgen: -c for commands (first word), -f for paths (rest)
        const compgenFlag = isFirstWord ? '-c' : '-f';
        const compgenArg = currentWord ? ` -- ${currentWord}` : '';
        const compgenCmd = `compgen ${compgenFlag}${compgenArg}`;

        let matches: string[];
        try {
            const result = await bash.exec(compgenCmd, { cwd: currentCwd });
            matches = result.stdout
                .split('\n')
                .map(s => s.trim())
                .filter(Boolean)
                .sort();
        } catch {
            matches = [];
        }

        if (matches.length === 0) {
            // No match — ring the bell
            writeEmitter.fire('\u0007');
            return;
        }

        const prefix = commonPrefix(matches);

        if (matches.length === 1 || prefix.length > currentWord.length) {
            // Unique match or unambiguous prefix: replace current word and add a
            // trailing space only for a fully-resolved single match.
            const completion = matches.length === 1 ? `${prefix} ` : prefix;
            const before = endsWithSpace
                ? inputBuffer
                : inputBuffer.slice(0, inputBuffer.length - currentWord.length);
            inputBuffer = before + completion;
            rewriteLine(prompt() + inputBuffer);
            return;
        }

        // Ambiguous: show all matches then redraw the prompt line.
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
        write(`\r\n${rows.join('\r\n')}`);
        write(`\r\n${prompt()}${inputBuffer}`);
    };

    const runCommand = async (command: string) => {
        const trimmed = command.trim();
        if (!trimmed) {
            write(`\r\n${prompt()}`);
            return;
        }

        if (history.length === 0 || history[history.length - 1] !== trimmed) {
            history.push(trimmed);
        }
        historyIndex = -1;
        savedInput = '';

        if (trimmed === 'clear') {
            writeEmitter.fire('\x1bc');
            write(prompt());
            return;
        }
        if (trimmed === 'exit') {
            closeEmitter.fire();
            return;
        }
        if (isRunning) {
            write(
                `\r\n${colorize('[busy]', ANSI.bold, ANSI.yellow)} Waiting for the current command to finish.`
            );
            write(`\r\n${prompt()}`);
            return;
        }
        isRunning = true;
        write('\r\n');

        // Transparently add -F to bare `ls` calls so we can colorize directory entries.
        // Skip when -l or -F is already present (long format handles dirs differently).
        const baseCmd = trimmed.split(/\s+/)[0];
        const isLs = baseCmd === 'ls';
        const needsTypeFlag = isLs && !/(?:^|\s)-[a-zA-Z]*[lF]/.test(trimmed);
        const execCmd = needsTypeFlag ? trimmed.replace(/^ls(\s|$)/, 'ls -F$1') : trimmed;

        console.log('[sf-terminal] exec:', execCmd, '| cwd before:', getCwd());
        try {
            const result = await bash.exec(execCmd, { cwd: currentCwd });
            lastExitCode = Number(result?.exitCode ?? 0);
            // env.PWD is the authoritative cwd after the command runs (cd updates it).
            if (result?.env?.PWD) currentCwd = result.env.PWD;
            let stdout = String(result?.stdout || '');
            const stderr = String(result?.stderr || '');
            console.log('[sf-terminal] result:', { exitCode: lastExitCode, stdout, stderr, cwdAfter: getCwd() });
            if (stdout) {
                if (needsTypeFlag) stdout = colorizeLsOutput(stdout);
                write(stdout);
            }
            if (stderr) write(colorize(stderr, ANSI.red));
            if (!stdout && !stderr && lastExitCode !== 0) {
                write(colorize(`exit ${lastExitCode}`, ANSI.bold, ANSI.red));
            }
        } catch (err) {
            lastExitCode = 1;
            console.error('[sf-terminal] exec error:', err);
            write(colorize(`Error: ${err instanceof Error ? err.message : String(err)}`, ANSI.red));
        } finally {
            isRunning = false;
            emitCwdSequence();
            write(`\r\n${prompt()}`);
        }
    };

    return {
        pty: {
            onDidWrite: writeEmitter.event,
            onDidClose: closeEmitter.event,
            open() {
                // Defer OSC 7 until the xterm canvas renderer is ready — firing
                // it synchronously in open() triggers _refreshDecorations before
                // the renderer dimensions are initialized.
                setTimeout(emitCwdSequence, 0);
                write(colorize('Salesforce Terminal', ANSI.bold, ANSI.cyan));
                write(
                    `\r\n${colorize(
                        'Bash shell connected to workspace fs bridge. Type',
                        ANSI.dim
                    )} sf --help ${colorize('for Salesforce commands.', ANSI.dim)}`
                );
                write(`\r\n${prompt()}`);
            },
            close() {
                try {
                    writeEmitter.dispose();
                    closeEmitter.dispose();
                } catch {
                    // ignore
                }
            },
            async handleInput(data: string) {
                if (data === '\r') {
                    const command = inputBuffer;
                    inputBuffer = '';
                    await runCommand(command);
                    return;
                }
                if (data === '\u007F') {
                    if (!inputBuffer) return;
                    inputBuffer = inputBuffer.slice(0, -1);
                    writeEmitter.fire('\b \b');
                    return;
                }
                if (data === '\u0003') {
                    write(colorize('^C', ANSI.yellow));
                    inputBuffer = '';
                    historyIndex = -1;
                    write(`\r\n${prompt()}`);
                    return;
                }
                // Tab — trigger completion
                if (data === '\t') {
                    await handleTab();
                    return;
                }
                // Arrow up — navigate to older history entry
                if (data === '\u001b[A') {
                    if (history.length === 0) return;
                    if (historyIndex === -1) {
                        savedInput = inputBuffer;
                        historyIndex = history.length - 1;
                    } else if (historyIndex > 0) {
                        historyIndex--;
                    }
                    inputBuffer = history[historyIndex];
                    rewriteLine(prompt() + inputBuffer);
                    return;
                }
                // Arrow down — navigate to newer history entry (or restore saved input)
                if (data === '\u001b[B') {
                    if (historyIndex === -1) return;
                    if (historyIndex < history.length - 1) {
                        historyIndex++;
                        inputBuffer = history[historyIndex];
                    } else {
                        historyIndex = -1;
                        inputBuffer = savedInput;
                    }
                    rewriteLine(prompt() + inputBuffer);
                    return;
                }
                // Ignore remaining escape sequences (left/right arrows, function keys, etc.)
                if (!data || data.startsWith('\u001b')) return;
                inputBuffer += data;
                writeEmitter.fire(data);
            },
        },
        dispose() {
            try {
                writeEmitter.dispose();
                closeEmitter.dispose();
            } catch {
                // ignore
            }
        },
    };
}

export async function register(
    vscodeBundle,
    { coreServices }: { coreServices?: CoreServices } = {}
) {
    return registerSalesforceExtension(
        vscodeBundle,
        { config: buildTerminalExtensionConfig() },
        async () => {
            const core = await resolveCoreServices(coreServices, vscodeBundle);
            if (!core?.connection?.runtime || !core?.workspace?.context || !core?.features) {
                return;
            }

            const connectionRuntime = core.connection.runtime;
            const context = core.workspace.context;
            const vscode = vscodeBundle?.vscode;

            await core.features.activateOnce?.('salesforce-terminal', async () => {
                if (!isIframeFsBridgeEnabled()) {
                    // Terminal requires the fs bridge — not available in standalone mode
                    return;
                }

                let client;
                let bash: InstanceType<typeof Bash>;
                const workspaceRoot = getIframeBridgeWorkspaceRoot() || '/workspace';

                try {
                    client = await connectIframeFsBridgeClient();
                    const fsAdapter = new BridgeFsAdapter(client);

                    bash = new Bash({
                        fs: fsAdapter,
                        cwd: workspaceRoot,
                        executionLimits: {
                            maxCallDepth: 50,
                            maxCommandCount: 5000,
                            maxLoopIterations: 5000,
                        },
                    });
                } catch (err) {
                    console.warn('[salesforce-terminal] Failed to initialise bash + fs bridge:', err);
                    return;
                }

                // Wire the LWC version of registerSalesforceShellCommands directly on the
                // just-bash instance. When the user runs e.g. `sf apex run --file path`,
                // just-bash calls the registered execute(argv, ctx) handler where ctx.fs is
                // backed by the BridgeFsAdapter — so the file is read through the bridge.
                //
                // The cast to `any` is needed because just-bash's CommandContext is a superset
                // of LWC's ShellCommandContext: all required fields (ctx.fs, ctx.cwd, ctx.stdin)
                // are present at runtime, but TypeScript sees them as distinct named types.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                registerSalesforceShellCommands({
                    shell: bash as any,
                    handlers: buildSalesforceHandlers(connectionRuntime, vscode),
                });

                // `code <file> [file...]` — open files in the VS Code editor, mirroring the
                // behaviour of the `code` CLI. Paths are resolved relative to the shell cwd
                // (backed by BridgeFsAdapter), then opened via the VS Code document API.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (bash as any).registerCommand({
                    name: 'code',
                    async execute(argv: string[], ctx: { cwd: string; fs: { resolvePath(cwd: string, p: string): string } }) {
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
                                const uri = vscode.Uri.file(abs);
                                const doc = await vscode.workspace.openTextDocument(uri);
                                await vscode.window.showTextDocument(doc, { preview: false });
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

                let terminalInstance = null;

                function ensureTerminal() {
                    if (terminalInstance) return terminalInstance;

                    const { pty, dispose } = createTerminalPty(bash, vscode, workspaceRoot);
                    terminalInstance = vscode.window.createTerminal({
                        name: 'Salesforce Terminal',
                        pty,
                    });

                    context.addDisposable?.({
                        dispose() {
                            try {
                                terminalInstance?.dispose?.();
                            } catch {
                                // ignore
                            }
                            dispose();
                            terminalInstance = null;
                        },
                    });

                    return terminalInstance;
                }

                context.addDisposable?.(
                    vscode.commands.registerCommand('salesforceTerminal.openTerminal', () => {
                        ensureTerminal().show(true);
                    })
                );

                // Auto-open the terminal so it appears in the panel on workbench load
                // without requiring the user to discover the command palette entry.
                ensureTerminal().show(true);

                // Note: we intentionally do NOT call client.dispose() here because
                // that would close the shared MessagePort (bootstrapIframeBridge caches
                // a single port instance) and break the workspace provider's bridge client.
                // The client becomes eligible for GC when the extension is torn down.
            });
        }
    );
}
