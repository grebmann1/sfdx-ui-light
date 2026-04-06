import { buildOrgContext, ORG_ENVIRONMENT_TYPES } from '../../workbench/orgContext.js';

export const EXTENSION_ID = 'salesforce.sf-metadata';
export const AUTO_DEPLOY_KEY = 'sf_ext_autoDeployOnSave';
export const ONBOARDING_WALKTHROUGH_ID = 'workbenchOnboarding';
export const METADATA_WALKTHROUGH_FULL_ID = `${EXTENSION_ID}#${ONBOARDING_WALKTHROUGH_ID}`;
export const ONBOARDING_MARKDOWN_PATH = '/workspace/walkthroughs/workbench-onboarding.md';
export const OPEN_ONBOARDING_COMMAND = 'salesforceMetadata.openOnboarding';
export const OPEN_AGENT_CHAT_COMMAND = 'salesforceMetadata.openAgentChat';
export const OPEN_SALESFORCE_PANEL_COMMAND = 'salesforceMetadata.openSalesforcePanel';

export const ANSI = {
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

const METADATA_EXTENSION_BASE_CONFIG = {
    name: 'sf-metadata',
    displayName: 'Salesforce Metadata (Workbench)',
    description: 'Fetch Salesforce metadata into the workbench Explorer',
    version: '0.0.2',
    publisher: 'salesforce',
    license: 'MIT',
    engines: { vscode: '*' },
    activationEvents: ['*'],
    contributes: {
        viewsContainers: {
            panel: [
                {
                    id: 'salesforcePanel',
                    title: 'Salesforce',
                    icon: '/workspace/salesforce-panel-icon.svg',
                },
            ],
        },
        views: {
            salesforcePanel: [
                {
                    id: 'salesforceMetadata.salesforcePanel',
                    name: 'Salesforce',
                },
                {
                    id: 'salesforceMetadata.schemaExplorer',
                    name: 'Schema',
                },
            ],
        },
        languages: [
            {
                id: 'apex',
                aliases: ['Apex'],
                extensions: ['.cls', '.trigger'],
                configuration: '/workspace/apex.configuration.json',
            },
            { id: 'soql', aliases: ['SOQL'], extensions: ['.soql'] },
            {
                id: 'javascript',
                aliases: ['JavaScript'],
                extensions: ['.js', '.mjs', '.cjs'],
                configuration: '/workspace/javascript-language-configuration.json',
            },
            {
                id: 'javascriptreact',
                aliases: ['JavaScript React'],
                extensions: ['.jsx'],
                configuration: '/workspace/javascript-language-configuration.json',
            },
            {
                id: 'typescript',
                aliases: ['TypeScript'],
                extensions: ['.ts'],
                configuration: '/workspace/typescript-language-configuration.json',
            },
            {
                id: 'typescriptreact',
                aliases: ['TypeScript React'],
                extensions: ['.tsx'],
                configuration: '/workspace/typescript-language-configuration.json',
            },
            {
                id: 'html',
                aliases: ['HTML'],
                extensions: ['.html', '.htm'],
                configuration: '/workspace/html-language-configuration.json',
            },
            {
                id: 'css',
                aliases: ['CSS'],
                extensions: ['.css'],
                configuration: '/workspace/css-language-configuration.json',
            },
        ],
        grammars: [
            {
                language: 'apex',
                scopeName: 'source.apex',
                path: '/workspace/apex.tmLanguage',
            },
            {
                language: 'soql',
                scopeName: 'source.soql',
                path: '/workspace/soql.tmLanguage',
            },
            {
                language: 'javascript',
                scopeName: 'source.js',
                path: '/workspace/JavaScript.tmLanguage.json',
            },
            {
                language: 'javascriptreact',
                scopeName: 'source.js.jsx',
                path: '/workspace/JavaScriptReact.tmLanguage.json',
            },
            {
                language: 'typescript',
                scopeName: 'source.ts',
                path: '/workspace/TypeScript.tmLanguage.json',
            },
            {
                language: 'typescriptreact',
                scopeName: 'source.tsx',
                path: '/workspace/TypeScriptReact.tmLanguage.json',
            },
            {
                language: 'html',
                scopeName: 'text.html.basic',
                path: '/workspace/html.tmLanguage.json',
            },
            { language: 'css', scopeName: 'source.css', path: '/workspace/css.tmLanguage.json' },
            {
                scopeName: 'documentation.injection.ts',
                path: '/workspace/jsdoc.ts.injection.tmLanguage.json',
                injectTo: ['source.ts', 'source.tsx'],
            },
            {
                scopeName: 'documentation.injection.js.jsx',
                path: '/workspace/jsdoc.js.injection.tmLanguage.json',
                injectTo: ['source.js', 'source.js.jsx'],
            },
        ],
        snippets: [
            { language: 'javascript', path: '/workspace/lwc-js.code-snippets' },
            { language: 'html', path: '/workspace/lwc-html.code-snippets' },
        ],
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
                command: 'salesforceMetadata.runSoqlQuery',
                title: 'Salesforce: Run SOQL Query (REST)',
            },
            {
                command: 'salesforceMetadata.runToolingQuery',
                title: 'Salesforce: Run Tooling Query (Tooling API)',
            },
            {
                command: 'salesforceMetadata.openSoqlScratch',
                title: 'Salesforce: Open SOQL Scratch',
            },
            {
                command: 'salesforceMetadata.refreshSchemaCache',
                title: 'Salesforce: Refresh Schema Cache',
            },
            {
                command: 'salesforceMetadata.executeAnonymous',
                title: 'Salesforce: Execute Anonymous Apex (Tooling API)',
            },
            {
                command: 'salesforceMetadata.runApexTests',
                title: 'Salesforce: Run Apex Tests (Tooling API)',
            },
            {
                command: 'salesforceMetadata.enableDebugLogs',
                title: 'Salesforce: Enable Debug Logs (Tooling API)',
            },
            {
                command: 'salesforceMetadata.openDebugLogs',
                title: 'Salesforce: Open Debug Logs (Tooling API)',
            },
            {
                command: 'salesforceMetadata.whereUsed',
                title: 'Salesforce: Where Used / Dependencies (Tooling API)',
            },
            {
                command: 'salesforceMetadata.diffCurrentFile',
                title: 'Salesforce: Diff Current File (local vs org)',
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
                command: 'salesforceMetadata.lintCurrentFile',
                title: 'Salesforce: Lint Current File (LWC ESLint)',
            },
            {
                command: 'salesforceMetadata.deployCurrentFile',
                title: 'Salesforce: Deploy Current File (Tooling API)',
            },
            {
                command: 'salesforceMetadata.fetchCurrentFile',
                title: 'Salesforce: Fetch Current File (Tooling API)',
            },
            {
                command: 'salesforceMetadata.deployChangedFiles',
                title: 'Salesforce: Deploy Changed Files (Tooling API)',
            },
            {
                command: 'salesforceMetadata.toggleAutoDeploy',
                title: 'Salesforce: Toggle Auto Deploy on Save',
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
            {
                command: 'salesforceMetadata.createLightningComponent',
                title: 'Salesforce: Create Lightning Component',
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
                { command: 'salesforceMetadata.runSoqlQuery' },
                { command: 'salesforceMetadata.runToolingQuery' },
                { command: 'salesforceMetadata.openSoqlScratch' },
                { command: 'salesforceMetadata.refreshSchemaCache' },
                { command: 'salesforceMetadata.executeAnonymous' },
                { command: 'salesforceMetadata.runApexTests' },
                { command: 'salesforceMetadata.enableDebugLogs' },
                { command: 'salesforceMetadata.openDebugLogs' },
                { command: 'salesforceMetadata.whereUsed' },
                { command: 'salesforceMetadata.diffCurrentFile' },
                { command: 'salesforceMetadata.showOutput' },
                { command: 'salesforceMetadata.installExtensions' },
                { command: 'salesforceMetadata.lintCurrentFile' },
                { command: 'salesforceMetadata.deployCurrentFile' },
                { command: 'salesforceMetadata.fetchCurrentFile' },
                { command: 'salesforceMetadata.deployChangedFiles' },
                { command: 'salesforceMetadata.toggleAutoDeploy' },
                { command: 'salesforceMetadata.refreshProject' },
                { command: 'salesforceMetadata.openNamespaceReport' },
                { command: 'salesforceMetadata.openShellTerminal' },
                { command: 'salesforceMetadata.runShellCommand' },
                { command: 'salesforceMetadata.createLightningComponent' },
            ],
            'editor/context': [
                { command: 'salesforceMetadata.fetchMetadata' },
                { command: 'salesforceMetadata.fetchCurrentFile' },
                { command: 'salesforceMetadata.diffCurrentFile' },
                { command: 'salesforceMetadata.deployCurrentFile' },
            ],
            'explorer/context': [
                {
                    command: 'salesforceMetadata.createLightningComponent',
                    when: 'explorerResourceIsFolder && resourceFilename == lwc',
                    group: 'navigation',
                },
            ],
        },
    },
};

function buildOrgIntro(orgContext) {
    if (!orgContext.hasConnection) {
        return 'This workbench needs a Salesforce connection from the parent toolkit session before metadata commands can run.';
    }

    switch (orgContext.environmentType) {
        case ORG_ENVIRONMENT_TYPES.production:
            return `You are currently connected to **${orgContext.displayName}**. This is a **production org**, so review changes carefully before syncing or deploying.`;
        case ORG_ENVIRONMENT_TYPES.sandbox:
            return `You are currently connected to **${orgContext.displayName}**. This is a **sandbox org**, so it is safer for exploration and testing.`;
        case ORG_ENVIRONMENT_TYPES.scratch:
            return `You are currently connected to **${orgContext.displayName}**. This is a **scratch org**, so it is intended for short-lived development, validation, and disposable experiments.`;
        case ORG_ENVIRONMENT_TYPES.trailhead:
            return `You are currently connected to **${orgContext.displayName}**. This is a **Trailhead org**, so it is intended for learning, guided exercises, and experimentation.`;
        case ORG_ENVIRONMENT_TYPES.dev:
            return `You are currently connected to **${orgContext.displayName}**. This is a **dev org**, so it is intended for local development and isolated testing.`;
        default:
            return `You are currently connected to **${orgContext.displayName}**. The org type could not be confirmed automatically, so treat changes with care.`;
    }
}

function buildWalkthroughMarkdown(orgContext) {
    const hostLine = orgContext.host ? `- Host: \`${orgContext.host}\`\n` : '';
    const orgNameLine = orgContext.organizationName
        ? `- Organization: **${orgContext.organizationName}**\n`
        : '';
    const usernameLine = orgContext.username ? `- Username: \`${orgContext.username}\`\n` : '';
    const orgIdLine = orgContext.orgId ? `- Org Id: \`${orgContext.orgId}\`\n` : '';
    const environmentWarning =
        orgContext.environmentType === ORG_ENVIRONMENT_TYPES.production
            ? 'Because this is a **production org**, make changes carefully and review anything that could affect live users or data before you sync, retrieve, or deploy.'
            : orgContext.environmentType === ORG_ENVIRONMENT_TYPES.sandbox
              ? 'Because this is a **sandbox org**, this environment is better suited for exploration, validation, and trying workflows before touching production.'
              : orgContext.environmentType === ORG_ENVIRONMENT_TYPES.scratch
                ? 'Because this is a **scratch org**, this environment is best suited for short-lived development, verification, and disposable experiments.'
              : orgContext.environmentType === ORG_ENVIRONMENT_TYPES.trailhead
                ? 'Because this is a **Trailhead org**, this environment is best suited for learning, hands-on exercises, and experimentation rather than production-like workflows.'
                : orgContext.environmentType === ORG_ENVIRONMENT_TYPES.dev
                  ? 'Because this is a **dev org**, this environment is best suited for local development, debugging, and isolated validation.'
              : 'Because the org type could not be confirmed automatically, treat this environment carefully until you verify whether it is production or sandbox.';

    return `# Welcome to the Salesforce Workbench

${buildOrgIntro(orgContext)}

${environmentWarning}

## What this workspace is

This embedded workspace is a lightweight version of VS Code focused on Salesforce workflows inside the browser. It is meant to help you inspect metadata, edit files, run targeted commands, and collaborate with the built-in agent.

## What this workspace is good for

- Reviewing and editing project files directly in the browser
- Syncing Salesforce metadata into the Explorer
- Running focused Salesforce commands without leaving the workbench
- Using the built-in agent to inspect code, explain files, and help with targeted changes

## Important limitations to keep in mind

- Some desktop VS Code capabilities are intentionally limited or unavailable in this embedded experience.
- This workbench is designed for focused Salesforce tasks, not full parity with a local desktop IDE.
- Certain extensions, advanced desktop-only workflows, and local machine integrations may not be available here.
- Salesforce metadata actions are exposed through the **Salesforce** panel and command palette.

## Current org context

${orgNameLine}${hostLine}${usernameLine}${orgIdLine}- Environment: **${orgContext.environmentLabel}**

## How the built-in agent can help

- Explain files, flows, and Salesforce-specific code in this workspace
- Help you locate metadata, commands, and implementation entry points
- Make scoped code edits and suggest safer next steps
- Summarize what changed after an edit or help you understand a diff

## When to stay careful

- Double-check the org banner before editing or deploying
- Be extra cautious when the org is production or when the org type is unknown
- Prefer reviewing metadata changes before syncing or deploying them
- Treat this workbench as a lightweight environment and switch to a fuller local setup if you need desktop-only capabilities

## Suggested next steps

1. Review the org banner above the workbench before making changes.
2. Open the Salesforce panel and sync metadata into the Explorer.
3. Open the agent when you need help navigating, understanding, or changing this workspace.
4. Confirm the org type before making risky changes if the environment is still shown as unknown.
`;
}

function buildWalkthroughs(orgContext) {
    const salesforceActionDescription = orgContext.hasConnection
        ? `[Open the Salesforce panel](command:${OPEN_SALESFORCE_PANEL_COMMAND}) to browse commands and metadata actions, or [sync metadata now](command:salesforceMetadata.fetchMetadata) when you are ready.`
        : `[Open the Salesforce panel](command:${OPEN_SALESFORCE_PANEL_COMMAND}) to browse commands and metadata actions. This workbench becomes active when it is launched from a connected toolkit session.`;

    return [
        {
            id: ONBOARDING_WALKTHROUGH_ID,
            title: 'Salesforce Workbench Welcome',
            description:
                'Review your connected org, understand the limits of this lightweight workbench, and use the built-in agent effectively.',
            steps: [
                {
                    id: 'review-org-context',
                    title: 'Review your org context',
                    description: buildOrgIntro(orgContext),
                    media: {
                        markdown: ONBOARDING_MARKDOWN_PATH,
                    },
                },
                {
                    id: 'understand-workbench-scope',
                    title: 'Understand the lightweight workspace',
                    description:
                        'This is a focused, embedded workbench rather than the full desktop VS Code experience. It is ideal for targeted Salesforce tasks, but some extensions, integrations, and advanced local workflows may be unavailable.',
                },
                {
                    id: 'open-salesforce-tools',
                    title: 'Open Salesforce tools',
                    description: salesforceActionDescription,
                    completionEvents: ['onCommand:salesforceMetadata.fetchMetadata'],
                },
                {
                    id: 'review-workbench-limitations',
                    title: 'Review workbench limitations',
                    description:
                        'Use this browser workbench for focused metadata and code tasks. If you need full desktop parity, advanced local tooling, or unsupported extensions, switch to your local VS Code setup.',
                },
                {
                    id: 'use-the-agent',
                    title: 'Use the built-in agent',
                    description: `[Open the agent chat](command:${OPEN_AGENT_CHAT_COMMAND}) whenever you want help understanding code, locating metadata, planning a change, or making guided edits in this workspace.`,
                    completionEvents: [`onCommand:${OPEN_AGENT_CHAT_COMMAND}`],
                },
            ],
        },
    ];
}

export function buildMetadataExtensionConfig({ orgContext } = {}) {
    const nextOrgContext = buildOrgContext(orgContext);
    const contributes = METADATA_EXTENSION_BASE_CONFIG.contributes || {};
    const commandPalette = contributes.menus?.commandPalette || [];

    return {
        ...METADATA_EXTENSION_BASE_CONFIG,
        contributes: {
            ...contributes,
            walkthroughs: buildWalkthroughs(nextOrgContext),
            commands: [
                ...contributes.commands,
                {
                    command: OPEN_ONBOARDING_COMMAND,
                    title: 'Salesforce: Open Welcome Page',
                },
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
                    { command: OPEN_ONBOARDING_COMMAND },
                    { command: OPEN_SALESFORCE_PANEL_COMMAND },
                    { command: OPEN_AGENT_CHAT_COMMAND },
                ],
            },
        },
    };
}

const SVG_MIME_TYPE = 'image/svg+xml';
const JSON_MIME_TYPE = 'application/json';
const XML_MIME_TYPE = 'application/xml';
const MARKDOWN_MIME_TYPE = 'text/markdown';

const BASE_INLINE_ASSETS = [
    {
        targetPath: '/workspace/salesforce-panel-icon.svg',
        mimeType: SVG_MIME_TYPE,
        content: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <path fill="#00A1E0" d="M12 2c-2.7 0-5.1 1.3-6.7 3.3C4.5 5.1 3.8 5 3 5 1.3 5 0 6.3 0 8c0 1.5 1 2.7 2.4 3 0 .3-.1.7-.1 1 0 4.9 4 9 8.9 9 2.2 0 4.2-.8 5.8-2.1.4.1.8.1 1.2.1 2.2 0 4-1.8 4-4 0-.4-.1-.8-.2-1.2 1.1-.7 1.9-1.9 1.9-3.3 0-2.2-1.8-4-4-4-.3 0-.6 0-.9.1C18.3 3.7 15.4 2 12 2z"/>
</svg>`,
    },
];

export function buildInlineAssets({ orgContext } = {}) {
    const nextOrgContext = buildOrgContext(orgContext);
    return [
        ...BASE_INLINE_ASSETS,
        {
            targetPath: ONBOARDING_MARKDOWN_PATH,
            mimeType: MARKDOWN_MIME_TYPE,
            content: buildWalkthroughMarkdown(nextOrgContext),
        },
    ];
}

export const APEX_LANGUAGE_ASSETS = [
    {
        sourcePath: '/libs/extensions/salesforce-apex/grammars/apex.tmLanguage',
        targetPath: '/workspace/apex.tmLanguage',
        mimeType: XML_MIME_TYPE,
    },
    {
        sourcePath: '/libs/extensions/salesforce-apex/grammars/soql.tmLanguage',
        targetPath: '/workspace/soql.tmLanguage',
        mimeType: XML_MIME_TYPE,
    },
    {
        sourcePath: '/libs/extensions/salesforce-apex/syntaxes/apex.configuration.json',
        targetPath: '/workspace/apex.configuration.json',
        mimeType: JSON_MIME_TYPE,
    },
];

export const WEB_LANGUAGE_ASSETS = [
    {
        sourcePath:
            '/libs/extensions/vscode-basics/vscode.javascript/javascript-language-configuration.json',
        targetPath: '/workspace/javascript-language-configuration.json',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath:
            '/libs/extensions/vscode-basics/vscode.javascript/syntaxes/JavaScript.tmLanguage.json',
        targetPath: '/workspace/JavaScript.tmLanguage.json',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath:
            '/libs/extensions/vscode-basics/vscode.javascript/syntaxes/JavaScriptReact.tmLanguage.json',
        targetPath: '/workspace/JavaScriptReact.tmLanguage.json',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath: '/libs/extensions/vscode-basics/vscode.typescript/language-configuration.json',
        targetPath: '/workspace/typescript-language-configuration.json',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath:
            '/libs/extensions/vscode-basics/vscode.typescript/syntaxes/TypeScript.tmLanguage.json',
        targetPath: '/workspace/TypeScript.tmLanguage.json',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath:
            '/libs/extensions/vscode-basics/vscode.typescript/syntaxes/TypeScriptReact.tmLanguage.json',
        targetPath: '/workspace/TypeScriptReact.tmLanguage.json',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath:
            '/libs/extensions/vscode-basics/vscode.typescript/syntaxes/jsdoc.js.injection.tmLanguage.json',
        targetPath: '/workspace/jsdoc.js.injection.tmLanguage.json',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath:
            '/libs/extensions/vscode-basics/vscode.typescript/syntaxes/jsdoc.ts.injection.tmLanguage.json',
        targetPath: '/workspace/jsdoc.ts.injection.tmLanguage.json',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath: '/libs/extensions/vscode-basics/vscode.html/language-configuration.json',
        targetPath: '/workspace/html-language-configuration.json',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath: '/libs/extensions/vscode-basics/vscode.html/syntaxes/html.tmLanguage.json',
        targetPath: '/workspace/html.tmLanguage.json',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath: '/libs/extensions/vscode-basics/vscode.css/language-configuration.json',
        targetPath: '/workspace/css-language-configuration.json',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath: '/libs/extensions/vscode-basics/vscode.css/syntaxes/css.tmLanguage.json',
        targetPath: '/workspace/css.tmLanguage.json',
        mimeType: JSON_MIME_TYPE,
    },
];

export const LWC_SNIPPET_ASSETS = [
    {
        sourcePath: '/libs/extensions/salesforce-lwc/snippets/lwc-js.json',
        targetPath: '/workspace/lwc-js.code-snippets',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath: '/libs/extensions/salesforce-lwc/snippets/lwc-html.json',
        targetPath: '/workspace/lwc-html.code-snippets',
        mimeType: JSON_MIME_TYPE,
    },
];
