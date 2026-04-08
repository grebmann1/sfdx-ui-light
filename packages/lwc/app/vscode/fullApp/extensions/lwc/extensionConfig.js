import { buildSalesforceExtensionConfig } from '../salesforce/salesforceExtensionSupport.js';

export function buildLwcExtensionConfig() {
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
                    title: 'Salesforce: Deploy Changed Files (Tooling API)',
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
