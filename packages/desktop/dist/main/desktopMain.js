"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_path_1 = __importDefault(require("node:path"));
const electron_1 = require("electron");
const desktopAutomationServer_1 = require("./desktopAutomationServer");
const desktopLegacyBus_1 = require("./desktopLegacyBus");
const desktopMenu_1 = require("./desktopMenu");
const desktopPaths_1 = require("./desktopPaths");
const desktopRendererServer_1 = require("./desktopRendererServer");
const ipcRouter_1 = require("./ipcRouter");
const launchIntent_1 = require("./launchIntent");
const windowManager_1 = require("./windowManager");
const DEFAULT_DEV_RENDERER_URL = 'http://localhost:3000/app';
function normalizeRendererUrl(rawUrl) {
    try {
        const parsedUrl = new URL(rawUrl);
        if (!parsedUrl.pathname || parsedUrl.pathname === '/') {
            parsedUrl.pathname = '/app';
        }
        return parsedUrl.toString();
    }
    catch {
        return DEFAULT_DEV_RENDERER_URL;
    }
}
let lastLaunchIntent = (0, launchIntent_1.parseLaunchIntent)(process.argv);
const preloadPath = node_path_1.default.join(__dirname, '../preload/desktopPreload.js');
const legacyBus = new desktopLegacyBus_1.DesktopLegacyBus();
let rendererUrl = DEFAULT_DEV_RENDERER_URL;
let rendererServer = null;
let automationServer = null;
async function resolveRendererUrl() {
    const configuredUrl = process.env.DESKTOP_RENDERER_URL?.trim();
    if (!electron_1.app.isPackaged && configuredUrl) {
        return normalizeRendererUrl(configuredUrl);
    }
    if (!electron_1.app.isPackaged) {
        return normalizeRendererUrl(DEFAULT_DEV_RENDERER_URL);
    }
    rendererServer =
        rendererServer ||
            new desktopRendererServer_1.DesktopRendererServer({
                webRoot: (0, desktopPaths_1.getPackagedWebRoot)(),
                appVersion: electron_1.app.getVersion(),
            });
    const baseUrl = await rendererServer.start();
    return normalizeRendererUrl(`${baseUrl}/app`);
}
function isSafeExternalUrl(url) {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'mailto:';
    }
    catch {
        return false;
    }
}
function isAllowedNavigation(url, rendererUrl) {
    if (url === 'about:blank') {
        return true;
    }
    try {
        const targetUrl = new URL(url);
        const expectedUrl = new URL(rendererUrl);
        return targetUrl.origin === expectedUrl.origin;
    }
    catch {
        return false;
    }
}
function registerWebContentsGuards(rendererUrl) {
    electron_1.session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
        callback(false);
    });
    electron_1.app.on('web-contents-created', (_event, webContents) => {
        webContents.setWindowOpenHandler(({ url }) => {
            if (isSafeExternalUrl(url)) {
                void electron_1.shell.openExternal(url);
            }
            return { action: 'deny' };
        });
        webContents.on('will-navigate', (event, url) => {
            if (!isAllowedNavigation(url, rendererUrl)) {
                event.preventDefault();
            }
        });
    });
}
electron_1.app.setName('SF Toolkit Desktop');
const windowManager = new windowManager_1.WindowManager({ preloadPath, rendererUrl });
async function openInstance(payload) {
    const orgAlias = typeof payload.alias === 'string' && payload.alias.trim()
        ? payload.alias
        : typeof payload.username === 'string' && payload.username.trim()
            ? payload.username
            : null;
    lastLaunchIntent = orgAlias
        ? {
            target: 'org',
            orgAlias,
        }
        : (0, launchIntent_1.createDefaultLaunchIntent)();
    await windowManager.ensureMainWindow((0, launchIntent_1.createDefaultLaunchIntent)());
    await windowManager.openInstanceWindow(payload);
}
(0, ipcRouter_1.registerDesktopIpcRouter)({
    getLaunchIntent: () => lastLaunchIntent,
    getRendererUrl: () => rendererUrl,
    handleLegacyMessage: payload => legacyBus.handleRendererMessage(payload),
    openInstance,
    updateLimitedModeStatus: (sender, payload) => {
        windowManager.updateInstanceWindowStatus(sender, payload);
    },
});
const singleInstanceLock = electron_1.app.requestSingleInstanceLock(lastLaunchIntent);
if (!singleInstanceLock) {
    electron_1.app.quit();
}
electron_1.app.on('second-instance', async (_event, argv, _workingDirectory, additionalData) => {
    lastLaunchIntent =
        additionalData && typeof additionalData === 'object'
            ? additionalData
            : (0, launchIntent_1.parseLaunchIntent)(argv);
    await windowManager.ensureMainWindow((0, launchIntent_1.createDefaultLaunchIntent)());
    if (lastLaunchIntent.target === 'org') {
        await openInstance({ alias: lastLaunchIntent.orgAlias });
        return;
    }
    windowManager.focusMainWindow();
    windowManager.dispatchLaunchIntent(lastLaunchIntent);
});
electron_1.app.whenReady().then(async () => {
    rendererUrl = await resolveRendererUrl();
    windowManager.setRendererUrl(rendererUrl);
    registerWebContentsGuards(rendererUrl);
    automationServer = new desktopAutomationServer_1.DesktopAutomationServer({
        host: process.env.API_HOST?.replace(/^https?:\/\//, '') || '127.0.0.1',
        legacyBus,
        openInstance,
        port: Number(process.env.API_PORT || '12346'),
        windowManager,
    });
    let automationBaseUrl = null;
    try {
        automationBaseUrl = await automationServer.start();
    }
    catch {
        automationBaseUrl = null;
    }
    (0, desktopMenu_1.registerDesktopMenu)({ apiBaseUrl: automationBaseUrl });
    await windowManager.ensureMainWindow((0, launchIntent_1.createDefaultLaunchIntent)());
    if (lastLaunchIntent.target === 'org') {
        await openInstance({ alias: lastLaunchIntent.orgAlias });
    }
    else {
        windowManager.dispatchLaunchIntent(lastLaunchIntent);
    }
    electron_1.app.on('activate', async () => {
        await windowManager.ensureMainWindow((0, launchIntent_1.createDefaultLaunchIntent)());
    });
});
electron_1.app.on('before-quit', async () => {
    legacyBus.rejectAll('The desktop app is shutting down.');
    await Promise.allSettled([rendererServer?.stop(), automationServer?.stop()]);
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
