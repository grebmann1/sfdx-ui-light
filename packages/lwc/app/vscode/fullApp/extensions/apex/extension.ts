import { buildSalesforceExtensionConfig } from '../core/extensionManifest';
import { registerSalesforceExtension } from '../core/extensionRegistration';
import { resolveCoreServices, type CoreServices } from '../core/coreServices';
import { registerQueryAndApexTools } from '../metadata/commands/queryAndApexTools';

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
            commands: [
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
            ],
            menus: {
                commandPalette: [
                    { command: 'salesforceMetadata.executeAnonymous' },
                    { command: 'salesforceMetadata.runApexTests' },
                    { command: 'salesforceMetadata.enableDebugLogs' },
                    { command: 'salesforceMetadata.openDebugLogs' },
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
        async () => {
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
            });
        }
    );
}
