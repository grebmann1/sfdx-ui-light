import { getOrCreateSalesforceWorkbenchHost } from '../../platform/workbenchHost';

export type SalesforceHost = Awaited<ReturnType<typeof getOrCreateSalesforceWorkbenchHost>>;
export type NonNullSalesforceHost = Exclude<SalesforceHost, null | undefined>;
