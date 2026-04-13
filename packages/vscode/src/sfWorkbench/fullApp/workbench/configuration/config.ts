import { LIGHT_COLOR_THEME } from '../../constants';

import { buildWorkbenchDefaultChatAgent } from './workbenchAiOverrides';

export const buildUserConfiguration = (isChromeExtension: boolean) => ({
    'workbench.colorTheme': LIGHT_COLOR_THEME,
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

export const buildWorkspaceConfig = async (
    vscodeBundle: { vscode: { Uri: { file: (p: string) => unknown } } },
    isChromeExtension: boolean,
    workspaceRoot = '/workspace'
) => ({
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
        defaultChatAgent: buildWorkbenchDefaultChatAgent(),
        ...(isChromeExtension
            ? {}
            : {
                  extensionsGallery: {
                      serviceUrl: 'https://open-vsx.org/vscode/gallery',
                      itemUrl: 'https://open-vsx.org/vscode/item',
                      resourceUrlTemplate:
                          'https://open-vsx.org/vscode/unpkg/{publisher}/{name}/{version}/{path}',
                      controlUrl: '',
                      nlsBaseUrl: '',
                  },
              }),
    },
});

export const preloadWorkbenchConfiguration = async (
    vscodeBundle: {
        services?: {
            initUserConfiguration?: (json: string) => Promise<unknown>;
            initUserKeybindings?: (json: string) => Promise<unknown>;
        };
    },
    userConfiguration: Record<string, unknown>
) => {
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
