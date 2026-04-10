type Logger = unknown;

function extensionAssetUrl(path: string) {
    const chromeApi = (globalThis as { chrome?: { runtime: { getURL: (p: string) => string } } })
        .chrome;
    return chromeApi!.runtime.getURL(path);
}

export const createChromeExtensionWorkerFactory = (vscodeBundle: {
    workers: {
        defineDefaultWorkerLoaders: () => Record<string, () => Worker>;
        useWorkerFactory: (opts: {
            workerLoaders: Record<string, () => Worker>;
            logger: Logger;
        }) => void;
    };
}) => {
    return async (logger: Logger) => {
        const defaultworkerLoaders = vscodeBundle.workers.defineDefaultWorkerLoaders();
        const editorWorkerFactory = () => {
            return new Worker(extensionAssetUrl('libs/vscode/workers/editor.min.js'), {
                type: 'module',
            });
        };
        defaultworkerLoaders.TextEditorWorker = editorWorkerFactory;
        defaultworkerLoaders.editorWorkerService = editorWorkerFactory;
        defaultworkerLoaders.TextMateWorker = () => {
            return new Worker(extensionAssetUrl('libs/vscode/workers/textmate.min.js'), {
                type: 'module',
            });
        };
        vscodeBundle.workers.useWorkerFactory({
            workerLoaders: defaultworkerLoaders,
            logger,
        });
    };
};
