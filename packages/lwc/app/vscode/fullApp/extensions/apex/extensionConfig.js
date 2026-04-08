import { buildSalesforceExtensionConfig } from '../salesforce/salesforceExtensionSupport.js';

export function buildApexExtensionConfig() {
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
