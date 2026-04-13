import {
    bootstrapIframeBridge,
    getIframeBridgeWorkspaceRoot,
    isIframeFsBridgeEnabled,
} from './bootstrapIframeBridge';
import { IframeFsBridgeClient } from './iframeFsBridgeClient';
import { createIframeWorkspaceProvider } from './iframeWorkspaceProvider';

type RegisterIframeWorkspaceProviderOptions = {
    vscode: any;
    registerFileSystemOverlay: (priority: number, provider: any) => { dispose?: () => void } | void;
    priority?: number;
    workspaceRoot?: string;
    requestTimeoutMs?: number;
    locationHref?: string;
};

export async function registerIframeWorkspaceProvider(
    options: RegisterIframeWorkspaceProviderOptions
) {
    const {
        vscode,
        registerFileSystemOverlay,
        priority = 1,
        workspaceRoot,
        requestTimeoutMs,
        locationHref,
    } = options || {};

    if (!vscode || typeof registerFileSystemOverlay !== 'function') {
        throw new Error(
            'registerIframeWorkspaceProvider requires both vscode and registerFileSystemOverlay.'
        );
    }
    if (!isIframeFsBridgeEnabled(locationHref)) {
        return null;
    }

    const port = await bootstrapIframeBridge({ timeoutMs: requestTimeoutMs });
    const client = new IframeFsBridgeClient(port, { requestTimeoutMs });
    const effectiveWorkspaceRoot = workspaceRoot || getIframeBridgeWorkspaceRoot();
    const provider = createIframeWorkspaceProvider({
        client,
        vscode,
        workspaceRoot: effectiveWorkspaceRoot,
    });
    const overlayDisposable = registerFileSystemOverlay(priority, provider);

    return {
        client,
        provider,
        overlayDisposable,
        workspaceRoot: effectiveWorkspaceRoot,
        dispose() {
            try {
                if (overlayDisposable && typeof overlayDisposable === 'object') {
                    const disposable = overlayDisposable as { dispose?: () => void };
                    disposable.dispose?.();
                }
            } catch {
                // ignore
            }
            try {
                provider?.dispose?.();
            } catch {
                // ignore
            }
            client.dispose();
        },
    };
}
