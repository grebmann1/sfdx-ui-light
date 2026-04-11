import { buildSalesforceExtensionConfig } from '../core/extensionManifest';
import { registerSalesforceExtension, type VscodeBundle } from '../core/extensionRegistration';
import { registerQueryAndApexTools } from '../metadata/commands/queryAndApexTools';
import { registerSchemaTools } from '../metadata/runtime/schemaTools';
import { getOrCreateSalesforceWorkbenchHost } from '../salesforce/salesforceWorkbenchHost';

import { createSoqlCompletionMiddleware, type SchemaToolsApi } from './soqlCompletionMiddleware';
import { executeSoqlQuery } from './soqlQueryRunner';

const SOQL_SERVER_WORKER_URL = '/libs/extensions/salesforcedx-vscode-soql/dist/serverWorker.js';

function buildSoqlExtensionConfig(): ReturnType<typeof buildSalesforceExtensionConfig> {
    return buildSalesforceExtensionConfig({
        name: 'sf-soql',
        displayName: 'Salesforce SOQL (Workbench)',
        description: 'SOQL language support, schema explorer, and query commands for the workbench',
        contributes: {
            views: {
                salesforcePanel: [
                    {
                        id: 'salesforceMetadata.schemaExplorer',
                        name: 'Schema',
                    },
                ],
            },
            languages: [{ id: 'soql', aliases: ['SOQL'], extensions: ['.soql'] }],
            grammars: [
                {
                    language: 'soql',
                    scopeName: 'source.soql',
                    path: '/workspace/vscode/soql.tmLanguage',
                },
            ],
            commands: [
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
            ],
            menus: {
                commandPalette: [
                    { command: 'salesforceMetadata.runSoqlQuery' },
                    { command: 'salesforceMetadata.runToolingQuery' },
                    { command: 'salesforceMetadata.openSoqlScratch' },
                    { command: 'salesforceMetadata.refreshSchemaCache' },
                ],
            },
        },
    });
}

function buildUnifiedSoqlManifest(): Record<string, unknown> {
    const base = buildSoqlExtensionConfig();
    const contributes =
        base.contributes && typeof base.contributes === 'object' ? base.contributes : {};
    return {
        ...base,
        name: 'sf-soql-workbench',
        displayName: 'Salesforce SOQL Workbench',
        description:
            'SOQL language, LSP, schema explorer, and query commands for the toolkit workbench',
        contributes: {
            ...(contributes as Record<string, unknown>),
            configuration: {
                type: 'object',
                title: 'SOQL',
                properties: {
                    'salesforcedx-vscode-soql.experimental.validateQueries': {
                        type: 'boolean',
                        default: false,
                        description:
                            'When enabled, validate LIMIT 0 queries against the connected org via the language server.',
                    },
                },
            },
        },
    };
}

const SOQL_EXTENSION_ASSETS = [
    {
        sourcePath: SOQL_SERVER_WORKER_URL,
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

type MonacoLsBundle = {
    monacoLanguageClient?: {
        VSCodeLanguageClientBrowser?: {
            BrowserMessageReader: new (w: Worker) => unknown;
            BrowserMessageWriter: new (w: Worker) => unknown;
        };
        LanguageClient?: {
            LanguageClientWrapper: new (config: Record<string, unknown>) => {
                start(): Promise<void>;
                dispose(): Promise<void>;
                getLanguageClient?: () => {
                    onRequest?: (
                        method: string,
                        handler: (q: string) => Promise<unknown>
                    ) => { dispose?: () => void };
                };
            };
        };
    };
};

type VscodeLike = {
    CompletionItemKind: {
        Field: number;
        Class: number;
        Value: number;
        Snippet: number;
        Keyword: number;
        EnumMember: number;
    };
    workspace?: {
        getConfiguration?: (section: string) => {
            get?: (key: string) => unknown;
        };
    };
};

export async function registerUnifiedSoqlExtension(vscodeBundle: VscodeBundle) {
    return registerSalesforceExtension(
        vscodeBundle,
        {
            config: buildUnifiedSoqlManifest(),
            remoteAssets: SOQL_EXTENSION_ASSETS,
        },
        async (vscode, { push, vscodeBundle: bundle }) => {
            if (!vscode) {
                return;
            }

            const sfHost = await getOrCreateSalesforceWorkbenchHost(vscodeBundle);
            if (!sfHost) {
                return;
            }

            let schemaApi: SchemaToolsApi | null = null;

            await sfHost.activateFeatureOnce(
                'salesforce-schema-tools',
                async ({ connectionRuntime, context }) => {
                    sfHost.setSchemaTools(
                        await registerSchemaTools({ connectionRuntime, context })
                    );
                }
            );
            schemaApi = sfHost.schemaTools as SchemaToolsApi | null;

            await sfHost.activateFeatureOnce(
                'salesforce-soql',
                async ({ connectionRuntime, context, deployTools }) => {
                    registerQueryAndApexTools({
                        connectionRuntime,
                        context,
                        deployTools,
                        commandGroups: ['soql'],
                    });
                }
            );

            const vs = vscode as VscodeLike;
            const middleware = createSoqlCompletionMiddleware({
                CompletionItemKind: vs.CompletionItemKind,
                loadConnection: () =>
                    (typeof sfHost.connectionRuntime.loadLiveConnection === 'function'
                        ? sfHost.connectionRuntime.loadLiveConnection()
                        : sfHost.connectionRuntime.loadStoredConn()) as Record<
                        string,
                        unknown
                    > | null,
                getSchemaApi: () => schemaApi,
            });

            const b = bundle as MonacoLsBundle | undefined;
            const lsClient = b?.monacoLanguageClient?.VSCodeLanguageClientBrowser;
            const LanguageClientWrapper =
                b?.monacoLanguageClient?.LanguageClient?.LanguageClientWrapper;

            if (
                !lsClient?.BrowserMessageReader ||
                !lsClient?.BrowserMessageWriter ||
                !LanguageClientWrapper
            ) {
                return;
            }

            const { BrowserMessageReader, BrowserMessageWriter } = lsClient;
            const worker = new Worker(SOQL_SERVER_WORKER_URL, {
                type: 'module',
                name: 'SOQL Language Server',
            });

            const reader = new BrowserMessageReader(worker);
            const writer = new BrowserMessageWriter(worker);

            const languageClientConfig: Record<string, unknown> = {
                languageId: 'soql',
                clientOptions: {
                    documentSelector: [
                        { scheme: 'file', language: 'soql' },
                        { scheme: 'file', language: 'soql', pattern: '**/*.soql' },
                    ],
                    middleware,
                },
                connection: {
                    options: {
                        $type: 'MessageChannel',
                        worker,
                    },
                    messageTransports: {
                        reader,
                        writer,
                    },
                },
            };

            try {
                const wrapper = new LanguageClientWrapper(languageClientConfig);
                await wrapper.start();
                push(wrapper);

                const lc = wrapper.getLanguageClient?.();
                if (lc && typeof lc.onRequest === 'function') {
                    const runQueryDisposable = lc.onRequest(
                        'runQuery',
                        async (queryText: string) => {
                            const enabled = Boolean(
                                vs.workspace
                                    ?.getConfiguration?.('salesforcedx-vscode-soql')
                                    ?.get?.('experimental.validateQueries')
                            );
                            const conn = (
                                typeof sfHost.connectionRuntime.loadLiveConnection === 'function'
                                    ? sfHost.connectionRuntime.loadLiveConnection()
                                    : sfHost.connectionRuntime.loadStoredConn()
                            ) as Record<string, unknown>;
                            if (!conn?.instanceUrl || !conn?.accessToken) {
                                return {
                                    error: {
                                        name: 'NoConnection',
                                        message:
                                            sfHost.connectionRuntime.getInjectedConnectionRequiredMessage(),
                                    },
                                };
                            }
                            try {
                                if (!enabled) {
                                    return { done: true, totalSize: 0, records: [] as const };
                                }
                                const result = await executeSoqlQuery({
                                    connectionRuntime: sfHost.connectionRuntime,
                                    conn,
                                    soql: queryText,
                                    tooling: false,
                                });
                                return { result: result || { totalSize: 0, records: [] } };
                            } catch (e) {
                                const err = e as {
                                    name?: string;
                                    message?: string;
                                    errorCode?: string;
                                };
                                return {
                                    error: {
                                        name: err?.name || 'Error',
                                        errorCode: err?.errorCode,
                                        message: err?.message || String(e),
                                    },
                                };
                            }
                        }
                    );
                    push(runQueryDisposable);
                }
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[sf-soql-workbench] Language client failed to start:', e);
            }
        }
    );
}
