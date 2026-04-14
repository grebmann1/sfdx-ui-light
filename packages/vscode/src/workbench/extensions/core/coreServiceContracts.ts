import type { ApiCoreService, ConnectionCoreService } from './coreServiceConnection';
import type { CommandsCoreService } from './coreServiceCommands';
import type { FeaturesCoreService } from './coreServiceFeatures';
import type { OperationsCoreService } from './coreServiceOperations';
import type { UiCoreService } from './coreServiceUi';
import type { WorkspaceCoreService } from './coreServiceWorkspace';

export type CoreSalesforceHost = {
    [key: string]: unknown;
};

export type CoreServices = {
    salesforceHost?: CoreSalesforceHost | null;
    getSalesforceHost?: () => Promise<CoreSalesforceHost | null>;
    connection?: ConnectionCoreService;
    api?: ApiCoreService;
    workspace?: WorkspaceCoreService;
    operations?: OperationsCoreService;
    commands?: CommandsCoreService;
    ui?: UiCoreService;
    features?: FeaturesCoreService;
    orgContext?: Record<string, unknown> | null;
};

export type ResolvedCoreServices = CoreServices & {
    salesforceHost: CoreSalesforceHost;
};
