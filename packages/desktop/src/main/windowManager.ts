import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron';

import type { DesktopLaunchIntent } from './launchIntent';

type WindowManagerOptions = {
    preloadPath: string;
    rendererUrl: string;
};

export class WindowManager {
    private readonly preloadPath: string;
    private rendererUrl: string;
    private mainWindow: BrowserWindow | null = null;
    private readonly instanceWindows = new Map<string, BrowserWindow>();

    constructor({ preloadPath, rendererUrl }: WindowManagerOptions) {
        this.preloadPath = preloadPath;
        this.rendererUrl = rendererUrl;
    }

    setRendererUrl(rendererUrl: string): void {
        this.rendererUrl = rendererUrl;
    }

    getMainWindow(): BrowserWindow | null {
        return this.mainWindow;
    }

    getWindowByAlias(alias: string): BrowserWindow | null {
        return this.instanceWindows.get(alias) || null;
    }

    getHomeWindow(): BrowserWindow | null {
        return this.mainWindow;
    }

    listWindowAliases(): string[] {
        return Array.from(this.instanceWindows.keys()).sort((left, right) =>
            left.localeCompare(right)
        );
    }

    focusMainWindow(): void {
        if (!this.mainWindow) {
            return;
        }

        if (this.mainWindow.isMinimized()) {
            this.mainWindow.restore();
        }

        this.mainWindow.focus();
    }

    async ensureMainWindow(initialLaunchIntent: DesktopLaunchIntent): Promise<BrowserWindow> {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.focusMainWindow();
            return this.mainWindow;
        }

        const browserWindowOptions: BrowserWindowConstructorOptions = {
            width: 1440,
            height: 960,
            minWidth: 1100,
            minHeight: 700,
            title: 'SF Toolkit Desktop',
            show: false,
            autoHideMenuBar: false,
            webPreferences: {
                preload: this.preloadPath,
                contextIsolation: true,
                sandbox: true,
                nodeIntegration: false,
                spellcheck: false,
            },
        };

        this.mainWindow = new BrowserWindow(browserWindowOptions);

        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });

        this.mainWindow.webContents.once('did-finish-load', () => {
            this.dispatchLaunchIntent(initialLaunchIntent);
            this.mainWindow?.show();
        });

        await this.mainWindow.loadURL(this.rendererUrl);

        return this.mainWindow;
    }

    async openInstanceWindow(payload: Record<string, any>): Promise<BrowserWindow> {
        const instanceKey = this.getInstanceWindowKey(payload);
        if (!instanceKey) {
            throw new Error('An alias, username, or session is required to open an org window.');
        }

        const existingWindow = this.instanceWindows.get(instanceKey);
        if (existingWindow && !existingWindow.isDestroyed()) {
            this.focusWindow(existingWindow);
            return existingWindow;
        }

        const browserWindowOptions: BrowserWindowConstructorOptions = {
            width: 1400,
            height: 920,
            minWidth: 1100,
            minHeight: 700,
            title: this.formatInstanceTitle(payload),
            show: false,
            autoHideMenuBar: false,
            parent: this.mainWindow || undefined,
            webPreferences: {
                preload: this.preloadPath,
                contextIsolation: true,
                sandbox: true,
                nodeIntegration: false,
                spellcheck: false,
            },
        };

        const instanceWindow = new BrowserWindow(browserWindowOptions);
        this.instanceWindows.set(instanceKey, instanceWindow);

        instanceWindow.on('closed', () => {
            this.instanceWindows.delete(instanceKey);
        });

        instanceWindow.webContents.once('did-finish-load', () => {
            instanceWindow.show();
            this.focusWindow(instanceWindow);
        });

        await instanceWindow.loadURL(this.buildInstanceRendererUrl(payload));
        return instanceWindow;
    }

    dispatchLaunchIntent(intent: DesktopLaunchIntent): void {
        this.mainWindow?.webContents.send('desktop:launch-intent', intent);
    }

    updateInstanceWindowStatus(sender: Electron.WebContents, payload: Record<string, any>): void {
        const matchingWindow = Array.from(this.instanceWindows.values()).find(window => {
            return !window.isDestroyed() && window.webContents.id === sender.id;
        });

        if (!matchingWindow) {
            return;
        }

        const username = String(payload.username || '').trim();
        const message = String(payload.message || '').trim();
        if (payload.isLoggedIn === true && username) {
            matchingWindow.setTitle(`SF Toolkit Desktop - ${username}`);
            return;
        }

        if (payload.isLoggedIn === false && message) {
            matchingWindow.setTitle(`SF Toolkit Desktop - ${message}`);
        }
    }

    private buildInstanceRendererUrl(payload: Record<string, any>): string {
        const url = new URL('/extension', this.rendererUrl);

        const alias = String(payload.alias || '').trim();
        const sessionId = String(payload.sessionId || '').trim();
        const serverUrl = String(payload.serverUrl || '').trim();
        const redirectUrl = String(payload.redirectUrl || '').trim();
        const sourceTabId = String(payload.sourceTabId || '').trim();
        const variant = String(payload.variant || '').trim();

        if (alias) {
            url.searchParams.set('alias', alias);
        }
        if (sessionId) {
            url.searchParams.set('sessionId', sessionId);
        }
        if (serverUrl) {
            url.searchParams.set('serverUrl', serverUrl);
        }
        if (redirectUrl) {
            url.searchParams.set('redirectUrl', redirectUrl);
        }
        if (sourceTabId) {
            url.searchParams.set('sourceTabId', sourceTabId);
        }
        if (variant) {
            url.searchParams.set('variant', variant);
        }

        return url.toString();
    }

    private formatInstanceTitle(payload: Record<string, any>): string {
        const alias = String(payload.alias || '').trim();
        const username = String(payload.username || '').trim();
        const titleSuffix = alias || username;

        return titleSuffix ? `SF Toolkit Desktop - ${titleSuffix}` : 'SF Toolkit Desktop';
    }

    private focusWindow(window: BrowserWindow): void {
        if (window.isMinimized()) {
            window.restore();
        }

        window.focus();
    }

    private getInstanceWindowKey(payload: Record<string, any>): string | null {
        const alias = String(payload.alias || '').trim();
        if (alias) {
            return alias;
        }

        const username = String(payload.username || '').trim();
        if (username) {
            return username;
        }

        const sessionId = String(payload.sessionId || '').trim();
        if (sessionId) {
            return `session:${sessionId}`;
        }

        return null;
    }
}
