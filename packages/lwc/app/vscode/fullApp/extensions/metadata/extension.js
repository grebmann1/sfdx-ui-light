import { registerMetadataApiCommands } from './commands/metadataApiCommands.js';
import { registerQueryAndApexTools } from './commands/queryAndApexTools.js';
import { registerShellIntegration } from './commands/shellIntegration.js';
import { buildInlineAssets, buildMetadataExtensionConfig } from './extensionConfig.js';
import { registerConnectionCommands } from './runtime/connectionRuntime.js';
import { registerSalesforceExtension } from '../shared.js';
import { getOrCreateSalesforceWorkbenchHost, getActiveSalesforceWorkbenchHost } from '../salesforce/salesforceWorkbenchHost.js';

export const EXTENSION_ID = 'salesforce.sf-metadata';

const OPEN_AGENT_CHAT_COMMAND = 'salesforceMetadata.openAgentChat';
const OPEN_SALESFORCE_PANEL_COMMAND = 'salesforceMetadata.openSalesforcePanel';
const OPEN_TOOLKIT_CONNECTIONS_COMMAND = 'salesforceMetadata.openToolkitConnections';

export function getActiveMetadataExtensionServices() {
    return getActiveSalesforceWorkbenchHost();
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

        const treeDataEmitter =
            typeof vscode.EventEmitter === 'function' ? new vscode.EventEmitter() : null;

        class SfPanelProvider {
            get onDidChangeTreeData() {
                return treeDataEmitter?.event;
            }

            refresh() {
                treeDataEmitter?.fire?.();
            }

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
                const connected = Boolean(
                    conn?.instanceUrl &&
                        conn?.accessToken &&
                        !conn?.sessionHasExpired &&
                        !conn?.hasError
                );
                let host = '';
                try {
                    host = connected ? new URL(conn.instanceUrl).host : '';
                } catch {
                    host = '';
                }

                const items = [
                    mkItem(connected ? `Connected${host ? `: ${host}` : ''}` : 'Disconnected', {
                        icon: connected ? 'cloud' : 'cloud-off',
                        tooltip: connected
                            ? `Status: Connected${host ? `\nHost: ${host}` : ''}`
                            : connectionRuntime.getConnectionProblemMessage(conn),
                    }),
                ];
                if (!connected) {
                    return items;
                }

                items.push(
                    mkAction(
                        'Set Workspace API Version',
                        'salesforceMetadata.setWorkspaceApiVersion',
                        { icon: 'versions' }
                    )
                );
                if (connected) {
                    items.push(
                        mkAction('Sync Project (fetch/update/delete)', 'salesforceMetadata.fetchMetadata', { icon: 'sync' }),
                        mkAction('Source Status', 'salesforceMetadata.sourceStatus', { icon: 'diff' }),
                        mkAction('Pull Remote Changes', 'salesforceMetadata.pullRemoteChanges', { icon: 'cloud-download' }),
                        mkAction('Show Output', 'salesforceMetadata.showOutput', { icon: 'output' })
                    );
                }
                items.push(
                    mkAction('Open Shell Terminal', 'salesforceMetadata.openShellTerminal', { icon: 'terminal' }),
                    mkAction('Run Shell Command', 'salesforceMetadata.runShellCommand', { icon: 'play' }),
                    mkAction('Open SOQL scratch', 'salesforceMetadata.openSoqlScratch', { icon: 'edit' })
                );
                return items;
            }
        }

        const provider = new SfPanelProvider();
        const removeStatusListener = connectionRuntime.addStatusChangeListener(() => {
            provider.refresh();
        });

        context.addDisposable(
            vscode.window.registerTreeDataProvider('salesforceMetadata.salesforcePanel', provider)
        );
        context.addDisposable({
            dispose() {
                treeDataEmitter?.dispose?.();
                removeStatusListener();
            },
        });
    } catch {
        // ignore
    }
}

function registerMetadataCommands({ context }) {
    const { vscode } = context;
    const register = (command, handler) =>
        context.addDisposable(vscode.commands.registerCommand(command, handler));

    register(OPEN_SALESFORCE_PANEL_COMMAND, async () => {
        try {
            await vscode.commands.executeCommand('workbench.view.extension.salesforcePanel');
        } catch {
            await vscode.window.showInformationMessage(
                'Open the Salesforce panel from the workbench footer if it is not visible yet.'
            );
        }
    });

    register(OPEN_TOOLKIT_CONNECTIONS_COMMAND, async () => {
        try {
            const targetUrl = new URL('/views/app.html', globalThis.location?.href || '/');
            targetUrl.searchParams.set('applicationName', 'connections');
            if (typeof vscode.env?.openExternal === 'function') {
                await vscode.env.openExternal(vscode.Uri.parse(targetUrl.toString()));
                return;
            }
            globalThis.location?.assign?.(targetUrl.toString());
        } catch {
            await vscode.window.showInformationMessage(
                'Open the Salesforce Toolkit connections page to log in.'
            );
        }
    });

    register(OPEN_AGENT_CHAT_COMMAND, async () => {
        const commandIds = ['workbench.action.chat.open', 'workbench.action.quickchat.toggle'];
        for (const commandId of commandIds) {
            try {
                await vscode.commands.executeCommand(commandId);
                return;
            } catch {
                // try the next fallback
            }
        }
        await vscode.window.showInformationMessage(
            'The embedded agent chat is unavailable right now. Try opening chat from the workbench UI.'
        );
    });
}

export async function register(vscodeBundle, { orgContext } = {}) {
    return registerSalesforceExtension(
        vscodeBundle,
        {
            config: buildMetadataExtensionConfig({ orgContext }),
            inlineAssets: buildInlineAssets({ orgContext }),
        },
        async (_vscode, { push }) => {
            const sfHost = await getOrCreateSalesforceWorkbenchHost(vscodeBundle);
            if (!sfHost) return;

            await sfHost.activateFeatureOnce(
                'salesforce-metadata',
                async ({ connectionRuntime, context, deployTools }) => {
                    registerSalesforcePanelProvider({ connectionRuntime, context });
                    registerMetadataCommands({ context });
                    registerShellIntegration({ connectionRuntime, context });
                    deployTools.registerCommandGroups(['metadata']);
                    registerConnectionCommands({
                        connectionRuntime,
                        context,
                        setLoginProblem: sfHost.setLoginProblem || (() => undefined),
                    });
                    registerMetadataApiCommands({ connectionRuntime, context, deployTools });
                    registerQueryAndApexTools({
                        connectionRuntime,
                        context,
                        deployTools,
                        commandGroups: ['metadata'],
                    });
                }
            );
        }
    );
}
