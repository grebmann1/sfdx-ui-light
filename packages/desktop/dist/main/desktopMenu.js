"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDesktopMenu = registerDesktopMenu;
const electron_1 = require("electron");
function registerDesktopMenu(options) {
    const template = [
        {
            label: 'SF Toolkit Desktop',
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
                            void electron_1.shell.openExternal(options.apiBaseUrl);
                        }
                    },
                },
            ],
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'SF Toolkit Web',
                    click: () => {
                        void electron_1.shell.openExternal('https://sf-toolkit.com');
                    },
                },
            ],
        },
    ];
    electron_1.Menu.setApplicationMenu(electron_1.Menu.buildFromTemplate(template));
}
