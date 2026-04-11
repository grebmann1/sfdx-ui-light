"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
let legacyChannel = null;
const desktopApi = {
    getAppInfo: () => electron_1.ipcRenderer.invoke('desktop:get-app-info'),
    getLaunchIntent: () => electron_1.ipcRenderer.invoke('desktop:get-launch-intent'),
    onLaunchIntent: (listener) => {
        const wrappedListener = (_event, intent) => {
            listener(intent);
        };
        electron_1.ipcRenderer.on('desktop:launch-intent', wrappedListener);
        return () => {
            electron_1.ipcRenderer.removeListener('desktop:launch-intent', wrappedListener);
        };
    },
    checkCommands: () => electron_1.ipcRenderer.invoke('desktop:check-commands'),
    openInstance: (payload) => electron_1.ipcRenderer.invoke('desktop:open-instance', payload),
    openOrgUrl: (payload) => electron_1.ipcRenderer.invoke('desktop:open-org-url', payload),
    setStoredOrg: (payload) => electron_1.ipcRenderer.invoke('desktop:set-stored-org', payload),
    getStoredOrg: (alias) => electron_1.ipcRenderer.invoke('desktop:get-stored-org', alias),
    getAllOrgs: () => electron_1.ipcRenderer.invoke('desktop:get-all-orgs'),
    getCodeInitialConfig: (alias) => electron_1.ipcRenderer.invoke('desktop:get-code-initial-config', alias),
    selectCodeProject: (payload) => electron_1.ipcRenderer.invoke('desktop:select-code-project', payload),
    openVSCodeProject: (projectPath) => electron_1.ipcRenderer.invoke('desktop:open-vscode-project', projectPath),
    getPmdInstallation: (projectPath) => electron_1.ipcRenderer.invoke('desktop:get-pmd-installation', projectPath),
    installLatestPmd: (projectPath) => electron_1.ipcRenderer.invoke('desktop:install-latest-pmd', projectPath),
    retrieveCode: (payload) => electron_1.ipcRenderer.invoke('desktop:retrieve-code', payload),
    exportMetadata: (payload) => electron_1.ipcRenderer.invoke('desktop:export-metadata', payload),
    runShell: (payload) => electron_1.ipcRenderer.invoke('desktop:run-shell', payload),
    runSfdxAnalyzer: (payload) => electron_1.ipcRenderer.invoke('desktop:run-sfdx-analyzer', payload),
    renameStoredOrg: (payload) => electron_1.ipcRenderer.invoke('desktop:rename-stored-org', payload),
    removeStoredOrg: (alias) => electron_1.ipcRenderer.invoke('desktop:remove-stored-org', alias),
    notifyLimitedModeStatus: (payload) => electron_1.ipcRenderer.invoke('desktop:notify-limited-mode-status', payload),
};
electron_1.contextBridge.exposeInMainWorld('desktop', desktopApi);
electron_1.contextBridge.exposeInMainWorld('electron', {
    invoke: (channel, args) => electron_1.ipcRenderer.invoke('desktop:invoke-legacy', { channel, args }),
    send: (channel, args) => {
        electron_1.ipcRenderer.send('desktop:send-legacy', { channel, args });
    },
    listener_on: (channel, callback) => {
        electron_1.ipcRenderer.on(`desktop:legacy:${channel}`, (_event, ...args) => callback(...args));
    },
    listener_once: (channel, callback) => {
        electron_1.ipcRenderer.once(`desktop:legacy:${channel}`, (_event, ...args) => callback(...args));
    },
    listener_off: (channel) => {
        electron_1.ipcRenderer.removeAllListeners(`desktop:legacy:${channel}`);
    },
    setChannel: (channel) => {
        legacyChannel = channel;
    },
    getChannel: () => legacyChannel,
});
