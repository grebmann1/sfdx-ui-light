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
    electron?: {
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    };
    monaco?: unknown;
    OpenAIAgentsBundle?: unknown;
    mermaid?: unknown;
    _monacoCompletionProviders?: Record<string, boolean>;
}

declare module 'papaparse';
