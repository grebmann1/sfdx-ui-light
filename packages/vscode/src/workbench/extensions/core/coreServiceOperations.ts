export type OperationsCoreService = {
    deployTools?: {
        [key: string]: unknown;
        registerCommandGroups?: (groups: string[]) => void;
        setLwcDocumentTools?: (tools?: Record<string, unknown>) => void;
        updateSourceTrackingForPaths?: (
            changedPaths?: string[],
            options?: { forceRemoteRefresh?: boolean }
        ) => Promise<unknown>;
    };
    schemaTools?: {
        [key: string]: unknown;
    };
};

export function buildOperationsCoreService(host: {
    [key: string]: unknown;
}): OperationsCoreService {
    return {
        deployTools: host.deployTools as OperationsCoreService['deployTools'],
        schemaTools: host.schemaTools as OperationsCoreService['schemaTools'],
    };
}
