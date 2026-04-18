/* eslint-disable import/no-unresolved */
import { buildSalesforceExtensionConfig } from '../core/extensionManifest';
import { registerSalesforceExtension } from '../core/extensionRegistration';
import { resolveCoreServices, type CoreServices } from '../core/coreServices';
import { configureSalesforceTerminal } from './terminalBackend';

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
                // Provide SF runtime + vscode to the backend so every process
                // created via createProcess() can register shell commands.
                // Must run unconditionally — it's what wires the `sf` command
                // into the Bash instance used by SalesforceTerminalProcess.
                configureSalesforceTerminal({ connectionRuntime, vscode });

                let terminalInstance = null;
                let autoOpenDisabled = false;

                // The monaco-vscode-api worker ext host refuses plain
                // `createTerminal({ name })` calls via createTerminalFromOptions
                // (it requires remoteAuthority or a pty). Wrap the call so a
                // NotSupportedError in that environment doesn't tear down
                // activation or the companion logs/metadata extensions.
                function tryCreateTerminal() {
                    if (autoOpenDisabled) return null;
                    try {
                        return vscode.window.createTerminal({
                            name: 'Salesforce Terminal',
                        });
                    } catch (err) {
                        autoOpenDisabled = true;
                        console.warn(
                            '[salesforce-terminal] createTerminal is not supported in this host; ' +
                                'the Salesforce Terminal will not auto-open.',
                            err
                        );
                        return null;
                    }
                }

                function ensureTerminal() {
                    if (terminalInstance) return terminalInstance;
                    // createTerminal() without a pty — the SalesforceTerminalBackend
                    // registered in setup.common.ts handles process creation.
                    terminalInstance = tryCreateTerminal();
                    if (!terminalInstance) return null;
                    context.addDisposable?.({
                        dispose() {
                            try {
                                terminalInstance?.dispose?.();
                            } catch {
                                // ignore
                            }
                            terminalInstance = null;
                        },
                    });
                    return terminalInstance;
                }

                context.addDisposable?.(
                    vscode.window.onDidCloseTerminal(closedTerminal => {
                        if (closedTerminal === terminalInstance) {
                            terminalInstance = null;
                            if (autoOpenDisabled) return;
                            // Re-create immediately so the panel always has a live terminal.
                            ensureTerminal()?.show?.(true);
                        }
                    })
                );

                context.addDisposable?.(
                    vscode.commands.registerCommand('salesforceTerminal.openTerminal', () => {
                        ensureTerminal()?.show?.(true);
                    })
                );

                // Auto-open the terminal so it appears in the panel on workbench load
                // without requiring the user to discover the command palette entry.
                // Best-effort: if the host refuses, tryCreateTerminal() swallows the
                // error and the command palette entry remains available.
                ensureTerminal()?.show?.(true);
            });
        }
    );
}
