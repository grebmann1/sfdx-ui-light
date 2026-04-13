import { resolveCoreServices, type CoreServices } from '../core/coreServices';
import { buildSalesforceExtensionConfig } from '../core/extensionManifest';
import { registerSalesforceExtension, type VscodeBundle } from '../core/extensionRegistration';
import { fetchTextAsset } from '../core/extensionAssets';
import { registerQueryAndApexTools } from '../metadata/commands/queryAndApexTools';
import { registerSchemaTools } from '../metadata/runtime/schemaTools';

import { registerSoqlBuilderRuntime } from './soqlBuilderRuntime';
import { createSoqlCompletionMiddleware, type SchemaToolsApi } from './soqlCompletionMiddleware';
import { createSoqlDataViewRuntime } from './soqlDataViewRuntime';
import { runAndShowSoqlQueryPlan } from './soqlQueryPlan';
import { executeSoqlQuery } from './soqlQueryRunner';

const SOQL_SERVER_WORKER_URL = '/libs/extensions/salesforcedx-vscode-soql/dist/serverWorker.js';
const SOQL_SOURCE_ROOT = '/libs/extensions/salesforcedx-vscode-soql';
const SOQL_TARGET_ROOT = '/workspace/vscode';


const SOQL_UI_REMOTE_ASSETS = [
    {
        sourcePath: `${SOQL_SOURCE_ROOT}/dist/soql-builder-ui/index.html`,
        targetPath: `${SOQL_TARGET_ROOT}/dist/soql-builder-ui/index.html`,
        mimeType: 'text/html',
    },
    {
        sourcePath: `${SOQL_SOURCE_ROOT}/dist/soql-builder-ui/app.js`,
        targetPath: `${SOQL_TARGET_ROOT}/dist/soql-builder-ui/app.js`,
        mimeType: 'application/javascript',
    },
    {
        sourcePath: `${SOQL_SOURCE_ROOT}/dist/soql-data-view/index.html`,
        targetPath: `${SOQL_TARGET_ROOT}/dist/soql-data-view/index.html`,
        mimeType: 'text/html',
    },
    {
        sourcePath: `${SOQL_SOURCE_ROOT}/dist/soql-data-view/queryDataViewController.js`,
        targetPath: `${SOQL_TARGET_ROOT}/dist/soql-data-view/queryDataViewController.js`,
        mimeType: 'application/javascript',
    },
    {
        sourcePath: `${SOQL_SOURCE_ROOT}/dist/soql-data-view/queryDataView.css`,
        targetPath: `${SOQL_TARGET_ROOT}/dist/soql-data-view/queryDataView.css`,
        mimeType: 'text/css',
    },
    {
        sourcePath: `${SOQL_SOURCE_ROOT}/dist/soql-data-view/tabulator.min.js`,
        targetPath: `${SOQL_TARGET_ROOT}/dist/soql-data-view/tabulator.min.js`,
        mimeType: 'application/javascript',
    },
    {
        sourcePath: `${SOQL_SOURCE_ROOT}/dist/soql-data-view/tabulator.min.css`,
        targetPath: `${SOQL_TARGET_ROOT}/dist/soql-data-view/tabulator.min.css`,
        mimeType: 'text/css',
    },
    {
        sourcePath: `${SOQL_SOURCE_ROOT}/dist/soql-data-view/icons/icon__save.svg`,
        targetPath: `${SOQL_TARGET_ROOT}/dist/soql-data-view/icons/icon__save.svg`,
        mimeType: 'image/svg+xml',
    },
];

function buildSoqlExtensionConfig(): ReturnType<typeof buildSalesforceExtensionConfig> {
    return buildSalesforceExtensionConfig({
        name: 'sf-soql',
        displayName: 'Salesforce SOQL (Workbench)',
        description:
            'SOQL language support, schema explorer, builder UI, and query commands for the workbench',
        contributes: {
            views: {
                salesforcePanel: [
                    {
                        id: 'salesforceMetadata.schemaExplorer',
                        name: 'Schema',
                    },
                ],
            },
            customEditors: [
                {
                    viewType: 'soqlCustom.soql',
                    displayName: 'SOQL Builder',
                    selector: [{ filenamePattern: '*.soql' }],
                    priority: 'option',
                },
            ],
            languages: [{ id: 'soql', aliases: ['SOQL'], extensions: ['.soql'] }],
            grammars: [
                {
                    language: 'soql',
                    scopeName: 'source.soql',
                    path: `${SOQL_TARGET_ROOT}/soql.tmLanguage`,
                },
            ],
            commands: [
                {
                    command: 'soql.open.new.builder',
                    title: 'SOQL: New Query (Builder)',
                },
                {
                    command: 'soql.open.new.text.editor',
                    title: 'SOQL: New Query (Text Editor)',
                },
                {
                    command: 'soql.builder.toggle',
                    title: 'SOQL: Toggle Builder/Text View',
                },
                {
                    command: 'soql.walkthrough.open',
                    title: 'SOQL: Open Walkthrough',
                },
                {
                    command: 'sf.data.query.selection',
                    title: 'Salesforce: Run Selected Query',
                },
                {
                    command: 'sf.data.query.document',
                    title: 'Salesforce: Run Query in Active Document',
                },
                {
                    command: 'sf.data.query.explain.selection',
                    title: 'Salesforce: Explain Selected Query',
                },
                {
                    command: 'sf.data.query.explain.document',
                    title: 'Salesforce: Explain Query in Active Document',
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
            ],
            menus: {
                commandPalette: [
                    { command: 'soql.open.new.builder' },
                    { command: 'soql.open.new.text.editor' },
                    { command: 'soql.builder.toggle' },
                    { command: 'soql.walkthrough.open' },
                    { command: 'sf.data.query.selection' },
                    { command: 'sf.data.query.document' },
                    { command: 'sf.data.query.explain.selection' },
                    { command: 'sf.data.query.explain.document' },
                    { command: 'salesforceMetadata.runSoqlQuery' },
                    { command: 'salesforceMetadata.runToolingQuery' },
                    { command: 'salesforceMetadata.openSoqlScratch' },
                    { command: 'salesforceMetadata.refreshSchemaCache' },
                ],
                'editor/title': [
                    {
                        command: 'soql.builder.toggle',
                        when: 'resourceExtname == .soql',
                        group: 'navigation',
                    },
                ],
                'view/title': [
                    {
                        command: 'soql.open.new.builder',
                        when: 'view == salesforceMetadata.schemaExplorer',
                        group: 'navigation@1',
                    },
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
            'SOQL language, LSP, schema explorer, builder UI, and query commands for the toolkit workbench',
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
                    'salesforcedx-vscode-soql.experimental.useUpstreamBrowserRuntime': {
                        type: 'boolean',
                        default: false,
                        description:
                            'Feasibility flag for upstream browser runtime activation. Local adapter runtime remains the default path in this workbench.',
                    },
                },
            },
        },
    };
}

const SOQL_EXTENSION_ASSETS = [
    {
        sourcePath: SOQL_SERVER_WORKER_URL,
        targetPath: `${SOQL_TARGET_ROOT}/soql-lsp-server.js`,
        mimeType: 'application/javascript',
    },
    {
        sourcePath: `${SOQL_SOURCE_ROOT}/grammars/soql.tmLanguage`,
        targetPath: `${SOQL_TARGET_ROOT}/soql.tmLanguage`,
        mimeType: 'application/xml',
    },
    {
        sourcePath: `${SOQL_SOURCE_ROOT}/dist/web/index.js`,
        targetPath: `${SOQL_TARGET_ROOT}/browser.js`,
        mimeType: 'application/javascript',
    },
    ...SOQL_UI_REMOTE_ASSETS,
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

export async function registerUnifiedSoqlExtension(
    vscodeBundle: VscodeBundle,
    { coreServices }: { coreServices?: CoreServices } = {}
) {
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

            const core = await resolveCoreServices(coreServices, vscodeBundle);
            if (
                !core?.connection?.runtime ||
                !core?.workspace?.context ||
                !core?.operations?.deployTools ||
                !core.features
            ) {
                return;
            }
            const connectionRuntime = core.connection.runtime;
            const context = core.workspace.context;
            const deployTools = core.operations.deployTools;
            const runtimeVscode = context.vscode || vscode;
            if (
                typeof context?.addDisposable !== 'function' ||
                typeof connectionRuntime?.loadStoredConn !== 'function' ||
                typeof connectionRuntime?.withToolingClientAuthed !== 'function' ||
                typeof connectionRuntime?.getInjectedConnectionRequiredMessage !== 'function'
            ) {
                return;
            }
            const extensionContext = context as Parameters<
                typeof createSoqlDataViewRuntime
            >[0]['context'];
            const soqlConnectionRuntime = connectionRuntime as Parameters<
                typeof registerSoqlBuilderRuntime
            >[0]['connectionRuntime'];

            let schemaApi: SchemaToolsApi | null = null;

            await core.features.activateOnce?.('salesforce-schema-tools', async () => {
                core.features?.setSchemaTools?.(
                    await registerSchemaTools({
                        connectionRuntime,
                        context,
                    })
                );
            });
            schemaApi = (core.operations?.schemaTools || null) as SchemaToolsApi | null;

            const soqlDataViewRuntime = createSoqlDataViewRuntime({
                vscode: runtimeVscode as Parameters<typeof createSoqlDataViewRuntime>[0]['vscode'],
                context: extensionContext,
            });

            await core.features.activateOnce?.('salesforce-soql', async () => {
                push(
                    registerSoqlBuilderRuntime({
                        vscode: runtimeVscode as Parameters<
                            typeof registerSoqlBuilderRuntime
                        >[0]['vscode'],
                        context: extensionContext,
                        connectionRuntime: soqlConnectionRuntime,
                        getSchemaTools: () =>
                            (core.operations?.schemaTools || null) as SchemaToolsApi | null,
                        openQueryResults: payload => soqlDataViewRuntime.showQueryResults(payload),
                        runQueryPlan: async soql => {
                            await runAndShowSoqlQueryPlan({
                                connectionRuntime: soqlConnectionRuntime,
                                outputChannel: context.output,
                                vscode: runtimeVscode,
                                soql,
                            });
                        },
                    })
                );
                registerQueryAndApexTools({
                    connectionRuntime,
                    context,
                    deployTools,
                    commandGroups: ['soql'],
                    soqlUi: {
                        showQueryResults: payload => soqlDataViewRuntime.showQueryResults(payload),
                    },
                });
            });

            const vs = vscode as VscodeLike;
            const useUpstreamRuntimeExperiment = Boolean(
                vs.workspace
                    ?.getConfiguration?.('salesforcedx-vscode-soql')
                    ?.get?.('experimental.useUpstreamBrowserRuntime')
            );
            if (useUpstreamRuntimeExperiment) {
                // eslint-disable-next-line no-console
                console.info(
                    '[sf-soql-workbench] Upstream browser runtime experiment requested. Local adapter runtime remains active while feasibility constraints are evaluated.'
                );
            }
            const middleware = createSoqlCompletionMiddleware({
                CompletionItemKind: vs.CompletionItemKind,
                loadConnection: () =>
                    (typeof core.connection?.runtime?.loadLiveConnection === 'function'
                        ? core.connection.runtime.loadLiveConnection()
                        : core.connection?.runtime?.loadStoredConn?.()) as Record<
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
                                typeof connectionRuntime.loadLiveConnection === 'function'
                                    ? connectionRuntime.loadLiveConnection()
                                    : connectionRuntime.loadStoredConn()
                            ) as Record<string, unknown>;
                            if (!conn?.instanceUrl || !conn?.accessToken) {
                                return {
                                    error: {
                                        name: 'NoConnection',
                                        message:
                                            connectionRuntime.getInjectedConnectionRequiredMessage(),
                                    },
                                };
                            }
                            try {
                                if (!enabled) {
                                    return { done: true, totalSize: 0, records: [] as const };
                                }
                                const result = await executeSoqlQuery({
                                    connectionRuntime: soqlConnectionRuntime,
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
