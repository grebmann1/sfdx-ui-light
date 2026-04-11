import { contextBridge, ipcRenderer } from 'electron';

type DesktopLaunchIntent =
    | {
          target: 'app';
      }
    | {
          target: 'org';
          orgAlias: string;
      };

type DesktopAppInfo = {
    appName: string;
    appVersion: string;
    isPackaged: boolean;
    platform: NodeJS.Platform;
    rendererUrl: string;
};

type LaunchIntentListener = (intent: DesktopLaunchIntent) => void;
type LegacyListener = (...args: any[]) => void;

let legacyChannel: string | null = null;

const desktopApi = {
    getAppInfo: (): Promise<DesktopAppInfo> => ipcRenderer.invoke('desktop:get-app-info'),
    getLaunchIntent: (): Promise<DesktopLaunchIntent> =>
        ipcRenderer.invoke('desktop:get-launch-intent'),
    onLaunchIntent: (listener: LaunchIntentListener): (() => void) => {
        const wrappedListener = (
            _event: Electron.IpcRendererEvent,
            intent: DesktopLaunchIntent
        ) => {
            listener(intent);
        };

        ipcRenderer.on('desktop:launch-intent', wrappedListener);

        return () => {
            ipcRenderer.removeListener('desktop:launch-intent', wrappedListener);
        };
    },
    checkCommands: (): Promise<{ sfdx: boolean; java: boolean }> =>
        ipcRenderer.invoke('desktop:check-commands'),
    openInstance: (payload: Record<string, any>): Promise<{ success: true }> =>
        ipcRenderer.invoke('desktop:open-instance', payload),
    openOrgUrl: (payload: Record<string, any>): Promise<{ success: true }> =>
        ipcRenderer.invoke('desktop:open-org-url', payload),
    setStoredOrg: (payload: Record<string, any>): Promise<any> =>
        ipcRenderer.invoke('desktop:set-stored-org', payload),
    getStoredOrg: (alias: string): Promise<any> =>
        ipcRenderer.invoke('desktop:get-stored-org', alias),
    getAllOrgs: (): Promise<any> => ipcRenderer.invoke('desktop:get-all-orgs'),
    getCodeInitialConfig: (
        alias: string
    ): Promise<{ projectPath: string | null; metadataLoaded: boolean }> =>
        ipcRenderer.invoke('desktop:get-code-initial-config', alias),
    selectCodeProject: (payload: {
        alias: string;
        defaultPath?: string | null;
    }): Promise<{ projectPath: string | null }> =>
        ipcRenderer.invoke('desktop:select-code-project', payload),
    openVSCodeProject: (projectPath: string | null): Promise<{ success: true }> =>
        ipcRenderer.invoke('desktop:open-vscode-project', projectPath),
    getPmdInstallation: (
        projectPath: string | null
    ): Promise<{
        installationPath: string | null;
        executablePath: string | null;
    }> => ipcRenderer.invoke('desktop:get-pmd-installation', projectPath),
    installLatestPmd: (
        projectPath: string | null
    ): Promise<{
        installationPath: string | null;
        executablePath: string | null;
    }> => ipcRenderer.invoke('desktop:install-latest-pmd', projectPath),
    retrieveCode: (payload: Record<string, any>): Promise<{ runInWorker: boolean; res: unknown }> =>
        ipcRenderer.invoke('desktop:retrieve-code', payload),
    exportMetadata: (payload: Record<string, any>): Promise<{ success: true }> =>
        ipcRenderer.invoke('desktop:export-metadata', payload),
    runShell: (payload: Record<string, any>): Promise<{ success: true }> =>
        ipcRenderer.invoke('desktop:run-shell', payload),
    runSfdxAnalyzer: (payload: Record<string, any>): Promise<{ success: true }> =>
        ipcRenderer.invoke('desktop:run-sfdx-analyzer', payload),
    renameStoredOrg: (payload: {
        oldAlias: string;
        newAlias: string;
    }): Promise<{ success: true }> => ipcRenderer.invoke('desktop:rename-stored-org', payload),
    removeStoredOrg: (alias: string): Promise<{ success: true }> =>
        ipcRenderer.invoke('desktop:remove-stored-org', alias),
    notifyLimitedModeStatus: (payload: Record<string, any>): Promise<{ success: true }> =>
        ipcRenderer.invoke('desktop:notify-limited-mode-status', payload),
};

contextBridge.exposeInMainWorld('desktop', desktopApi);

contextBridge.exposeInMainWorld('electron', {
    invoke: (channel: string, args?: Record<string, any>): Promise<unknown> =>
        ipcRenderer.invoke('desktop:invoke-legacy', { channel, args }),
    send: (channel: string, args?: Record<string, any>): void => {
        ipcRenderer.send('desktop:send-legacy', { channel, args });
    },
    listener_on: (channel: string, callback: LegacyListener): void => {
        ipcRenderer.on(`desktop:legacy:${channel}`, (_event, ...args) => callback(...args));
    },
    listener_once: (channel: string, callback: LegacyListener): void => {
        ipcRenderer.once(`desktop:legacy:${channel}`, (_event, ...args) => callback(...args));
    },
    listener_off: (channel: string): void => {
        ipcRenderer.removeAllListeners(`desktop:legacy:${channel}`);
    },
    setChannel: (channel: string): void => {
        legacyChannel = channel;
    },
    getChannel: (): string | null => legacyChannel,
});
