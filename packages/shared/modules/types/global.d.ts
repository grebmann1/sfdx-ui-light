type ChromeStorageArea = {
    get: (keys: string[], callback: (result: Record<string, unknown>) => void) => void;
    remove: (key: string, callback: () => void) => void;
    set: (items: Record<string, unknown>, callback: () => void) => void;
};

declare const chrome: {
    runtime?: {
        getURL: (path: string) => string;
        id?: string;
    };
    storage: {
        local: ChromeStorageArea;
        sync: ChromeStorageArea;
    };
    tabs?: {
        query: (
            queryInfo: {
                active?: boolean;
                lastFocusedWindow?: boolean;
                currentWindow?: boolean;
            },
            callback?: (tabs: Array<{ id?: number }>) => void
        ) => Promise<Array<{ id?: number }>>;
        reload: (tabId?: number) => void;
    };
};

declare const browser: {
    runtime?: {
        id?: string;
    };
};

declare const process: {
    env?: Record<string, string | undefined>;
};

interface Window {
    desktop?: {
        getAppInfo: () => Promise<{
            appName: string;
            appVersion: string;
            isPackaged: boolean;
            platform: string;
            rendererUrl: string;
        }>;
        getLaunchIntent: () => Promise<{ target: 'app' } | { target: 'org'; orgAlias: string }>;
        onLaunchIntent: (
            listener: (intent: { target: 'app' } | { target: 'org'; orgAlias: string }) => void
        ) => () => void;
        checkCommands: () => Promise<{ sfdx: boolean; java: boolean }>;
        openInstance: (payload: Record<string, unknown>) => Promise<{ success: true }>;
        openOrgUrl: (payload: Record<string, unknown>) => Promise<{ success: true }>;
        setStoredOrg: (payload: Record<string, unknown>) => Promise<unknown>;
        getStoredOrg: (alias: string) => Promise<unknown>;
        getAllOrgs: () => Promise<unknown>;
        getCodeInitialConfig: (
            alias: string
        ) => Promise<{ projectPath: string | null; metadataLoaded: boolean }>;
        selectCodeProject: (payload: {
            alias: string;
            defaultPath?: string | null;
        }) => Promise<{ projectPath: string | null }>;
        openVSCodeProject: (projectPath: string | null) => Promise<{ success: true }>;
        getPmdInstallation: (projectPath: string | null) => Promise<{
            installationPath: string | null;
            executablePath: string | null;
        }>;
        installLatestPmd: (projectPath: string | null) => Promise<{
            installationPath: string | null;
            executablePath: string | null;
        }>;
        retrieveCode: (payload: Record<string, unknown>) => Promise<{
            runInWorker: boolean;
            res: unknown;
        }>;
        exportMetadata: (payload: Record<string, unknown>) => Promise<{ success: true }>;
        runShell: (payload: Record<string, unknown>) => Promise<{ success: true }>;
        runSfdxAnalyzer: (payload: Record<string, unknown>) => Promise<{ success: true }>;
        renameStoredOrg: (payload: {
            oldAlias: string;
            newAlias: string;
        }) => Promise<{ success: true }>;
        removeStoredOrg: (alias: string) => Promise<{ success: true }>;
        notifyLimitedModeStatus: (payload: Record<string, unknown>) => Promise<{ success: true }>;
    };
    electron?: {
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
        send?: (channel: string, ...args: unknown[]) => void;
        listener_on?: (channel: string, callback: (...args: unknown[]) => void) => void;
        listener_once?: (channel: string, callback: (...args: unknown[]) => void) => void;
        listener_off?: (channel: string) => void;
        setChannel?: (channel: string) => void;
        getChannel?: () => string | null;
    };
    monaco?: unknown;
    OpenAIAgentsBundle?: unknown;
    mermaid?: unknown;
    _monacoCompletionProviders?: Record<string, boolean>;
}

declare module 'papaparse';
