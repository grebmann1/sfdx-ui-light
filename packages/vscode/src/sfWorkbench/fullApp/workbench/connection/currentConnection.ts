type ConnectionContextProvider = () => unknown;

let currentConnectionProvider: ConnectionContextProvider | null = null;

export function shareCurrentConnectionContext(provider: unknown) {
    currentConnectionProvider =
        typeof provider === 'function' ? (provider as ConnectionContextProvider) : null;
}

export function hasCurrentConnectionContextProvider() {
    return typeof currentConnectionProvider === 'function';
}

export function getCurrentConnectionContext(): Record<string, unknown> | null {
    if (!hasCurrentConnectionContextProvider()) {
        return null;
    }

    try {
        const context = currentConnectionProvider?.();
        return context && typeof context === 'object' ? (context as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

export function clearSharedCurrentConnectionContext(
    provider: ConnectionContextProvider | null = null
) {
    if (!provider || currentConnectionProvider === provider) {
        currentConnectionProvider = null;
    }
}

export const setCurrentConnectionProvider = shareCurrentConnectionContext;
export const hasCurrentConnectionProvider = hasCurrentConnectionContextProvider;
export const getCurrentConnection = getCurrentConnectionContext;
export const clearCurrentConnectionProvider = clearSharedCurrentConnectionContext;
