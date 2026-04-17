import { buildSalesforceExtensionConfig } from '../core/extensionManifest';
import { registerSalesforceExtension } from '../core/extensionRegistration';
import { resolveCoreServices, type CoreServices } from '../core/coreServices';
import { registerQueryAndApexTools } from '../metadata/commands/queryAndApexTools';
import { LanguageClientWrapper } from '../../../languageClient/wrapper';

const APEX_LANGUAGE_ASSETS = [
    {
        sourcePath: '/libs/extensions/salesforce-apex/grammars/apex.tmLanguage',
        targetPath: '/workspace/vscode/apex.tmLanguage',
        mimeType: 'application/xml',
    },
    {
        sourcePath: '/libs/extensions/salesforce-apex/grammars/soql.tmLanguage',
        targetPath: '/workspace/vscode/apex.soql.tmLanguage',
        mimeType: 'application/xml',
    },
    {
        sourcePath: '/libs/extensions/salesforce-apex/syntaxes/apex.configuration.json',
        targetPath: '/workspace/vscode/apex.configuration.json',
        mimeType: 'application/json',
    },
    {
        sourcePath: '/libs/extensions/salesforce-apex/snippets/apex.json',
        targetPath: '/workspace/vscode/apex.code-snippets',
        mimeType: 'application/json',
    },
];

function buildApexExtensionConfig() {
    return buildSalesforceExtensionConfig({
        name: 'sf-apex',
        displayName: 'Salesforce Apex (Workbench)',
        description: 'Apex language support and Apex commands for the workbench',
        contributes: {
            languages: [
                {
                    id: 'apex',
                    aliases: ['Apex'],
                    extensions: ['.cls', '.trigger', '.apex'],
                    configuration: '/workspace/vscode/apex.configuration.json',
                },
            ],
            grammars: [
                {
                    language: 'apex',
                    scopeName: 'source.apex',
                    path: '/workspace/vscode/apex.tmLanguage',
                },
            ],
            snippets: [
                { language: 'apex', path: '/workspace/vscode/apex.code-snippets' },
            ],
            commands: [
                {
                    command: 'salesforceMetadata.executeAnonymous',
                    title: 'Salesforce: Execute Anonymous Apex (inline)',
                },
                {
                    command: 'salesforceMetadata.executeAnonymousWithLogs',
                    title: 'Salesforce: Execute Anonymous Apex with Logs',
                },
                {
                    command: 'salesforceMetadata.runApexTests',
                    title: 'Salesforce: Run Apex Tests (Tooling API)',
                },
                {
                    command: 'salesforceMetadata.runApexTestsCurrentFile',
                    title: 'Salesforce: Run Apex Tests (Current File)',
                },
                {
                    command: 'salesforceMetadata.runApexTestMethod',
                    title: 'Salesforce: Run Apex Test Method',
                },
                {
                    command: 'salesforceMetadata.enableDebugLogs',
                    title: 'Salesforce: Enable Debug Logs (Tooling API)',
                },
                {
                    command: 'salesforceMetadata.openDebugLogs',
                    title: 'Salesforce: Open Debug Logs (Tooling API)',
                },
            ],
            menus: {
                commandPalette: [
                    { command: 'salesforceMetadata.executeAnonymous' },
                    { command: 'salesforceMetadata.executeAnonymousWithLogs' },
                    { command: 'salesforceMetadata.runApexTests' },
                    { command: 'salesforceMetadata.runApexTestsCurrentFile' },
                    { command: 'salesforceMetadata.enableDebugLogs' },
                    { command: 'salesforceMetadata.openDebugLogs' },
                ],
                'editor/context': [
                    {
                        command: 'salesforceMetadata.executeAnonymous',
                        when: 'editorHasSelection',
                        group: 'z_salesforce@1',
                    },
                    {
                        command: 'salesforceMetadata.runApexTestsCurrentFile',
                        when: "editorLangId == 'apex'",
                        group: 'z_salesforce@2',
                    },
                ],
            },
        },
    });
}

export async function register(
    vscodeBundle,
    { coreServices }: { coreServices?: CoreServices } = {}
) {
    return registerSalesforceExtension(
        vscodeBundle,
        {
            config: buildApexExtensionConfig(),
            remoteAssets: APEX_LANGUAGE_ASSETS,
        },
        async (_vscode, { push }) => {
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

            await core.features.activateOnce?.('salesforce-apex', async () => {
                registerQueryAndApexTools({
                    connectionRuntime,
                    context,
                    deployTools,
                    commandGroups: ['apex'],
                });

                const vs = vscodeBundle?.vscode;
                if (vs?.workspace?.onDidOpenTextDocument && vs?.languages?.setTextDocumentLanguage) {
                    context.addDisposable?.(
                        vs.workspace.onDidOpenTextDocument(async doc => {
                            try {
                                const path = doc?.uri?.path || '';
                                if (
                                    (path.endsWith('.cls') ||
                                        path.endsWith('.trigger') ||
                                        path.endsWith('.apex')) &&
                                    doc.languageId !== 'apex'
                                ) {
                                    await vs.languages.setTextDocumentLanguage(doc, 'apex');
                                }
                            } catch {
                                // ignore
                            }
                        })
                    );
                }

                try {
                    const worker = new Worker(
                        '/libs/extensions/salesforce-apex/server/server.browser.js',
                        { type: 'module', name: 'Apex LS' }
                    );
                    const wrapper = new LanguageClientWrapper({
                        languageId: 'apex',
                        clientOptions: {
                            documentSelector: [
                                { scheme: 'file', language: 'apex' },
                            ],
                        },
                        connection: {
                            options: {
                                $type: 'WorkerDirect',
                                worker,
                            },
                        },
                    });
                    await wrapper.start();
                    push(wrapper);
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.warn('Apex language client failed to start:', error);
                }
            });
        }
    );
}
