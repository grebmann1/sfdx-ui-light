let currentConnectionProvider = null;

export function setCurrentConnectionProvider(provider) {
    currentConnectionProvider = typeof provider === 'function' ? provider : null;
}

export function hasCurrentConnectionProvider() {
    return typeof currentConnectionProvider === 'function';
}

export function getCurrentConnection() {
    if (!hasCurrentConnectionProvider()) {
        return null;
    }

    try {
        const connection = currentConnectionProvider();
        return connection && typeof connection === 'object' ? connection : null;
    } catch {
        return null;
    }
}

export function clearCurrentConnectionProvider(provider = null) {
    if (!provider || currentConnectionProvider === provider) {
        currentConnectionProvider = null;
    }
}
