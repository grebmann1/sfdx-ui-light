export type UiCoreService = {
    diagnostics?: {
        [key: string]: unknown;
    };
    output?: {
        [key: string]: unknown;
        appendLine?: (message: string) => void;
    };
    statusItem?: {
        [key: string]: unknown;
    };
};

export function buildUiCoreService(host: { [key: string]: unknown }): UiCoreService {
    const context = (host.context || {}) as { [key: string]: unknown };
    return {
        diagnostics: context.diagnostics as UiCoreService['diagnostics'],
        output: context.output as UiCoreService['output'],
        statusItem: context.statusItem as UiCoreService['statusItem'],
    };
}
