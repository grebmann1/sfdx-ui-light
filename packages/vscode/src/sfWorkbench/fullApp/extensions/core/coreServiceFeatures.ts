export type FeaturesCoreService = {
    activateFeature?: (
        featureId: string,
        activateFeature: (host?: unknown) => Promise<void> | void
    ) => Promise<unknown>;
    activateOnce?: (
        featureId: string,
        activateFeature: (host?: unknown) => Promise<void> | void
    ) => Promise<unknown>;
    resetSchemaBootstrap?: (identity?: {
        apiVersion?: string;
        instanceUrl?: string;
        workspaceRoot?: string;
    }) => void;
    scheduleSchemaBootstrap?: (conn?: unknown, options?: { force?: boolean }) => Promise<unknown>;
    setSchemaTools?: (nextSchemaTools?: Record<string, unknown>) => void;
    setLoginProblem?: (message?: string) => void;
};

export function buildFeaturesCoreService(host: { [key: string]: unknown }): FeaturesCoreService {
    const activateFeatureOnce = host.activateFeatureOnce as FeaturesCoreService['activateOnce'];
    const resetSchemaBootstrap =
        host.resetSchemaBootstrap as FeaturesCoreService['resetSchemaBootstrap'];
    const scheduleSchemaBootstrap =
        host.scheduleSchemaBootstrap as FeaturesCoreService['scheduleSchemaBootstrap'];
    const setSchemaTools = host.setSchemaTools as FeaturesCoreService['setSchemaTools'];
    const setLoginProblem = host.setLoginProblem as FeaturesCoreService['setLoginProblem'];
    return {
        activateFeature: activateFeatureOnce?.bind(host),
        activateOnce: activateFeatureOnce?.bind(host),
        resetSchemaBootstrap: resetSchemaBootstrap?.bind(host),
        scheduleSchemaBootstrap: scheduleSchemaBootstrap?.bind(host),
        setSchemaTools: setSchemaTools?.bind(host),
        setLoginProblem: setLoginProblem?.bind(host),
    };
}
