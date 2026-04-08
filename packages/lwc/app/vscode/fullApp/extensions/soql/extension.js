import { registerQueryAndApexTools } from '../metadata/commands/queryAndApexTools.js';
import { SOQL_LANGUAGE_ASSETS } from '../metadata/constants.js';
import { registerSchemaTools } from '../metadata/runtime/schemaTools.js';
import { buildSalesforceExtensionBundle } from '../salesforce/salesforceExtensionSupport.js';
import { getOrCreateSalesforceWorkbenchHost } from '../salesforce/salesforceWorkbenchHost.js';
import { buildSoqlExtensionConfig } from './extensionConfig.js';

export async function loadExtension() {
    return await buildSalesforceExtensionBundle({
        config: buildSoqlExtensionConfig(),
        remoteAssets: SOQL_LANGUAGE_ASSETS,
    });
}

export async function activate(vscodeBundle) {
    const host = await getOrCreateSalesforceWorkbenchHost(vscodeBundle);
    if (!host) {
        return { dispose() {} };
    }

    await host.activateFeatureOnce('salesforce-soql', async ({ connectionRuntime, context, deployTools }) => {
        const schemaTools = await registerSchemaTools({ connectionRuntime, context });
        host.setSchemaTools(schemaTools);
        registerQueryAndApexTools({
            connectionRuntime,
            context,
            deployTools,
            commandGroups: ['soql'],
        });
    });

    return host;
}
