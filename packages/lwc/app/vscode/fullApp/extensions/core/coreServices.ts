import { getOrCreateSalesforceWorkbenchHost } from '../salesforce/salesforceWorkbenchHost';
import { buildApiCoreService, buildConnectionCoreService } from './coreServiceConnection';
import { buildCommandsCoreService } from './coreServiceCommands';
import type { CoreServices, ResolvedCoreServices } from './coreServiceContracts';
import { buildFeaturesCoreService } from './coreServiceFeatures';
import type { NonNullSalesforceHost, SalesforceHost } from './coreServiceHostTypes';
import { buildOperationsCoreService } from './coreServiceOperations';
import { buildUiCoreService } from './coreServiceUi';
import { buildWorkspaceCoreService } from './coreServiceWorkspace';
import type { VscodeBundle } from './extensionRegistration';

export type { CoreServices, ResolvedCoreServices } from './coreServiceContracts';

function attachHostServices(host: NonNullSalesforceHost): ResolvedCoreServices {
    return {
        salesforceHost: host,
        getSalesforceHost: async () => host,
        connection: buildConnectionCoreService(host),
        api: buildApiCoreService(host),
        workspace: buildWorkspaceCoreService(host),
        operations: buildOperationsCoreService(host),
        commands: buildCommandsCoreService(),
        ui: buildUiCoreService(host),
        features: buildFeaturesCoreService(host),
    };
}

export async function createCoreServices(vscodeBundle: VscodeBundle): Promise<CoreServices> {
    let cachedHost: SalesforceHost | null | undefined;
    let inFlight: Promise<SalesforceHost | null> | null = null;

    const getSalesforceHost = async () => {
        if (cachedHost !== undefined) {
            return cachedHost;
        }
        if (inFlight) {
            return await inFlight;
        }
        inFlight = Promise.resolve(getOrCreateSalesforceWorkbenchHost(vscodeBundle))
            .then(host => {
                cachedHost = host || null;
                return cachedHost;
            })
            .finally(() => {
                inFlight = null;
            });
        return await inFlight;
    };

    const host = await getSalesforceHost();
    if (!host) {
        return {
            salesforceHost: null,
            getSalesforceHost,
            commands: buildCommandsCoreService(),
        };
    }
    return attachHostServices(host);
}

export async function resolveSalesforceHost(
    coreServices: CoreServices | undefined,
    vscodeBundle: VscodeBundle
) {
    if (coreServices?.salesforceHost) {
        return coreServices.salesforceHost as SalesforceHost;
    }
    if (typeof coreServices?.getSalesforceHost === 'function') {
        const host = await coreServices.getSalesforceHost();
        if (host) {
            return host as SalesforceHost;
        }
    }
    return await getOrCreateSalesforceWorkbenchHost(vscodeBundle);
}

export async function resolveCoreServices(
    coreServices: CoreServices | undefined,
    vscodeBundle: VscodeBundle
): Promise<ResolvedCoreServices | null> {
    if (coreServices?.salesforceHost) {
        const host = coreServices.salesforceHost as NonNullSalesforceHost;
        return {
            ...coreServices,
            ...attachHostServices(host),
        };
    }
    const resolvedHost = await resolveSalesforceHost(coreServices, vscodeBundle);
    if (!resolvedHost) {
        return null;
    }
    return attachHostServices(resolvedHost);
}
