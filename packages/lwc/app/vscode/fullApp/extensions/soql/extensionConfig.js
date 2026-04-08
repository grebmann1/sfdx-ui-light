import { buildSalesforceExtensionConfig } from '../salesforce/salesforceExtensionSupport.js';

export function buildSoqlExtensionConfig() {
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
