/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 */

import { registerSalesforceExtension } from '../shared.js';

const SOQL_MONACO_SERVER_WORKER_URL = '/libs/extensions/salesforcedx-vscode-soql/dist/serverWorker.js';

// Language and grammar are already contributed by the sf-soql extension.
// This extension only adds LSP features (completion, validation, hover) via serverWorker.js.
const SOQL_MONACO_EXTENSION_CONFIG = {
    name: 'salesforcedx-vscode-soql',
    displayName: 'SOQL Language Server',
    description: 'SOQL language server — completion, validation and hover via LSP',
    version: '66.4.4',
    publisher: 'salesforce',
    license: 'BSD-3-Clause',
    engines: { vscode: '*' },
    activationEvents: ['*'],
    contributes: {
        languages: [
            {
                id: "soql",
                aliases: [ 'soql', 'SOQL'],
                extensions: [ '.soql' ]
            }
        ],
        configuration: {
            type: 'object',
            title: 'SOQL',
            properties: {
                'salesforcedx-vscode-soql.experimental.validateQueries': {
                    type: 'boolean',
                    default: false,
                    description:
                        'Validate LIMIT 0 queries against the connected org when the host provides query services.',
                },
            },
        },
        grammars: [
            {
                language: 'soql',
                scopeName: 'source.soql',
                path: '/workspace/vscode/soql.tmLanguage',
            },
        ],
    },
};

const SOQL_MONACO_EXTENSION_ASSETS = [
    {
        sourcePath: SOQL_MONACO_SERVER_WORKER_URL,
        targetPath: '/workspace/vscode/soql-lsp-server.js',
        mimeType: 'application/javascript',
    },
    {
        sourcePath: '/libs/extensions/salesforcedx-vscode-soql/grammars/soql.tmLanguage',
        targetPath: '/workspace/vscode/soql.tmLanguage',
        mimeType: 'application/xml',
    },
    {
        sourcePath: '/libs/extensions/salesforcedx-vscode-soql/dist/web/index.js',
        targetPath: '/workspace/vscode/browser.js',
        mimeType: 'application/javascript',
    },
];

export async function register(vscodeBundle) {
    return registerSalesforceExtension(
        vscodeBundle,
        {
            config: SOQL_MONACO_EXTENSION_CONFIG,
            remoteAssets: SOQL_MONACO_EXTENSION_ASSETS,
        },
        async (_vscode, { push, vscodeBundle: bundle }) => {
            const lsClient = bundle?.monacoLanguageClient?.VSCodeLanguageClientBrowser;
            const LanguageClientWrapper = bundle?.monacoLanguageClient?.LanguageClient?.LanguageClientWrapper;
            if (!lsClient?.BrowserMessageReader || !lsClient?.BrowserMessageWriter) {
                return;
            }

            const { BrowserMessageReader, BrowserMessageWriter } = lsClient;
            const worker = new Worker(SOQL_MONACO_SERVER_WORKER_URL, {
                type: 'module',
                name: 'SOQL Language Server',
            });

            const reader = new BrowserMessageReader(worker);
            const writer = new BrowserMessageWriter(worker);

            // log every message received from the worker
            reader.listen((message) => {
                console.log('Reader message:', message);
            });

            const languageClientConfig = {
                languageId: 'soql',
                clientOptions: {
                    documentSelector: [
                        { scheme: 'file', language: 'soql' },
                        { scheme: 'file', language: 'soql', pattern: '**/*.soql' },
                    ],
                },
                connection: {
                    options: {
                        $type: 'MessageChannel',
                        worker,
                    },
                    messageTransports: {
                        reader,
                        writer
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
                    console.warn('[soql-monaco] Language client failed to start:', e);
                }
            }

            try {
                const extension = _vscode?.extensions?.getExtension?.(
                    'salesforce.salesforcedx-vscode-soql'
                );
                console.log('extension',extension);
                // await extension?.activate?.();
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[agentscript] Extension activation failed:', e);
            }
        }
    );
}
