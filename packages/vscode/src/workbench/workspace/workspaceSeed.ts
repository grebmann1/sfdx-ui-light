function getWorkspaceRoot(app) {
    return app?._workspaceRoot || '/workspace';
}

export async function seedWorkspaceFiles(
    app,
    {
        getIndexedDbFileSystem,
        ensureDirectories = [],
        initialFiles = {},
        workspaceRoot,
    }
) {
    const root = workspaceRoot || getWorkspaceRoot(app);

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
}
