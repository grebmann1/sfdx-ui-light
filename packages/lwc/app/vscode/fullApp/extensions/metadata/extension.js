import { createDeployAndSourceTracking } from './commands/deployAndSourceTracking.js';
import { registerLwcComponentScaffolding } from './commands/lwcComponentScaffolding.js';
import { registerMetadataApiCommands } from './commands/metadataApiCommands.js';
import { registerQueryAndApexTools } from './commands/queryAndApexTools.js';
import { registerShellIntegration } from './commands/shellIntegration.js';
import {
    APEX_LANGUAGE_ASSETS,
    LWC_SNIPPET_ASSETS,
    buildInlineAssets,
    buildMetadataExtensionConfig,
    METADATA_WALKTHROUGH_FULL_ID,
    ONBOARDING_MARKDOWN_PATH,
    OPEN_AGENT_CHAT_COMMAND,
    OPEN_ONBOARDING_COMMAND,
    OPEN_SALESFORCE_PANEL_COMMAND,
    WEB_LANGUAGE_ASSETS,
} from './constants.js';
import { createActivationContext } from './core/activationContext.js';
import {
    createConnectionRuntime,
    createLoginProblemSetter,
    registerConnectionCommands,
    tryRestoreStartupConnection,
} from './runtime/connectionRuntime.js';
import { registerSchemaTools } from './runtime/schemaTools.js';
import { fetchAndPopulateWorkspace } from './runtime/workspaceSync.js';

export { EXTENSION_ID } from './constants.js';

function createObjectUrl(content, mimeType) {
    return URL.createObjectURL(new Blob([content], { type: mimeType }));
}

async function fetchTextAsset(sourcePath) {
    const response = await fetch(sourcePath);
    return response.text();
}

async function loadRemoteAssets(filesOrContents, assets) {
    const loadedAssets = await Promise.all(
        assets.map(async ({ sourcePath, targetPath, mimeType }) => ({
            targetPath,
            objectUrl: createObjectUrl(await fetchTextAsset(sourcePath), mimeType),
        }))
    );

    for (const { targetPath, objectUrl } of loadedAssets) {
        filesOrContents.set(targetPath, objectUrl);
    }
}

function loadInlineAssets(filesOrContents, assets) {
    for (const { targetPath, mimeType, content } of assets) {
        filesOrContents.set(targetPath, createObjectUrl(content, mimeType));
    }
}

async function tryLoadAssetGroup(loadGroup) {
    try {
        await loadGroup();
    } catch {
        // ignore
    }
}

export async function loadExtension(options = {}) {
    const filesOrContents = new Map();

    await tryLoadAssetGroup(() =>
        Promise.resolve(loadInlineAssets(filesOrContents, buildInlineAssets(options)))
    );
    await tryLoadAssetGroup(() => loadRemoteAssets(filesOrContents, APEX_LANGUAGE_ASSETS));
    await tryLoadAssetGroup(() => loadRemoteAssets(filesOrContents, WEB_LANGUAGE_ASSETS));
    await tryLoadAssetGroup(() => loadRemoteAssets(filesOrContents, LWC_SNIPPET_ASSETS));

    return {
        config: buildMetadataExtensionConfig(options),
        filesOrContents,
    };
}

let activeMetadataExtensionServices = null;

export function getActiveMetadataExtensionServices() {
    return activeMetadataExtensionServices;
}

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

function registerOnboardingCommands({ context }) {
    const { vscode } = context;
    const register = (command, handler) =>
        context.addDisposable(vscode.commands.registerCommand(command, handler));

    register(OPEN_ONBOARDING_COMMAND, async () => {
        try {
            await vscode.commands.executeCommand(
                'workbench.action.openWalkthrough',
                METADATA_WALKTHROUGH_FULL_ID,
                false
            );
            return;
        } catch {
            // Fall through to the markdown fallback below.
        }

        try {
            const doc = await vscode.workspace.openTextDocument(
                vscode.Uri.file(ONBOARDING_MARKDOWN_PATH)
            );
            await vscode.window.showTextDocument(doc, { preview: false });
        } catch {
            await vscode.window.showInformationMessage(
                'The custom welcome page is not ready yet. Try the command again in a moment.'
            );
        }
    });

    register(OPEN_SALESFORCE_PANEL_COMMAND, async () => {
        try {
            await vscode.commands.executeCommand('workbench.view.extension.salesforcePanel');
        } catch {
            await vscode.window.showInformationMessage(
                'Open the Salesforce panel from the workbench footer if it is not visible yet.'
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

export async function activate(vscodeBundle) {
    const context = createActivationContext(vscodeBundle);
    if (!context) {
        return { dispose() {} };
    }

    const { diagnostics, statusItem, vscode } = context;
    await applyExplorerExcludes(vscode);

    const connectionRuntime = createConnectionRuntime({ statusItem, vscode });
    connectionRuntime.setStatus(connectionRuntime.loadStoredConn());
    const activeServices = { connectionRuntime, context };
    activeMetadataExtensionServices = activeServices;
    const setLoginProblem = createLoginProblemSetter({
        loginDiagnostics: diagnostics.login,
        vscode,
    });

    registerSalesforcePanelProvider({ connectionRuntime, context });
    registerOnboardingCommands({ context });

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
    await tryRestoreStartupConnection({
        connectionRuntime,
        vscode,
        setLoginProblem,
    });

    return {
        dispose() {
            if (activeMetadataExtensionServices === activeServices) {
                activeMetadataExtensionServices = null;
            }
            context.dispose();
        },
    };
}
