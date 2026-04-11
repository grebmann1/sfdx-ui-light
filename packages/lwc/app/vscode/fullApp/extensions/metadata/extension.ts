import { hasUsableConnection } from '../../workbench/workbenchConnection';
import {
    DEFAULT_SOURCE_API_VERSION,
    normalizeSfApiVersion,
} from '../../workbench/workbenchWorkspace';
import { buildSalesforceExtensionConfig } from '../core/extensionManifest';
import { registerCommand, registerSalesforceExtension } from '../core/extensionRegistration';
import {
    getActiveSalesforceWorkbenchHost,
    getOrCreateSalesforceWorkbenchHost,
} from '../salesforce/salesforceWorkbenchHost';

import { registerMetadataApiCommands } from './commands/metadataApiCommands';
import { registerQueryAndApexTools } from './commands/queryAndApexTools';
import { registerShellIntegration } from './commands/shellIntegration';
import { registerConnectionCommands } from './runtime/connectionRuntime';
import { registerSchemaTools } from './runtime/schemaTools';

export const EXTENSION_ID = 'salesforce.sf-metadata';

const OPEN_AGENT_CHAT_COMMAND = 'salesforceMetadata.openAgentChat';
const OPEN_SALESFORCE_PANEL_COMMAND = 'salesforceMetadata.openSalesforcePanel';
const OPEN_TOOLKIT_CONNECTIONS_COMMAND = 'salesforceMetadata.openToolkitConnections';
const SVG_MIME_TYPE = 'image/svg+xml';
const MIN_WORKSPACE_API_VERSION = 45;

const METADATA_EXTENSION_BASE_CONFIG = buildSalesforceExtensionConfig({
    name: 'sf-metadata',
    displayName: 'Salesforce Metadata (Workbench)',
    description: 'Core Salesforce metadata workflows and workspace sync for the workbench',
    contributes: {
        viewsContainers: {
            panel: [
                {
                    id: 'salesforcePanel',
                    title: 'Salesforce',
                    icon: '/workspace/vscode/salesforce-panel-icon.svg',
                },
            ],
        },
        views: {
            salesforcePanel: [
                {
                    id: 'salesforceMetadata.salesforcePanel',
                    name: 'Salesforce',
                },
            ],
        },
        commands: [
            {
                command: 'salesforceMetadata.setWorkspaceApiVersion',
                title: 'Salesforce: Set Workspace API Version',
            },
            {
                command: 'salesforceMetadata.fetchMetadata',
                title: 'Salesforce: Sync Project (fetch/update/delete)',
            },
            {
                command: 'salesforceMetadata.sourceStatus',
                title: 'Salesforce: Source Status (Tooling API)',
            },
            {
                command: 'salesforceMetadata.pullRemoteChanges',
                title: 'Salesforce: Pull Remote Changes (Tooling API)',
            },
            {
                command: 'salesforceMetadata.orgBrowser',
                title: 'Salesforce: Org Browser (Tooling API)',
            },
            {
                command: 'salesforceMetadata.retrieveManifest',
                title: 'Salesforce: Retrieve Source in Manifest (Tooling API)',
            },
            {
                command: 'salesforceMetadata.generateManifestFile',
                title: 'SFDX: Generate Manifest File',
            },
            {
                command: 'salesforceMetadata.retrieveMetadataApi',
                title: 'Salesforce: Retrieve Source in Manifest (Metadata API)',
            },
            {
                command: 'salesforceMetadata.retrieveMetadataApiPick',
                title: 'Salesforce: Retrieve (Metadata API)...',
            },
            {
                command: 'salesforceMetadata.deployMetadataApi',
                title: 'Salesforce: Deploy (Metadata API)',
            },
            {
                command: 'salesforceMetadata.validateDeployMetadataApi',
                title: 'Salesforce: Validate Deploy (Metadata API)',
            },
            {
                command: 'salesforceMetadata.whereUsed',
                title: 'Salesforce: Where Used / Dependencies (Tooling API)',
            },
            {
                command: 'salesforceMetadata.showOutput',
                title: 'Salesforce: Show Output (Workbench)',
            },
            {
                command: 'salesforceMetadata.installExtensions',
                title: 'Salesforce: Install Linting/Language Extensions (Open VSX)',
            },
            {
                command: 'salesforceMetadata.refreshProject',
                title: 'Salesforce: Refresh Project (alias of Sync Project)',
            },
            {
                command: 'salesforceMetadata.openNamespaceReport',
                title: 'Salesforce: Open Namespace/Managed Report',
            },
        ],
        menus: {
            commandPalette: [
                { command: 'salesforceMetadata.setWorkspaceApiVersion' },
                { command: 'salesforceMetadata.fetchMetadata' },
                { command: 'salesforceMetadata.sourceStatus' },
                { command: 'salesforceMetadata.pullRemoteChanges' },
                { command: 'salesforceMetadata.orgBrowser' },
                { command: 'salesforceMetadata.retrieveManifest' },
                { command: 'salesforceMetadata.retrieveMetadataApi' },
                { command: 'salesforceMetadata.retrieveMetadataApiPick' },
                { command: 'salesforceMetadata.deployMetadataApi' },
                { command: 'salesforceMetadata.validateDeployMetadataApi' },
                { command: 'salesforceMetadata.whereUsed' },
                { command: 'salesforceMetadata.showOutput' },
                { command: 'salesforceMetadata.installExtensions' },
                { command: 'salesforceMetadata.refreshProject' },
                { command: 'salesforceMetadata.openNamespaceReport' },
            ],
            'editor/context': [{ command: 'salesforceMetadata.fetchMetadata' }],
            'explorer/context': [
                {
                    command: 'salesforceMetadata.generateManifestFile',
                    when: 'resourceFilename != package.xml',
                    group: 'navigation',
                },
            ],
        },
    },
});

const BASE_INLINE_ASSETS = [
    {
        targetPath: '/workspace/vscode/salesforce-panel-icon.svg',
        mimeType: SVG_MIME_TYPE,
        content: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <path fill="#00A1E0" d="M12 2c-2.7 0-5.1 1.3-6.7 3.3C4.5 5.1 3.8 5 3 5 1.3 5 0 6.3 0 8c0 1.5 1 2.7 2.4 3 0 .3-.1.7-.1 1 0 4.9 4 9 8.9 9 2.2 0 4.2-.8 5.8-2.1.4.1.8.1 1.2.1 2.2 0 4-1.8 4-4 0-.4-.1-.8-.2-1.2 1.1-.7 1.9-1.9 1.9-3.3 0-2.2-1.8-4-4-4-.3 0-.6 0-.9.1C18.3 3.7 15.4 2 12 2z"/>
</svg>`,
    },
];

function buildMetadataExtensionConfig() {
    const contributes = METADATA_EXTENSION_BASE_CONFIG.contributes || {};
    const commandPalette =
        (contributes as { menus?: { commandPalette?: Array<{ command: string }> } }).menus
            ?.commandPalette || [];
    const baseCommands =
        (contributes as { commands?: Array<{ command: string; title: string }> }).commands || [];

    return {
        ...METADATA_EXTENSION_BASE_CONFIG,
        contributes: {
            ...contributes,
            commands: [
                ...baseCommands,
                {
                    command: OPEN_SALESFORCE_PANEL_COMMAND,
                    title: 'Salesforce: Open Salesforce Panel',
                },
                {
                    command: OPEN_AGENT_CHAT_COMMAND,
                    title: 'Salesforce: Open Agent Chat',
                },
            ],
            menus: {
                ...(contributes as { menus?: Record<string, unknown> }).menus,
                commandPalette: [
                    ...commandPalette,
                    { command: OPEN_SALESFORCE_PANEL_COMMAND },
                    { command: OPEN_AGENT_CHAT_COMMAND },
                ],
            },
        },
    };
}

function buildInlineAssets(_options: { orgContext?: unknown } = {}) {
    return [...BASE_INLINE_ASSETS];
}

export function getActiveMetadataExtensionServices() {
    return getActiveSalesforceWorkbenchHost();
}

function createNonce() {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function buildApiVersionOptions(apiVersion: string) {
    const normalizedApiVersion = normalizeSfApiVersion(apiVersion, DEFAULT_SOURCE_API_VERSION);
    const selectedMajor = Number.parseInt(normalizedApiVersion, 10);
    const defaultMajor = Number.parseInt(DEFAULT_SOURCE_API_VERSION, 10);
    const maxMajor = Math.max(
        Number.isFinite(selectedMajor) ? selectedMajor : MIN_WORKSPACE_API_VERSION,
        Number.isFinite(defaultMajor) ? defaultMajor : MIN_WORKSPACE_API_VERSION
    );
    const options = [];
    for (let major = maxMajor; major >= MIN_WORKSPACE_API_VERSION; major -= 1) {
        options.push(`${major}.0`);
    }
    if (!options.includes(normalizedApiVersion)) {
        options.unshift(normalizedApiVersion);
    }
    return options;
}

async function getSalesforcePanelState(connectionRuntime) {
    const conn = connectionRuntime.loadStoredConn();
    const connected = hasUsableConnection(conn);
    let host = '';
    try {
        host = connected ? new URL(conn.instanceUrl).host : '';
    } catch {
        host = '';
    }
    const apiVersion = connected
        ? await connectionRuntime.getWorkspaceApiVersion(
              conn?.apiVersion || DEFAULT_SOURCE_API_VERSION
          )
        : '';
    return {
        conn,
        connected,
        host,
        apiVersion,
        apiVersionOptions: connected ? buildApiVersionOptions(apiVersion) : [],
        problemMessage: connected ? '' : connectionRuntime.getConnectionProblemMessage(conn),
    };
}

function getSalesforcePanelHtml({
    nonce,
    connected,
    host,
    apiVersion,
    apiVersionOptions,
    problemMessage,
}: {
    nonce: string;
    connected: boolean;
    host: string;
    apiVersion: string;
    apiVersionOptions: string[];
    problemMessage: string;
}) {
    const statusTone = connected ? '#0f766e' : '#8a2c0d';
    const statusBackground = connected ? '#ecfdf5' : '#fff7ed';
    const statusBorder = connected ? '#99f6e4' : '#fdba74';
    const title = connected ? 'Salesforce connected' : 'Salesforce disconnected';
    const subtitle = connected
        ? host || 'Your org is ready to use in this workspace.'
        : 'Reconnect from the parent Salesforce Toolkit session to enable org features.';
    const detail = connected
        ? 'Use the actions below to sync metadata, inspect source status, and work with your org.'
        : problemMessage || 'A connected toolkit session is required for Salesforce features.';
    const primaryLabel = connected ? 'Sync Project' : 'Connect to Salesforce';
    const primaryCommand = connected
        ? 'salesforceMetadata.fetchMetadata'
        : 'salesforceMetadata.openToolkitConnections';
    const secondaryActions = connected
        ? `
            <button class="sfButton sfButtonSecondary" data-command="salesforceMetadata.sourceStatus">Source Status</button>
            <button class="sfButton sfButtonSecondary" data-command="salesforceMetadata.openSoqlScratch">Open SOQL Scratch</button>
            <button class="sfButton sfButtonSecondary" data-command="salesforceMetadata.openAgentChat">Open Agent Chat</button>
        `
        : `
            <button class="sfButton sfButtonSecondary" data-command="salesforceMetadata.openAgentChat">Open Agent Chat</button>
        `;
    const apiVersionOptionsHtml = connected
        ? apiVersionOptions
              .map(
                  option =>
                      `<option value="${option}"${option === apiVersion ? ' selected' : ''}>${option}</option>`
              )
              .join('')
        : '';
    const footerContent = connected
        ? `
            <div class="sfFooterVersion">
                <label class="sfFooterLabel" for="sfWorkspaceApiVersion">Workspace API version</label>
                <div class="sfFooterControls">
                    <select id="sfWorkspaceApiVersion" class="sfSelect" aria-label="Workspace API version">
                        ${apiVersionOptionsHtml}
                    </select>
                    <button
                        class="sfButton sfButtonSecondary sfFooterButton"
                        data-command="salesforceMetadata.setWorkspaceApiVersion"
                        data-arg-source="sfWorkspaceApiVersion">Apply</button>
                </div>
            </div>
        `
        : 'Schema and metadata commands will activate once you reconnect.';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta
        http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
        body {
            margin: 0;
            padding: 12px;
            font: 12px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            color: var(--vscode-foreground, #1f2328);
            background: transparent;
        }
        .sfCard {
            border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
            border-radius: 10px;
            background: var(--vscode-editor-background, #ffffff);
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
            overflow: hidden;
        }
        .sfHeader {
            padding: 12px 12px 10px;
            border-bottom: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.25));
            background: linear-gradient(180deg, rgba(0, 161, 224, 0.10), rgba(0, 161, 224, 0.02));
        }
        .sfEyebrow {
            margin: 0 0 6px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--vscode-descriptionForeground, #6a737d);
        }
        .sfTitle {
            margin: 0;
            font-size: 16px;
            font-weight: 700;
        }
        .sfSubtitle {
            margin: 6px 0 0;
            color: var(--vscode-descriptionForeground, #6a737d);
        }
        .sfBody {
            padding: 12px;
            display: grid;
            gap: 12px;
        }
        .sfStatus {
            padding: 10px 12px;
            border-radius: 8px;
            border: 1px solid ${statusBorder};
            background: ${statusBackground};
            color: ${statusTone};
        }
        .sfStatus strong {
            display: block;
            margin-bottom: 4px;
            font-size: 12px;
        }
        .sfActions {
            display: grid;
            gap: 8px;
        }
        .sfButton {
            width: 100%;
            border: 1px solid transparent;
            border-radius: 8px;
            padding: 9px 10px;
            font: inherit;
            cursor: pointer;
            text-align: left;
        }
        .sfButtonPrimary {
            background: #0176d3;
            color: #ffffff;
        }
        .sfButtonSecondary {
            background: var(--vscode-button-secondaryBackground, rgba(128, 128, 128, 0.14));
            color: var(--vscode-button-secondaryForeground, var(--vscode-foreground, #1f2328));
            border-color: var(--vscode-panel-border, rgba(128, 128, 128, 0.25));
        }
        .sfFooter {
            margin-top: 2px;
            color: var(--vscode-descriptionForeground, #6a737d);
        }
        .sfFooterVersion {
            display: grid;
            gap: 8px;
        }
        .sfFooterLabel {
            font-weight: 600;
            color: var(--vscode-foreground, #1f2328);
        }
        .sfFooterControls {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 8px;
            align-items: center;
        }
        .sfFooterButton {
            width: auto;
            text-align: center;
            white-space: nowrap;
        }
        .sfSelect {
            width: 100%;
            border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.25));
            border-radius: 8px;
            padding: 8px 10px;
            font: inherit;
            color: var(--vscode-foreground, #1f2328);
            background: var(--vscode-input-background, rgba(128, 128, 128, 0.08));
        }
    </style>
</head>
<body>
    <div class="sfCard">
        <div class="sfHeader">
            <p class="sfEyebrow">Salesforce</p>
            <h2 class="sfTitle">${title}</h2>
            <p class="sfSubtitle">${subtitle}</p>
        </div>
        <div class="sfBody">
            <div class="sfStatus">
                <strong>${connected ? 'Org ready' : 'Connection required'}</strong>
                <span>${detail}</span>
            </div>
            <div class="sfActions">
                <button class="sfButton sfButtonPrimary" data-command="${primaryCommand}">${primaryLabel}</button>
                ${secondaryActions}
            </div>
            <div class="sfFooter">
                ${footerContent}
            </div>
        </div>
    </div>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        document.querySelectorAll('[data-command]').forEach(button => {
            button.addEventListener('click', () => {
                const argSource = button.getAttribute('data-arg-source');
                const argElement = argSource ? document.getElementById(argSource) : null;
                vscode.postMessage({
                    type: 'command',
                    command: button.getAttribute('data-command'),
                    args: argElement ? [argElement.value] : []
                });
            });
        });
    </script>
</body>
</html>`;
}

function registerSalesforcePanelProvider({ connectionRuntime, context }) {
    const { vscode } = context;
    try {
        if (typeof vscode.window?.registerWebviewViewProvider === 'function') {
            let activeView: {
                webview?: { html?: string; options?: Record<string, unknown> };
            } | null = null;
            let renderSequence = 0;

            const render = async () => {
                if (!activeView?.webview) {
                    return;
                }
                const currentRenderSequence = ++renderSequence;
                const nonce = createNonce();
                const state = await getSalesforcePanelState(connectionRuntime);
                if (currentRenderSequence !== renderSequence || !activeView?.webview) {
                    return;
                }
                activeView.webview.options = {
                    enableScripts: true,
                };
                activeView.webview.html = getSalesforcePanelHtml({
                    nonce,
                    connected: state.connected,
                    host: state.host,
                    apiVersion: state.apiVersion,
                    apiVersionOptions: state.apiVersionOptions,
                    problemMessage: state.problemMessage,
                });
            };

            const provider = {
                resolveWebviewView(view) {
                    activeView = view;
                    view.webview.onDidReceiveMessage?.(async message => {
                        if (message?.type !== 'command' || !message.command) {
                            return;
                        }
                        try {
                            const args = Array.isArray(message.args) ? message.args : [];
                            await vscode.commands.executeCommand(String(message.command), ...args);
                            await render();
                        } catch {
                            // ignore command errors from webview actions
                        }
                    });
                    void render();
                },
            };

            const removeStatusListener = connectionRuntime.addStatusChangeListener(() => {
                void render();
            });

            context.addDisposable(
                vscode.window.registerWebviewViewProvider(
                    'salesforceMetadata.salesforcePanel',
                    provider
                )
            );
            context.addDisposable({
                dispose() {
                    activeView = null;
                    removeStatusListener();
                },
            });
            return;
        }

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

                const mkItem = (
                    label,
                    {
                        description,
                        icon,
                        tooltip,
                    }: { description?: string; icon?: string; tooltip?: string } = {}
                ) => {
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

                const mkAction = (
                    label,
                    command,
                    {
                        args,
                        ...options
                    }: {
                        args?: unknown[];
                        description?: string;
                        icon?: string;
                        tooltip?: string;
                    } = {}
                ) => {
                    const item = mkItem(label, options);
                    item.command = {
                        command,
                        title: label,
                        arguments: Array.isArray(args) ? args : undefined,
                    };
                    return item;
                };

                const conn = connectionRuntime.loadStoredConn();
                const connected = hasUsableConnection(conn);
                let host = '';
                try {
                    host = connected ? new URL(conn.instanceUrl).host : '';
                } catch {
                    host = '';
                }

                const items = [
                    mkItem(connected ? `Connected${host ? `: ${host}` : ''}` : 'Disconnected', {
                        icon: connected ? 'cloud' : 'cloud-off',
                        description: connected
                            ? 'Salesforce org ready'
                            : 'Toolkit session required',
                        tooltip: connected
                            ? `Status: Connected${host ? `\nHost: ${host}` : ''}`
                            : connectionRuntime.getConnectionProblemMessage(conn),
                    }),
                ];
                if (!connected) {
                    items.push(
                        mkAction('Connect to Salesforce', OPEN_TOOLKIT_CONNECTIONS_COMMAND, {
                            icon: 'account',
                            description: 'Open toolkit connections',
                            tooltip: 'Reconnect from the parent Salesforce Toolkit session.',
                        })
                    );
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
                        mkAction('Show Output', 'salesforceMetadata.showOutput', { icon: 'output' })
                    );
                }
                items.push(
                    mkAction('Open SOQL scratch', 'salesforceMetadata.openSoqlScratch', {
                        icon: 'edit',
                    })
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

    registerCommand(context, vscode, OPEN_SALESFORCE_PANEL_COMMAND, async () => {
        try {
            await vscode.commands.executeCommand('workbench.view.extension.salesforcePanel');
        } catch {
            await vscode.window.showInformationMessage(
                'Open the Salesforce panel from the workbench footer if it is not visible yet.'
            );
        }
    });

    registerCommand(context, vscode, OPEN_TOOLKIT_CONNECTIONS_COMMAND, async () => {
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

    registerCommand(context, vscode, OPEN_AGENT_CHAT_COMMAND, async () => {
        const commandAttempts = [
            {
                id: 'workbench.action.chat.open',
                args: [{ mode: 'agent', query: '@workbench-agent ', isPartialQuery: true }],
            },
            {
                id: 'workbench.action.chat.open',
                args: [{ mode: 'agent' }],
            },
            {
                id: 'workbench.action.quickchat.toggle',
                args: [],
            },
        ];
        for (const attempt of commandAttempts) {
            try {
                await vscode.commands.executeCommand(attempt.id, ...(attempt.args || []));
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

export async function register(vscodeBundle, { orgContext }: { orgContext?: unknown } = {}) {
    void orgContext;
    return registerSalesforceExtension(
        vscodeBundle,
        {
            config: buildMetadataExtensionConfig(),
            inlineAssets: buildInlineAssets(),
        },
        async () => {
            const sfHost = await getOrCreateSalesforceWorkbenchHost(vscodeBundle);
            if (!sfHost) return;

            await sfHost.activateFeatureOnce(
                'salesforce-schema-tools',
                async ({ connectionRuntime, context }) => {
                    sfHost.setSchemaTools(
                        await registerSchemaTools({ connectionRuntime, context })
                    );
                }
            );

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
