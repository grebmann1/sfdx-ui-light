export const EXTENSION_ID = 'salesforce.sf-metadata';

const config = {
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
            { command: 'salesforceMetadata.connect', title: 'Salesforce: Connect' },
            {
                command: 'salesforceMetadata.setWorkspaceApiVersion',
                title: 'Salesforce: Set Workspace API Version',
            },
            {
                command: 'salesforceMetadata.fetchMetadata',
                title: 'Salesforce: Sync Project (fetch/update/delete)',
            },
            { command: 'salesforceMetadata.disconnect', title: 'Salesforce: Disconnect' },
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
                title: 'Salesforce: Retrieve (Metadata API)…',
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
                command: 'salesforceMetadata.compareOrgs',
                title: 'Salesforce: Compare Two Orgs (Tooling API)',
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
                { command: 'salesforceMetadata.connect' },
                { command: 'salesforceMetadata.setWorkspaceApiVersion' },
                { command: 'salesforceMetadata.fetchMetadata' },
                { command: 'salesforceMetadata.disconnect' },
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
                { command: 'salesforceMetadata.compareOrgs' },
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

export async function loadExtension() {
    const filesOrContents = new Map();

    try {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <path fill="#00A1E0" d="M12 2c-2.7 0-5.1 1.3-6.7 3.3C4.5 5.1 3.8 5 3 5 1.3 5 0 6.3 0 8c0 1.5 1 2.7 2.4 3 0 .3-.1.7-.1 1 0 4.9 4 9 8.9 9 2.2 0 4.2-.8 5.8-2.1.4.1.8.1 1.2.1 2.2 0 4-1.8 4-4 0-.4-.1-.8-.2-1.2 1.1-.7 1.9-1.9 1.9-3.3 0-2.2-1.8-4-4-4-.3 0-.6 0-.9.1C18.3 3.7 15.4 2 12 2z"/>
</svg>`;
        filesOrContents.set(
            '/workspace/salesforce-panel-icon.svg',
            URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
        );
    } catch {
        // ignore
    }

    try {
        const [apexGrammar, soqlGrammar, apexConfig] = await Promise.all([
            fetch('/libs/extensions/salesforce-apex/grammars/apex.tmLanguage').then(response =>
                response.text()
            ),
            fetch('/libs/extensions/salesforce-apex/grammars/soql.tmLanguage').then(response =>
                response.text()
            ),
            fetch('/libs/extensions/salesforce-apex/syntaxes/apex.configuration.json').then(
                response => response.text()
            ),
        ]);
        filesOrContents.set(
            '/workspace/apex.tmLanguage',
            URL.createObjectURL(new Blob([apexGrammar], { type: 'application/xml' }))
        );
        filesOrContents.set(
            '/workspace/soql.tmLanguage',
            URL.createObjectURL(new Blob([soqlGrammar], { type: 'application/xml' }))
        );
        filesOrContents.set(
            '/workspace/apex.configuration.json',
            URL.createObjectURL(new Blob([apexConfig], { type: 'application/json' }))
        );
    } catch {
        // ignore
    }

    try {
        const [
            jsConfig,
            jsGrammar,
            jsxGrammar,
            tsConfig,
            tsGrammar,
            tsxGrammar,
            jsdocJsInjection,
            jsdocTsInjection,
            htmlConfig,
            htmlGrammar,
            cssConfig,
            cssGrammar,
        ] = await Promise.all([
            fetch(
                '/libs/extensions/vscode-basics/vscode.javascript/javascript-language-configuration.json'
            ).then(response => response.text()),
            fetch(
                '/libs/extensions/vscode-basics/vscode.javascript/syntaxes/JavaScript.tmLanguage.json'
            ).then(response => response.text()),
            fetch(
                '/libs/extensions/vscode-basics/vscode.javascript/syntaxes/JavaScriptReact.tmLanguage.json'
            ).then(response => response.text()),
            fetch(
                '/libs/extensions/vscode-basics/vscode.typescript/language-configuration.json'
            ).then(response => response.text()),
            fetch(
                '/libs/extensions/vscode-basics/vscode.typescript/syntaxes/TypeScript.tmLanguage.json'
            ).then(response => response.text()),
            fetch(
                '/libs/extensions/vscode-basics/vscode.typescript/syntaxes/TypeScriptReact.tmLanguage.json'
            ).then(response => response.text()),
            fetch(
                '/libs/extensions/vscode-basics/vscode.typescript/syntaxes/jsdoc.js.injection.tmLanguage.json'
            ).then(response => response.text()),
            fetch(
                '/libs/extensions/vscode-basics/vscode.typescript/syntaxes/jsdoc.ts.injection.tmLanguage.json'
            ).then(response => response.text()),
            fetch('/libs/extensions/vscode-basics/vscode.html/language-configuration.json').then(
                response => response.text()
            ),
            fetch('/libs/extensions/vscode-basics/vscode.html/syntaxes/html.tmLanguage.json').then(
                response => response.text()
            ),
            fetch('/libs/extensions/vscode-basics/vscode.css/language-configuration.json').then(
                response => response.text()
            ),
            fetch('/libs/extensions/vscode-basics/vscode.css/syntaxes/css.tmLanguage.json').then(
                response => response.text()
            ),
        ]);
        filesOrContents.set(
            '/workspace/javascript-language-configuration.json',
            URL.createObjectURL(new Blob([jsConfig], { type: 'application/json' }))
        );
        filesOrContents.set(
            '/workspace/JavaScript.tmLanguage.json',
            URL.createObjectURL(new Blob([jsGrammar], { type: 'application/json' }))
        );
        filesOrContents.set(
            '/workspace/JavaScriptReact.tmLanguage.json',
            URL.createObjectURL(new Blob([jsxGrammar], { type: 'application/json' }))
        );
        filesOrContents.set(
            '/workspace/typescript-language-configuration.json',
            URL.createObjectURL(new Blob([tsConfig], { type: 'application/json' }))
        );
        filesOrContents.set(
            '/workspace/TypeScript.tmLanguage.json',
            URL.createObjectURL(new Blob([tsGrammar], { type: 'application/json' }))
        );
        filesOrContents.set(
            '/workspace/TypeScriptReact.tmLanguage.json',
            URL.createObjectURL(new Blob([tsxGrammar], { type: 'application/json' }))
        );
        filesOrContents.set(
            '/workspace/jsdoc.js.injection.tmLanguage.json',
            URL.createObjectURL(new Blob([jsdocJsInjection], { type: 'application/json' }))
        );
        filesOrContents.set(
            '/workspace/jsdoc.ts.injection.tmLanguage.json',
            URL.createObjectURL(new Blob([jsdocTsInjection], { type: 'application/json' }))
        );
        filesOrContents.set(
            '/workspace/html-language-configuration.json',
            URL.createObjectURL(new Blob([htmlConfig], { type: 'application/json' }))
        );
        filesOrContents.set(
            '/workspace/html.tmLanguage.json',
            URL.createObjectURL(new Blob([htmlGrammar], { type: 'application/json' }))
        );
        filesOrContents.set(
            '/workspace/css-language-configuration.json',
            URL.createObjectURL(new Blob([cssConfig], { type: 'application/json' }))
        );
        filesOrContents.set(
            '/workspace/css.tmLanguage.json',
            URL.createObjectURL(new Blob([cssGrammar], { type: 'application/json' }))
        );
    } catch {
        // ignore
    }

    try {
        const [lwcJsSnippets, lwcHtmlSnippets] = await Promise.all([
            fetch('/libs/extensions/salesforce-lwc/snippets/lwc-js.json').then(response =>
                response.text()
            ),
            fetch('/libs/extensions/salesforce-lwc/snippets/lwc-html.json').then(response =>
                response.text()
            ),
        ]);
        filesOrContents.set(
            '/workspace/lwc-js.code-snippets',
            URL.createObjectURL(new Blob([lwcJsSnippets], { type: 'application/json' }))
        );
        filesOrContents.set(
            '/workspace/lwc-html.code-snippets',
            URL.createObjectURL(new Blob([lwcHtmlSnippets], { type: 'application/json' }))
        );
    } catch {
        // ignore
    }

    return { config, filesOrContents };
}
