import { buildSalesforceExtensionConfig } from '../salesforce/salesforceExtensionSupport.js';

const OPEN_AGENT_CHAT_COMMAND = 'salesforceMetadata.openAgentChat';
const OPEN_SALESFORCE_PANEL_COMMAND = 'salesforceMetadata.openSalesforcePanel';

const SVG_MIME_TYPE = 'image/svg+xml';

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
            {
                command: 'salesforceMetadata.openShellTerminal',
                title: 'Salesforce: Open Shell Terminal',
            },
            {
                command: 'salesforceMetadata.runShellCommand',
                title: 'Salesforce: Run Shell Command',
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
                { command: 'salesforceMetadata.openShellTerminal' },
                { command: 'salesforceMetadata.runShellCommand' },
            ],
            'editor/context': [{ command: 'salesforceMetadata.fetchMetadata' }],
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

export function buildMetadataExtensionConfig() {
    const contributes = METADATA_EXTENSION_BASE_CONFIG.contributes || {};
    const commandPalette = contributes.menus?.commandPalette || [];

    return {
        ...METADATA_EXTENSION_BASE_CONFIG,
        contributes: {
            ...contributes,
            commands: [
                ...contributes.commands,
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
                ...contributes.menus,
                commandPalette: [
                    ...commandPalette,
                    { command: OPEN_SALESFORCE_PANEL_COMMAND },
                    { command: OPEN_AGENT_CHAT_COMMAND },
                ],
            },
        },
    };
}

export function buildInlineAssets({ orgContext } = {}) {
    return [
        ...BASE_INLINE_ASSETS,
    ];
}
