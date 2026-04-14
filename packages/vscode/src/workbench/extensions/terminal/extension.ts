/* eslint-disable import/no-unresolved */
import { Bash } from 'just-bash';
import { connectIframeFsBridgeClient } from 'vscode/bridge/iframeFsBridgeClient';
import { getIframeBridgeWorkspaceRoot, isIframeFsBridgeEnabled } from 'vscode/bridge/bootstrapIframeBridge';
import { buildSalesforceExtensionConfig } from '../core/extensionManifest';
import { registerSalesforceExtension } from '../core/extensionRegistration';
import { resolveCoreServices, type CoreServices } from '../core/coreServices';
import { createWorkbenchShellService } from '../metadata/commands/workbenchShellService';
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

function createTerminalPty(bash: InstanceType<typeof Bash>, vscode) {
    const writeEmitter = new vscode.EventEmitter();
    const closeEmitter = new vscode.EventEmitter();
    let inputBuffer = '';
    let isRunning = false;

    const write = (value: string) => {
        if (!value) return;
        writeEmitter.fire(String(value).replace(/\r?\n/g, '\r\n'));
    };

    const getCwd = () => {
        try {
            return typeof bash.getCwd === 'function' ? bash.getCwd() : '/workspace';
        } catch {
            return '/workspace';
        }
    };

    const prompt = () =>
        `${colorize('sf-terminal', ANSI.bold, ANSI.cyan)}:${colorize(getCwd(), ANSI.brightBlack)}${colorize('$', ANSI.green)} `;

    const runCommand = async (command: string) => {
        const trimmed = command.trim();
        if (!trimmed) {
            write(`\r\n${prompt()}`);
            return;
        }
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
        try {
            const result = await bash.exec(trimmed);
            const stdout = String(result?.stdout || '');
            const stderr = String(result?.stderr || '');
            if (stdout) write(stdout);
            if (stderr) write(colorize(stderr, ANSI.red));
            if (!stdout && !stderr) {
                const exitCode = Number(result?.exitCode ?? 0);
                if (exitCode !== 0) {
                    write(colorize(`[exit ${exitCode}]`, ANSI.bold, ANSI.red));
                }
            }
        } catch (err) {
            write(colorize(`Error: ${err instanceof Error ? err.message : String(err)}`, ANSI.red));
        } finally {
            isRunning = false;
            write(`\r\n${prompt()}`);
        }
    };

    return {
        pty: {
            onDidWrite: writeEmitter.event,
            onDidClose: closeEmitter.event,
            open() {
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
                    write(`\r\n${prompt()}`);
                    return;
                }
                // Ignore escape sequences (arrow keys, etc.)
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

                try {
                    client = await connectIframeFsBridgeClient();
                    const workspaceRoot = getIframeBridgeWorkspaceRoot() || '/workspace';
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

                // Register the `sf` command on just-bash, delegating to the existing
                // shell service which handles Salesforce-specific operations.
                const shellService = createWorkbenchShellService({ connectionRuntime, context });

                try {
                    bash.registerCommand({
                        name: 'sf',
                        async execute(argv) {
                            const cmd = `sf ${(argv || []).join(' ')}`;
                            try {
                                const result = await shellService.run(cmd, {
                                    cwd: typeof bash.getCwd === 'function' ? bash.getCwd() : '/workspace',
                                    source: 'terminal',
                                });
                                return {
                                    stdout: result.stdout || '',
                                    stderr: result.stderr || '',
                                    exitCode: Number(result.exitCode ?? 0),
                                };
                            } catch (err) {
                                return {
                                    stdout: '',
                                    stderr: err instanceof Error ? err.message : String(err),
                                    exitCode: 1,
                                };
                            }
                        },
                    });
                } catch {
                    // registerCommand may not exist if the bash instance is limited
                }

                let terminalPtyController: ReturnType<typeof createTerminalPty> | null = null;
                let terminalInstance = null;

                function ensureTerminal() {
                    if (terminalInstance) return terminalInstance;

                    const { pty, dispose } = createTerminalPty(bash, vscode);
                    terminalInstance = vscode.window.createTerminal({
                        name: 'Salesforce Terminal',
                        pty,
                    });

                    terminalPtyController = { pty, dispose };
                    context.addDisposable?.({
                        dispose() {
                            try {
                                terminalInstance?.dispose?.();
                            } catch {
                                // ignore
                            }
                            dispose();
                            terminalInstance = null;
                            terminalPtyController = null;
                        },
                    });

                    return terminalInstance;
                }

                context.addDisposable?.(
                    vscode.commands.registerCommand('salesforceTerminal.openTerminal', () => {
                        ensureTerminal().show(true);
                    })
                );

                // Clean up the bridge client when the extension is deactivated
                context.addDisposable?.({
                    dispose() {
                        try {
                            client?.dispose?.();
                        } catch {
                            // ignore
                        }
                    },
                });
            });
        }
    );
}
