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
                configureSalesforceTerminal({ connectionRuntime, vscode });

                let terminalInstance = null;

                function ensureTerminal() {
                    if (terminalInstance) return terminalInstance;
                    // createTerminal() without a pty — the SalesforceTerminalBackend
                    // registered in setup.common.ts handles process creation.
                    terminalInstance = vscode.window.createTerminal({
                        name: 'Salesforce Terminal',
                    });
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
                            // Re-create immediately so the panel always has a live terminal.
                            ensureTerminal().show(true);
                        }
                    })
                );

                context.addDisposable?.(
                    vscode.commands.registerCommand('salesforceTerminal.openTerminal', () => {
                        ensureTerminal().show(true);
                    })
                );

                // Auto-open the terminal so it appears in the panel on workbench load
                // without requiring the user to discover the command palette entry.
                ensureTerminal().show(true);
            });
        }
    );
}
