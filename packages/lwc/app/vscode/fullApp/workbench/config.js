import { LIGHT_COLOR_THEME, DARK_COLOR_THEME } from '../constants.js';

export const buildUserConfiguration = (isChromeExtension) => ({
    'workbench.colorTheme': LIGHT_COLOR_THEME,
    // 'workbench.startupEditor': 'none',
    'files.autoSave': 'off',
    'window.menuBarVisibility': 'visible',
    ...(isChromeExtension
        ? {
            'workbench.activity.showExtensions': false,
            'workbench.activity.showSCM': false,
            'workbench.activity.showTesting': false,
            'workbench.activity.showDebug': false,
        }
        : {
            'workbench.activity.showExtensions': true,
        }),
    'extensions.autoCheckUpdates': false,
    'extensions.autoUpdate': false,
});

export const buildWorkspaceConfig = async (vscodeBundle, isChromeExtension, workspaceRoot = '/workspace') => ({
    workspaceProvider: {
        trusted: true,
        workspace: {
            folderUri: vscodeBundle.vscode.Uri.file(workspaceRoot),
        },
        async open() {
            window.open(window.location.href);
            return true;
        },
    },
    productConfiguration: {
        nameShort: 'monaco-workbench',
        nameLong: 'Monaco Workbench',
        ...(isChromeExtension
            ? {}
            : {
                extensionsGallery: {
                    serviceUrl: 'https://open-vsx.org/vscode/gallery',
                    itemUrl: 'https://open-vsx.org/vscode/item',
                    resourceUrlTemplate: 'https://open-vsx.org/vscode/unpkg/{publisher}/{name}/{version}/{path}',
                    controlUrl: '',
                    nlsBaseUrl: '',
                },
            }),
    },
});

export const preloadWorkbenchConfiguration = async (vscodeBundle, userConfiguration) => {
    const initUserConfiguration = vscodeBundle?.services?.initUserConfiguration;
    const initUserKeybindings = vscodeBundle?.services?.initUserKeybindings;
    if (typeof initUserConfiguration !== 'function' || typeof initUserKeybindings !== 'function') {
        return;
    }
    await Promise.all([
        initUserConfiguration(JSON.stringify(userConfiguration)),
        initUserKeybindings(JSON.stringify([])),
    ]);
};
