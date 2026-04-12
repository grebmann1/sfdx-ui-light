import { createWorkbenchFilesService } from './workbenchFileService';

function getWorkspaceRoot(app) {
    return app?._workspaceRoot || '/workspace';
}

export async function seedWorkspaceFiles(
    app,
    {
        getVscodeBundle,
        getIndexedDbFileSystem,
        ensureDirectories = [],
        initialFiles = {},
        workspaceRoot,
    }
) {
    const root = workspaceRoot || getWorkspaceRoot(app);
    const currentWorkspaceRoot =
        app?._workbenchFilesService?.workspaceRoot || app?._workspaceRoot || '/workspace';
    if (app._fsProvider && currentWorkspaceRoot === root) {
        return;
    }

    const vscodeBundle = await getVscodeBundle();
    app._vscodeBundle = vscodeBundle;
    app._vscode = vscodeBundle.vscode;
    app._workbenchFilesService =
        app._ensureWorkbenchFilesService?.(vscodeBundle) ||
        createWorkbenchFilesService({
            vscodeBundle,
            vscode: app._vscode,
            workspaceRoot: root,
        });
    const directoriesToEnsure =
        ensureDirectories.length > 0
            ? ensureDirectories
            : [root, `${root}/.vscode`, `${root}/force-app/main/default`, `${root}/.salesforce`];
    app._appFs = getIndexedDbFileSystem({
        ensureDirectories: directoriesToEnsure,
        initialFiles,
    });
    await app._appFs?.ready;
    for (const dir of directoriesToEnsure) {
        await app._appFs?.mkdir(dir, { recursive: true }).catch(() => {});
    }
    if (initialFiles && Object.keys(initialFiles).length > 0) {
        await app._appFs?.registerInitialFiles(initialFiles).catch(() => {});
    }

    if (!app._workbenchFilesService) {
        return;
    }
    if (!app._workbenchFilesService.hasOverlayRegistration()) {
        return;
    }

    const previousProvider = app._fsProvider;
    const { provider, overlayDisposable } = app._workbenchFilesService.mountWorkspaceOverlay({
        fs: app._appFs,
        priority: 1,
        nextWorkspaceRoot: root,
    });
    app._fsProvider = provider;

    app._fsOverlayDisposable?.dispose?.();
    app._fsOverlayDisposable = overlayDisposable;
    if (previousProvider && previousProvider !== provider) {
        previousProvider.dispose?.();
    }
}
