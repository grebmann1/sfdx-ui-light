import { registerQueryAndApexTools } from '../metadata/commands/queryAndApexTools.js';
import { registerSchemaTools } from '../metadata/runtime/schemaTools.js';
import { registerSalesforceExtension } from '../shared.js';
import { getOrCreateSalesforceWorkbenchHost } from '../salesforce/salesforceWorkbenchHost.js';
import { buildSoqlExtensionConfig } from './extensionConfig.js';

const SOQL_LANGUAGE_ASSETS = [
    {
        sourcePath: '/libs/extensions/salesforcedx-vscode-soql/grammars/soql.tmLanguage',
        targetPath: '/workspace/vscode/soql.tmLanguage',
        mimeType: 'application/xml',
    },
];

export async function register(vscodeBundle) {
    return registerSalesforceExtension(
        vscodeBundle,
        {
            config: buildSoqlExtensionConfig(),
            remoteAssets: SOQL_LANGUAGE_ASSETS,
        },
        async (_vscode, { push }) => {
            console.log('registering soql extension');
            const sfHost = await getOrCreateSalesforceWorkbenchHost(vscodeBundle);
            if (!sfHost) return;

            await sfHost.activateFeatureOnce(
                'salesforce-soql',
                async ({ connectionRuntime, context, deployTools }) => {
                    const schemaTools = await registerSchemaTools({ connectionRuntime, context });
                    sfHost.setSchemaTools(schemaTools);
                    registerQueryAndApexTools({
                        connectionRuntime,
                        context,
                        deployTools,
                        commandGroups: ['soql'],
                    });
                }
            );
        }
    );
}
