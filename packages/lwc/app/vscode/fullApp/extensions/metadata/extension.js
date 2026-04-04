import { createDeployAndSourceTracking } from './commands/deployAndSourceTracking.js';
import { registerLwcComponentScaffolding } from './commands/lwcComponentScaffolding.js';
import { registerMetadataApiCommands } from './commands/metadataApiCommands.js';
import { registerQueryAndApexTools } from './commands/queryAndApexTools.js';
import { registerShellIntegration } from './commands/shellIntegration.js';
import { createActivationContext } from './core/activationContext.js';
import { EXTENSION_ID, loadExtension } from './core/manifestAssets.js';
import {
    createConnectionRuntime,
    createLoginProblemSetter,
    registerConnectionCommands,
} from './runtime/connectionRuntime.js';
import { registerSchemaTools } from './runtime/schemaTools.js';
import { fetchAndPopulateWorkspace } from './runtime/workspaceSync.js';

export { EXTENSION_ID, loadExtension };

async function applyExplorerExcludes(vscode) {
    try {
        if (typeof vscode.workspace?.getConfiguration !== 'function') {
            return;
        }
        const filesConfig = vscode.workspace.getConfiguration('files');
        const current =
            (typeof filesConfig?.get === 'function' && filesConfig.get('exclude')) || {};
        const merged = {
            ...(current && typeof current === 'object' ? current : {}),
            '**/.salesforce/**': true,
            '**/*.map': true,
        };
        if (typeof filesConfig?.update === 'function') {
            try {
                await filesConfig.update('exclude', merged, true);
            } catch {
                await filesConfig.update('exclude', merged);
            }
        }
    } catch {
        // ignore
    }
}

function registerSalesforcePanelProvider({ connectionRuntime, context }) {
    const { vscode } = context;
    try {
        if (
            typeof vscode.window?.registerTreeDataProvider !== 'function' ||
            typeof vscode.TreeItem !== 'function'
        ) {
            return;
        }

        class SfPanelProvider {
            getTreeItem(element) {
                return element;
            }

            getChildren(element) {
                if (element) return [];

                const mkItem = (label, { description, icon, tooltip } = {}) => {
                    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
                    if (icon && vscode.ThemeIcon) {
                        item.iconPath = new vscode.ThemeIcon(icon);
                    }
                    if (description) item.description = description;
                    if (tooltip && vscode.MarkdownString) {
                        const markdown = new vscode.MarkdownString(tooltip);
                        markdown.isTrusted = true;
                        item.tooltip = markdown;
                    } else if (tooltip) {
                        item.tooltip = tooltip;
                    }
                    return item;
                };

                const mkAction = (label, command, { args, ...options } = {}) => {
                    const item = mkItem(label, options);
                    item.command = {
                        command,
                        title: label,
                        arguments: Array.isArray(args) ? args : undefined,
                    };
                    return item;
                };

                const conn = connectionRuntime.loadStoredConn();
                const connected = Boolean(conn?.instanceUrl && conn?.accessToken);
                let host = '';
                try {
                    host = connected ? new URL(conn.instanceUrl).host : '';
                } catch {
                    host = '';
                }

                const items = [
                    mkItem(connected ? `Connected${host ? `: ${host}` : ''}` : 'Not connected', {
                        icon: connected ? 'cloud' : 'cloud-off',
                    }),
                    mkAction(
                        'Set Workspace API Version',
                        'salesforceMetadata.setWorkspaceApiVersion',
                        {
                            icon: 'versions',
                        }
                    ),
                    mkAction(
                        connected ? 'Disconnect' : 'Connect',
                        connected ? 'salesforceMetadata.disconnect' : 'salesforceMetadata.connect',
                        {
                            icon: connected ? 'sign-out' : 'sign-in',
                        }
                    ),
                ];
                if (connected) {
                    items.push(
                        mkAction(
                            'Sync Project (fetch/update/delete)',
                            'salesforceMetadata.fetchMetadata',
                            { icon: 'sync' }
                        ),
                        mkAction('Source Status', 'salesforceMetadata.sourceStatus', {
                            icon: 'diff',
                        }),
                        mkAction('Pull Remote Changes', 'salesforceMetadata.pullRemoteChanges', {
                            icon: 'cloud-download',
                        }),
                        mkAction('Show Output', 'salesforceMetadata.showOutput', {
                            icon: 'output',
                        })
                    );
                }
                items.push(
                    mkAction('Open Shell Terminal', 'salesforceMetadata.openShellTerminal', {
                        icon: 'terminal',
                    }),
                    mkAction('Run Shell Command', 'salesforceMetadata.runShellCommand', {
                        icon: 'play',
                    }),
                    mkAction('Open SOQL scratch', 'salesforceMetadata.openSoqlScratch', {
                        icon: 'edit',
                    })
                );
                return items;
            }
        }

        context.addDisposable(
            vscode.window.registerTreeDataProvider(
                'salesforceMetadata.salesforcePanel',
                new SfPanelProvider()
            )
        );
    } catch {
        // ignore
    }
}

export async function activate(vscodeBundle) {
    const context = createActivationContext(vscodeBundle);
    if (!context) {
        return { dispose() {} };
    }

    const { diagnostics, statusItem, vscode } = context;
    await applyExplorerExcludes(vscode);

    const connectionRuntime = createConnectionRuntime({ statusItem, vscode });
    connectionRuntime.setStatus(connectionRuntime.loadStoredConn());
    const setLoginProblem = createLoginProblemSetter({
        loginDiagnostics: diagnostics.login,
        vscode,
    });

    registerSalesforcePanelProvider({ connectionRuntime, context });

    const schemaTools = await registerSchemaTools({ connectionRuntime, context });
    registerShellIntegration({ connectionRuntime, context });
    registerLwcComponentScaffolding({ connectionRuntime, context });
    const deployTools = createDeployAndSourceTracking({
        connectionRuntime,
        context,
        isLwcDoc: schemaTools.isLwcDoc,
        lintLwcDocument: schemaTools.lintLwcDocument,
    });

    registerConnectionCommands({
        connectionRuntime,
        context,
        fetchAndPopulateWorkspace,
        invalidateToolingMap: deployTools.invalidateToolingMap,
        setLoginProblem,
    });
    registerMetadataApiCommands({
        connectionRuntime,
        context,
        deployTools,
    });
    registerQueryAndApexTools({
        connectionRuntime,
        context,
        deployTools,
    });

    return {
        dispose() {
            context.dispose();
        },
    };
}
