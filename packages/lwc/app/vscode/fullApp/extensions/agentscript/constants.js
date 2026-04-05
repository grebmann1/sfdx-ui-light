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
                configuration: '/workspace/language-configuration.json',
            },
        ],
        grammars: [
            {
                language: 'agentscript',
                scopeName: 'source.agentscript',
                path: '/workspace/agentscript.tmLanguage.json',
            },
        ],
        themes: [
            {
                id: 'Tokyo Night',
                label: 'Tokyo Night',
                uiTheme: 'vs-dark',
                path: '/workspace/tokyo-night-color-theme.json',
            },
            {
                id: 'Shades of Purple (Super Dark)',
                label: 'Shades of Purple (Super Dark)',
                uiTheme: 'vs-dark',
                path: '/workspace/shades-of-purple-super-dark.json',
            },
        ],
    },
    activationEvents: ['*'],
};

export const AGENTSCRIPT_EXTENSION_ASSETS = [
    {
        sourcePath: AGENTSCRIPT_SERVER_WORKER_URL,
        targetPath: '/workspace/server.js',
        mimeType: 'application/javascript',
    },
    {
        sourcePath: '/libs/extensions/agentscript-extension/grammar/agentscript.tmLanguage.json',
        targetPath: '/workspace/agentscript.tmLanguage.json',
        mimeType: 'application/json',
    },
    {
        sourcePath: '/libs/extensions/agentscript-extension/grammar/language-configuration.json',
        targetPath: '/workspace/language-configuration.json',
        mimeType: 'application/json',
    },
    {
        sourcePath: '/libs/extensions/agentscript-extension/themes/tokyo-night-color-theme.json',
        targetPath: '/workspace/tokyo-night-color-theme.json',
        mimeType: 'application/json',
    },
    {
        sourcePath:
            '/libs/extensions/agentscript-extension/themes/shades-of-purple-super-dark.json',
        targetPath: '/workspace/shades-of-purple-super-dark.json',
        mimeType: 'application/json',
    },
];
