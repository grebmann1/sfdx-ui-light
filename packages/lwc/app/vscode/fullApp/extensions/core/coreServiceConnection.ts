export type ConnectionCoreService = {
    runtime?: {
        [key: string]: unknown;
        getInjectedConnectionRequiredMessage?: () => string;
        loadLiveConnection?: () => unknown;
        loadStoredConn?: () => unknown;
        withToolingClientAuthed?: (
            conn: unknown,
            fn: (...args: unknown[]) => unknown
        ) => Promise<unknown>;
    };
    loadLive?: () => unknown;
    loadStored?: () => unknown;
    withToolingClientAuthed?: (
        conn: unknown,
        fn: (...args: unknown[]) => unknown
    ) => Promise<unknown>;
};

export type ApiCoreService = {
    withToolingClientAuthed?: (
        conn: unknown,
        fn: (...args: unknown[]) => unknown
    ) => Promise<unknown>;
};

export function buildConnectionCoreService(host: {
    [key: string]: unknown;
}): ConnectionCoreService {
    const runtime = (host.connectionRuntime || {}) as ConnectionCoreService['runtime'];
    return {
        runtime,
        loadLive: () => runtime?.loadLiveConnection?.(),
        loadStored: () => runtime?.loadStoredConn?.(),
        withToolingClientAuthed: runtime?.withToolingClientAuthed,
    };
}

export function buildApiCoreService(host: { [key: string]: unknown }): ApiCoreService {
    const runtime = (host.connectionRuntime || {}) as ConnectionCoreService['runtime'];
    return {
        withToolingClientAuthed: runtime?.withToolingClientAuthed,
    };
}
