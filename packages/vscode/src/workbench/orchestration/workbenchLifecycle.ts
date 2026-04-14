// @ts-nocheck
import * as vscode from 'vscode';
import { zipSync } from 'fflate';
import { DARK_COLOR_THEME, LIGHT_COLOR_THEME } from '../constants';
import type { CoreServices } from '../extensions/core/coreServices';

type BridgeConnection = {
    refreshStatus: () => Promise<void>;
    onHostEvent: (handler: (event: { eventName?: unknown; payload?: Record<string, unknown> | null }) => void) => { dispose(): void };
};

function asString(value: unknown): string {
    return String(value ?? '').trim();
}

function asLowerString(value: unknown): string {
    return asString(value).toLowerCase();
}

async function applyWorkbenchThemeMode(themeMode: 'light' | 'dark'): Promise<void> {
    const targetTheme = themeMode === 'dark' ? DARK_COLOR_THEME : LIGHT_COLOR_THEME;
    const workbenchConfig = vscode.workspace?.getConfiguration?.('workbench');
    if (typeof workbenchConfig?.update !== 'function') {
        return;
    }
    try {
        await workbenchConfig.update('colorTheme', targetTheme, true);
    } catch {
        try {
            await workbenchConfig.update('colorTheme', targetTheme);
        } catch {
            // ignore
        }
    }
}

function refreshRuntimeStatus(coreServices: CoreServices): void {
    const runtime = (coreServices?.connection?.runtime as Record<string, unknown>) || null;
    if (!runtime) {
        return;
    }
    const { loadStoredConn, setStatus } = runtime as Record<string, unknown>;
    if (typeof loadStoredConn !== 'function' || typeof setStatus !== 'function') {
        return;
    }
    try {
        (setStatus as Function)((loadStoredConn as Function)());
    } catch {
        // ignore
    }
}

async function refreshSchemaCacheFromHostEvent(coreServices: CoreServices): Promise<void> {
    const schemaTools = (coreServices?.operations?.schemaTools as Record<string, unknown>) || null;
    const runtime = (coreServices?.connection?.runtime as Record<string, unknown>) || null;
    const ensureGlobalDescribe = schemaTools?.ensureGlobalDescribe;
    const loadStoredConn = runtime?.loadStoredConn;
    if (typeof ensureGlobalDescribe !== 'function' || typeof loadStoredConn !== 'function') {
        return;
    }
    try {
        await (ensureGlobalDescribe as Function)((loadStoredConn as Function)(), { force: true });
        refreshRuntimeStatus(coreServices);
    } catch {
        // ignore
    }
}

async function collectWorkspaceFiles(
    vscodeApi: any,
    dirUri: any,
    rootPath: string,
    filesMap: Record<string, Uint8Array>
): Promise<void> {
    let entries: [string, number][];
    try {
        entries = await vscodeApi.workspace.fs.readDirectory(dirUri);
    } catch {
        return;
    }
    for (const [name, type] of entries) {
        const childUri = vscodeApi.Uri.joinPath(dirUri, name);
        if (type === 2 /* Directory */) {
            // eslint-disable-next-line no-await-in-loop
            await collectWorkspaceFiles(vscodeApi, childUri, rootPath, filesMap);
        } else if (type === 1 /* File */) {
            const filePath: string = childUri.path;
            if (filePath.includes('/.salesforce/') || filePath.includes('/.vscode/')) {
                continue;
            }
            try {
                // eslint-disable-next-line no-await-in-loop
                const bytes = await vscodeApi.workspace.fs.readFile(childUri);
                const relativePath = filePath.startsWith(`${rootPath}/`)
                    ? filePath.slice(rootPath.length + 1)
                    : filePath.slice(rootPath.length);
                if (relativePath) {
                    filesMap[relativePath] =
                        bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
                }
            } catch {
                // skip unreadable files
            }
        }
    }
}

async function downloadWorkspaceAsZip(): Promise<void> {
    const folders = vscode.workspace?.workspaceFolders;
    const workspaceFolder = Array.isArray(folders) && folders.length ? folders[0] : null;
    const rootUri = workspaceFolder?.uri ?? vscode.Uri.file('/workspace');
    const rootPath: string = rootUri.path;
    const workspaceName = String(workspaceFolder?.name || 'workspace').replace(/[^a-z0-9_.-]/gi, '_');

    const filesMap: Record<string, Uint8Array> = {};
    await collectWorkspaceFiles(vscode, rootUri, rootPath, filesMap);

    if (Object.keys(filesMap).length === 0) {
        return;
    }

    const zipBytes = zipSync(filesMap);
    const filename = `${workspaceName}.zip`;

    const blob = new Blob([zipBytes], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Subscribes to bridge host events (connection state, theme, banner actions) and
 * applies the appropriate runtime reactions. Returns a disposable that unsubscribes.
 */
export function registerWorkbenchRuntimeEvents(
    bridgeConnection: BridgeConnection,
    coreServices: CoreServices
): { dispose(): void } {
    const handleBridgeHostEvent = async (event: {
        eventName?: unknown;
        payload?: Record<string, unknown> | null;
    }) => {
        const eventName = asLowerString(event?.eventName);
        const payload =
            event?.payload && typeof event.payload === 'object'
                ? (event.payload as Record<string, unknown>)
                : null;

        if (eventName === 'connection.state') {
            refreshRuntimeStatus(coreServices);
            return;
        }

        if (eventName === 'theme.mode' && payload) {
            const themeMode = asLowerString(payload.themeMode);
            if (themeMode === 'dark' || themeMode === 'light') {
                await applyWorkbenchThemeMode(themeMode);
            }
            return;
        }

        if (eventName === 'workspace.download') {
            await downloadWorkspaceAsZip();
            return;
        }

        if (eventName !== 'banner.action' || !payload) {
            return;
        }

        const action = asLowerString(payload.action);
        const status = asLowerString(payload.status);

        if (
            (action === 'reconnectmanually' || action === 'importbrowserorg') &&
            (status === 'completed' || status === 'failed' || status === 'cancelled')
        ) {
            await bridgeConnection.refreshStatus();
            refreshRuntimeStatus(coreServices);
            return;
        }

        if (action === 'refreshsalesforcemetadata' && status === 'completed') {
            await refreshSchemaCacheFromHostEvent(coreServices);
        }
    };

    return bridgeConnection.onHostEvent(event => {
        void handleBridgeHostEvent(event);
    });
}
