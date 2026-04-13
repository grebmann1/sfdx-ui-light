export type WorkspaceCoreService = {
    addDisposable?: (disposable: unknown) => unknown;
    context?: {
        [key: string]: unknown;
        addDisposable?: (disposable: unknown) => unknown;
        state?: Record<string, unknown>;
        vscode?: unknown;
    };
    state?: Record<string, unknown>;
    vscode?: unknown;
};

export function buildWorkspaceCoreService(host: { [key: string]: unknown }): WorkspaceCoreService {
    const context = (host.context || {}) as WorkspaceCoreService['context'];
    return {
        addDisposable: context?.addDisposable,
        context,
        state: context?.state,
        vscode: context?.vscode,
    };
}
