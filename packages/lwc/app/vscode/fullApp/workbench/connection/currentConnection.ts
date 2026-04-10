type ConnectionProvider = () => unknown;

let currentConnectionProvider: ConnectionProvider | null = null;

export function setCurrentConnectionProvider(provider: unknown) {
    currentConnectionProvider =
        typeof provider === 'function' ? (provider as ConnectionProvider) : null;
}

export function hasCurrentConnectionProvider() {
    return typeof currentConnectionProvider === 'function';
}

export function getCurrentConnection(): Record<string, unknown> | null {
    if (!hasCurrentConnectionProvider()) {
        return null;
    }

    try {
        const connection = currentConnectionProvider?.();
        return connection && typeof connection === 'object'
            ? (connection as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
}

export function clearCurrentConnectionProvider(provider: ConnectionProvider | null = null) {
    if (!provider || currentConnectionProvider === provider) {
        currentConnectionProvider = null;
    }
}
