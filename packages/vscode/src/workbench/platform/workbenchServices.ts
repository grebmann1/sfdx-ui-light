import { buildOrgContext } from '../connection/orgContext';
import { getActiveSalesforceWorkbenchHost } from './workbenchHost';

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

export function getWorkbenchOrgContext(): Record<string, unknown> | null {
    const connection = getWorkbenchConnection();
    if (!connection?.instanceUrl) return null;
    return buildOrgContext(connection);
}
