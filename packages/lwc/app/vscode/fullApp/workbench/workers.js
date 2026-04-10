export const createChromeExtensionWorkerFactory = (vscodeBundle) => {
    return async (logger) => {
        const defaultworkerLoaders = vscodeBundle.workers.defineDefaultWorkerLoaders();
        const editorWorkerFactory = () => {
            return new Worker(
                chrome.runtime.getURL('libs/vscode/workers/editor.min.js'),
                { type: 'module' }
            );
        };
        defaultworkerLoaders.TextEditorWorker = editorWorkerFactory;
        defaultworkerLoaders.editorWorkerService = editorWorkerFactory;
        defaultworkerLoaders.TextMateWorker = () => {
            return new Worker(
                chrome.runtime.getURL('libs/vscode/workers/textmate.min.js'),
                { type: 'module' }
            );
        };
        vscodeBundle.workers.useWorkerFactory({
            workerLoaders: defaultworkerLoaders,
            logger
        });
    };
};
