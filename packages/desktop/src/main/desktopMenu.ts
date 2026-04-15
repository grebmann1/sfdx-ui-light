import { Menu, shell } from 'electron';

type DesktopMenuOptions = {
    apiBaseUrl: string | null;
};

export function registerDesktopMenu(options: DesktopMenuOptions): void {
    const template: Electron.MenuItemConstructorOptions[] = [
        {
            label: 'Workbench Desktop',
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' },
            ],
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' },
            ],
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
            ],
        },
        {
            label: 'Window',
            submenu: [{ role: 'minimize' }, { role: 'close' }, { role: 'front' }],
        },
        {
            label: 'Automation',
            submenu: [
                {
                    label: options.apiBaseUrl
                        ? `Open Desktop API (${options.apiBaseUrl})`
                        : 'Desktop API unavailable',
                    enabled: Boolean(options.apiBaseUrl),
                    click: () => {
                        if (options.apiBaseUrl) {
                            void shell.openExternal(options.apiBaseUrl);
                        }
                    },
                },
            ],
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Workbench Web',
                    click: () => {
                        void shell.openExternal('https://sf-toolkit.com');
                    },
                },
            ],
        },
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
