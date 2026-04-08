import { registerQueryAndApexTools } from '../metadata/commands/queryAndApexTools.js';
import { APEX_LANGUAGE_ASSETS } from '../metadata/constants.js';
import { buildApexExtensionConfig } from './extensionConfig.js';
import { buildSalesforceExtensionBundle } from '../salesforce/salesforceExtensionSupport.js';
import { getOrCreateSalesforceWorkbenchHost } from '../salesforce/salesforceWorkbenchHost.js';

export async function loadExtension() {
    return await buildSalesforceExtensionBundle({
        config: buildApexExtensionConfig(),
        remoteAssets: APEX_LANGUAGE_ASSETS,
    });
}

export async function activate(vscodeBundle) {
    const host = await getOrCreateSalesforceWorkbenchHost(vscodeBundle);
    if (!host) {
        return { dispose() {} };
    }

    await host.activateFeatureOnce('salesforce-apex', async ({ connectionRuntime, context, deployTools }) => {
        registerQueryAndApexTools({
            connectionRuntime,
            context,
            deployTools,
            commandGroups: ['apex'],
        });
    });

    return host;
}
