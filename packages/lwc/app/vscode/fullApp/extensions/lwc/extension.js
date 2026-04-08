import { registerLwcComponentScaffolding } from '../metadata/commands/lwcComponentScaffolding.js';
import { LWC_SNIPPET_ASSETS, WEB_LANGUAGE_ASSETS } from '../metadata/constants.js';
import { buildSalesforceExtensionBundle } from '../salesforce/salesforceExtensionSupport.js';
import { getOrCreateSalesforceWorkbenchHost } from '../salesforce/salesforceWorkbenchHost.js';
import { buildLwcExtensionConfig } from './extensionConfig.js';

export async function loadExtension() {
    return await buildSalesforceExtensionBundle({
        config: buildLwcExtensionConfig(),
        remoteAssets: [...WEB_LANGUAGE_ASSETS, ...LWC_SNIPPET_ASSETS],
    });
}

export async function activate(vscodeBundle) {
    const host = await getOrCreateSalesforceWorkbenchHost(vscodeBundle);
    if (!host) {
        return { dispose() {} };
    }

    await host.activateFeatureOnce('salesforce-lwc', async ({ connectionRuntime, context, deployTools }) => {
        registerLwcComponentScaffolding({ connectionRuntime, context });
        deployTools.registerCommandGroups(['lwc']);
    });

    return host;
}
