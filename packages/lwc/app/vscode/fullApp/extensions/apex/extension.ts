import { buildSalesforceExtensionConfig } from '../core/extensionManifest';
import { registerSalesforceExtension } from '../core/extensionRegistration';
import { registerQueryAndApexTools } from '../metadata/commands/queryAndApexTools';
import { getOrCreateSalesforceWorkbenchHost } from '../salesforce/salesforceWorkbenchHost';

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

export async function register(vscodeBundle) {
    return registerSalesforceExtension(
        vscodeBundle,
        {
            config: buildApexExtensionConfig(),
            remoteAssets: APEX_LANGUAGE_ASSETS,
        },
        async () => {
            const sfHost = await getOrCreateSalesforceWorkbenchHost(vscodeBundle);
            if (!sfHost) return;

            await sfHost.activateFeatureOnce(
                'salesforce-apex',
                async ({ connectionRuntime, context, deployTools }) => {
                    registerQueryAndApexTools({
                        connectionRuntime,
                        context,
                        deployTools,
                        commandGroups: ['apex'],
                    });
                }
            );
        }
    );
}
