import { buildSalesforceExtensionConfig } from '../core/extensionManifest';
import { registerSalesforceExtension } from '../core/extensionRegistration';
import { registerLwcComponentScaffolding } from '../metadata/commands/lwcComponentScaffolding';
import { getOrCreateSalesforceWorkbenchHost } from '../salesforce/salesforceWorkbenchHost';

const WEB_LANGUAGE_ASSETS = [
    {
        sourcePath:
            '/libs/extensions/vscode-basics/vscode.javascript/javascript-language-configuration.json',
        targetPath: '/workspace/vscode/javascript-language-configuration.json',
        mimeType: 'application/json',
    },
    {
        sourcePath:
            '/libs/extensions/vscode-basics/vscode.javascript/syntaxes/JavaScript.tmLanguage.json',
        targetPath: '/workspace/vscode/JavaScript.tmLanguage.json',
        mimeType: 'application/json',
    },
    {
        sourcePath:
            '/libs/extensions/vscode-basics/vscode.javascript/syntaxes/JavaScriptReact.tmLanguage.json',
        targetPath: '/workspace/vscode/JavaScriptReact.tmLanguage.json',
        mimeType: 'application/json',
    },
    {
        sourcePath: '/libs/extensions/vscode-basics/vscode.typescript/language-configuration.json',
        targetPath: '/workspace/vscode/typescript-language-configuration.json',
        mimeType: 'application/json',
    },
    {
        sourcePath:
            '/libs/extensions/vscode-basics/vscode.typescript/syntaxes/TypeScript.tmLanguage.json',
        targetPath: '/workspace/vscode/TypeScript.tmLanguage.json',
        mimeType: 'application/json',
    },
    {
        sourcePath:
            '/libs/extensions/vscode-basics/vscode.typescript/syntaxes/TypeScriptReact.tmLanguage.json',
        targetPath: '/workspace/vscode/TypeScriptReact.tmLanguage.json',
        mimeType: 'application/json',
    },
    {
        sourcePath:
            '/libs/extensions/vscode-basics/vscode.typescript/syntaxes/jsdoc.js.injection.tmLanguage.json',
        targetPath: '/workspace/vscode/jsdoc.js.injection.tmLanguage.json',
        mimeType: 'application/json',
    },
    {
        sourcePath:
            '/libs/extensions/vscode-basics/vscode.typescript/syntaxes/jsdoc.ts.injection.tmLanguage.json',
        targetPath: '/workspace/vscode/jsdoc.ts.injection.tmLanguage.json',
        mimeType: 'application/json',
    },
    {
        sourcePath: '/libs/extensions/vscode-basics/vscode.html/language-configuration.json',
        targetPath: '/workspace/vscode/html-language-configuration.json',
        mimeType: 'application/json',
    },
    {
        sourcePath: '/libs/extensions/vscode-basics/vscode.html/syntaxes/html.tmLanguage.json',
        targetPath: '/workspace/vscode/html.tmLanguage.json',
        mimeType: 'application/json',
    },
    {
        sourcePath: '/libs/extensions/vscode-basics/vscode.css/language-configuration.json',
        targetPath: '/workspace/vscode/css-language-configuration.json',
        mimeType: 'application/json',
    },
    {
        sourcePath: '/libs/extensions/vscode-basics/vscode.css/syntaxes/css.tmLanguage.json',
        targetPath: '/workspace/vscode/css.tmLanguage.json',
        mimeType: 'application/json',
    },
];

const LWC_SNIPPET_ASSETS = [
    {
        sourcePath: '/libs/extensions/salesforce-lwc/snippets/lwc-js.json',
        targetPath: '/workspace/vscode/lwc-js.code-snippets',
        mimeType: 'application/json',
    },
    {
        sourcePath: '/libs/extensions/salesforce-lwc/snippets/lwc-html.json',
        targetPath: '/workspace/vscode/lwc-html.code-snippets',
        mimeType: 'application/json',
    },
];

function buildLwcExtensionConfig() {
    return buildSalesforceExtensionConfig({
        name: 'sf-lwc',
        displayName: 'Salesforce LWC (Workbench)',
        description: 'LWC editing, snippets, and deploy workflows for the workbench',
        contributes: {
            languages: [
                {
                    id: 'javascript',
                    aliases: ['JavaScript'],
                    extensions: ['.js', '.mjs', '.cjs'],
                    configuration: '/workspace/vscode/javascript-language-configuration.json',
                },
                {
                    id: 'javascriptreact',
                    aliases: ['JavaScript React'],
                    extensions: ['.jsx'],
                    configuration: '/workspace/vscode/javascript-language-configuration.json',
                },
                {
                    id: 'typescript',
                    aliases: ['TypeScript'],
                    extensions: ['.ts'],
                    configuration: '/workspace/vscode/typescript-language-configuration.json',
                },
                {
                    id: 'typescriptreact',
                    aliases: ['TypeScript React'],
                    extensions: ['.tsx'],
                    configuration: '/workspace/vscode/typescript-language-configuration.json',
                },
                {
                    id: 'html',
                    aliases: ['HTML'],
                    extensions: ['.html', '.htm'],
                    configuration: '/workspace/vscode/html-language-configuration.json',
                },
                {
                    id: 'css',
                    aliases: ['CSS'],
                    extensions: ['.css'],
                    configuration: '/workspace/vscode/css-language-configuration.json',
                },
            ],
            grammars: [
                {
                    language: 'javascript',
                    scopeName: 'source.js',
                    path: '/workspace/vscode/JavaScript.tmLanguage.json',
                },
                {
                    language: 'javascriptreact',
                    scopeName: 'source.js.jsx',
                    path: '/workspace/vscode/JavaScriptReact.tmLanguage.json',
                },
                {
                    language: 'typescript',
                    scopeName: 'source.ts',
                    path: '/workspace/vscode/TypeScript.tmLanguage.json',
                },
                {
                    language: 'typescriptreact',
                    scopeName: 'source.tsx',
                    path: '/workspace/vscode/TypeScriptReact.tmLanguage.json',
                },
                {
                    language: 'html',
                    scopeName: 'text.html.basic',
                    path: '/workspace/vscode/html.tmLanguage.json',
                },
                {
                    language: 'css',
                    scopeName: 'source.css',
                    path: '/workspace/vscode/css.tmLanguage.json',
                },
                {
                    scopeName: 'documentation.injection.ts',
                    path: '/workspace/vscode/jsdoc.ts.injection.tmLanguage.json',
                    injectTo: ['source.ts', 'source.tsx'],
                },
                {
                    scopeName: 'documentation.injection.js.jsx',
                    path: '/workspace/vscode/jsdoc.js.injection.tmLanguage.json',
                    injectTo: ['source.js', 'source.js.jsx'],
                },
            ],
            snippets: [
                { language: 'javascript', path: '/workspace/vscode/lwc-js.code-snippets' },
                { language: 'html', path: '/workspace/vscode/lwc-html.code-snippets' },
            ],
            commands: [
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
                    command: 'salesforceMetadata.diffCurrentFile',
                    title: 'Salesforce: Diff Current File (local vs org)',
                },
                {
                    command: 'salesforceMetadata.deployChangedFiles',
                    title: 'Salesforce: Review and Deploy Changed Files (Tooling API)',
                },
                {
                    command: 'salesforceMetadata.toggleAutoDeploy',
                    title: 'Salesforce: Toggle Auto Deploy on Save',
                },
                {
                    command: 'salesforceMetadata.createLightningComponent',
                    title: 'Salesforce: Create Lightning Component',
                },
            ],
            menus: {
                commandPalette: [
                    { command: 'salesforceMetadata.lintCurrentFile' },
                    { command: 'salesforceMetadata.deployCurrentFile' },
                    { command: 'salesforceMetadata.fetchCurrentFile' },
                    { command: 'salesforceMetadata.diffCurrentFile' },
                    { command: 'salesforceMetadata.deployChangedFiles' },
                    { command: 'salesforceMetadata.toggleAutoDeploy' },
                    { command: 'salesforceMetadata.createLightningComponent' },
                ],
                'editor/context': [
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
    });
}

export async function register(vscodeBundle) {
    return registerSalesforceExtension(
        vscodeBundle,
        {
            config: buildLwcExtensionConfig(),
            remoteAssets: [...WEB_LANGUAGE_ASSETS, ...LWC_SNIPPET_ASSETS],
        },
        async () => {
            const sfHost = await getOrCreateSalesforceWorkbenchHost(vscodeBundle);
            if (!sfHost) return;

            await sfHost.activateFeatureOnce(
                'salesforce-lwc',
                async ({ connectionRuntime, context, deployTools }) => {
                    registerLwcComponentScaffolding({ connectionRuntime, context });
                    deployTools.registerCommandGroups(['lwc']);
                }
            );
        }
    );
}
