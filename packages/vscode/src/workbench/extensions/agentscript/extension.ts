import { registerSalesforceExtension } from '../core/extensionRegistration';

const AGENTSCRIPT_SERVER_WORKER_URL =
    '/libs/extensions/agentscript-extension/server/server.browser.js';

const AGENTSCRIPT_EXTENSION_CONFIG = {
    name: 'agentscript-extension',
    displayName: 'Agent Script Language Support',
    description: 'VSCode extension for Agent Script language support',
    version: '1.2.1',
    publisher: 'salesforce',
    license: 'Apache-2.0',
    engines: { vscode: '*' },
    activationEvents: ['*'],
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
        ],
    },
};

const AGENTSCRIPT_EXTENSION_ASSETS = [
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
    },
];

export async function register(vscodeBundle) {
    return registerSalesforceExtension(
        vscodeBundle,
        {
            config: AGENTSCRIPT_EXTENSION_CONFIG,
            remoteAssets: AGENTSCRIPT_EXTENSION_ASSETS,
        },
        async (_vscode, { push, vscodeBundle: bundle }) => {
            const lsClient = bundle?.monacoLanguageClient?.VSCodeLanguageClientBrowser;
            const LanguageClientWrapper =
                bundle?.monacoLanguageClient?.LanguageClient?.LanguageClientWrapper;

            if (!lsClient?.BrowserMessageReader || !lsClient?.BrowserMessageWriter) {
                return;
            }

            const { BrowserMessageReader, BrowserMessageWriter } = lsClient;
            const worker = new Worker(AGENTSCRIPT_SERVER_WORKER_URL, {
                type: 'module',
                name: 'Agent Script LS',
            });

            const languageClientConfig = {
                languageId: 'agentscript',
                clientOptions: {
                    documentSelector: [
                        { scheme: 'file', language: 'agentscript' },
                        { scheme: 'file', language: 'agentscript', pattern: '**/*.agent' },
                        { scheme: 'file', language: 'agentscript', pattern: '**/*.afscript' },
                    ],
                },
                connection: {
                    options: {
                        $type: 'MessageChannel',
                        worker,
                    },
                    messageTransports: {
                        reader: new BrowserMessageReader(worker),
                        writer: new BrowserMessageWriter(worker),
                    },
                },
            };

            if (LanguageClientWrapper) {
                try {
                    const wrapper = new LanguageClientWrapper(languageClientConfig);
                    await wrapper.start();
                    push(wrapper);
                } catch (e) {
                    // eslint-disable-next-line no-console
                    console.warn('[agentscript] Language client failed to start:', e);
                }
            }

            try {
                const extension = bundle?.vscode?.extensions?.getExtension?.(
                    'salesforce.agentscript-extension'
                );
                await extension?.activate?.();
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[agentscript] Extension activation failed:', e);
            }
        }
    );
}
