import { registerQueryAndApexTools } from '../metadata/commands/queryAndApexTools.js';
import { buildApexExtensionConfig } from './extensionConfig.js';
import { registerSalesforceExtension } from '../shared.js';
import { getOrCreateSalesforceWorkbenchHost } from '../salesforce/salesforceWorkbenchHost.js';

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

export async function register(vscodeBundle) {
    return registerSalesforceExtension(
        vscodeBundle,
        {
            config: buildApexExtensionConfig(),
            remoteAssets: APEX_LANGUAGE_ASSETS,
        },
        async (_vscode, { push }) => {
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
