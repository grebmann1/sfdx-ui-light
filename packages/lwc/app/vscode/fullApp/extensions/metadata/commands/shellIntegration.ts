const ANSI = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    brightBlack: '\x1b[90m',
};
import { ensureDir, writeTextFile } from '../core/workspaceCache';
import { getWorkspacePath, getWorkspaceRootPath, getWorkspaceUri } from '../core/workspacePaths';

import { createWorkbenchShellService, getShellOutputLines } from './workbenchShellService';

function colorize(value, ...styles) {
    const text = String(value ?? '');
    if (!text || styles.length === 0) {
        return text;
    }
    return `${styles.join('')}${text}${ANSI.reset}`;
}

export function registerShellIntegration({ connectionRuntime, context }) {
    const { diagnostics, output, vscode } = context;

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

    const shellService = createWorkbenchShellService({ connectionRuntime, context });
    let shellTerminalController = null;

    context.addDisposable(
        shellService.onDidRun(async result => {
            context.logLines(getShellOutputLines(result, vscode));
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
        const prompt = () =>
            `${colorize('sf-shell', ANSI.bold, ANSI.cyan)}:${colorize(
                shellService.getCwd(),
                ANSI.brightBlack
            )}${colorize('$', ANSI.green)} `;
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
                write(
                    `\r\n${colorize('[busy]', ANSI.bold, ANSI.yellow)} Waiting for the current shell command to finish.`
                );
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
                    const exitCode = Number(result.exitCode ?? 0);
                    write(
                        colorize(
                            `[exit ${exitCode}]`,
                            ANSI.bold,
                            exitCode === 0 ? ANSI.green : ANSI.red
                        )
                    );
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
                write(colorize('Salesforce Shell', ANSI.bold, ANSI.blue));
                write(
                    `\r\n${colorize(
                        'Type',
                        ANSI.dim
                    )} sf commands like "sf org list", "sf data query --query \\"SELECT Id FROM Account LIMIT 5\\"" or "sf apex run --file ${getWorkspacePath(
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
                    write(colorize('^C', ANSI.yellow));
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
