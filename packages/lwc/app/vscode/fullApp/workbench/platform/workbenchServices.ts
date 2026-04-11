import { getActiveSalesforceWorkbenchHost } from '../../extensions/salesforce/salesforceWorkbenchHost';

export type SalesforceWorkbenchHost = NonNullable<
    ReturnType<typeof getActiveSalesforceWorkbenchHost>
>;

export function getWorkbenchHost(): SalesforceWorkbenchHost | null {
    return getActiveSalesforceWorkbenchHost();
}

export function getWorkbenchConnection(): Record<string, unknown> {
    const host = getWorkbenchHost();
    const runtime = host?.connectionRuntime;
    if (runtime && typeof runtime.loadLiveConnection === 'function') {
        return runtime.loadLiveConnection() || {};
    }
    if (runtime && typeof runtime.loadStoredConn === 'function') {
        return runtime.loadStoredConn();
    }
    return {};
}
