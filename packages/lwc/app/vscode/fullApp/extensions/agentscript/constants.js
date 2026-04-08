export const AGENTSCRIPT_SERVER_WORKER_URL =
    '/libs/extensions/agentscript-extension/server/server.browser.js';

export const AGENTSCRIPT_EXTENSION_CONFIG = {
    name: 'agentscript-extension',
    displayName: 'Agent Script Language Support',
    description: 'VSCode extension for Agent Script language support',
    version: '1.2.1',
    publisher: 'salesforce',
    license: 'Apache-2.0',
    engines: {
        vscode: '*',
    },
    contributes: {
        languages: [
            {
                id: 'agentscript',
                aliases: ['Agent Scripting'],
                extensions: ['.agent', '.afscript'],
                configuration: '/workspace/vscode/agentscript.language-configuration.json',
            },
        ],
        grammars: [
            {
                language: 'agentscript',
                scopeName: 'source.agentscript',
                path: '/workspace/vscode/agentscript.tmLanguage.json',
            },
        ]
    },
    activationEvents: ['*'],
};

export const AGENTSCRIPT_EXTENSION_ASSETS = [
    {
        sourcePath: AGENTSCRIPT_SERVER_WORKER_URL,
        targetPath: '/workspace/vscode/server.js',
        mimeType: 'application/javascript',
    },
    {
        sourcePath: '/libs/extensions/agentscript-extension/grammar/agentscript.tmLanguage.json',
        targetPath: '/workspace/vscode/agentscript.tmLanguage.json',
        mimeType: 'application/json',
    },
    {
        sourcePath: '/libs/extensions/agentscript-extension/grammar/language-configuration.json',
        targetPath: '/workspace/vscode/agentscript.language-configuration.json',
        mimeType: 'application/json',
    }
];
