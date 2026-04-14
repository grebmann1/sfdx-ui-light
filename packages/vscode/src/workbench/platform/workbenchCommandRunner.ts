type WorkbenchVscode = {
    window?: { showErrorMessage?: (msg: string) => Promise<unknown> };
};

export async function runWorkbenchCommand<T>(
    vscode: WorkbenchVscode | null | undefined,
    title: string,
    fn: () => Promise<T>
): Promise<T | undefined> {
    try {
        return await fn();
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const full = `${title}: ${message}`;
        try {
            await vscode?.window?.showErrorMessage?.(full);
        } catch {
            // ignore
        }
        return undefined;
    }
}
