export function normalizeInstanceUrl(instanceUrl: unknown): string {
    const raw = String(instanceUrl ?? '').trim();
    if (!raw) {
        return '';
    }
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return withScheme.replace(/\/+$/, '');
}

export function normalizeProxyUrl(proxyUrl: unknown): string {
    const raw = String(proxyUrl ?? '').trim();
    if (!raw) {
        return '';
    }
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    return withScheme.replace(/\/+$/, '');
}

export function normalizeApiVersion(apiVersion: unknown, fallback = '63.0'): string {
    const value = String(apiVersion ?? '').trim();
    return value || String(fallback || '63.0').trim() || '63.0';
}

export function toSalesforcePath(urlOrPath: unknown, instanceUrl: string): string {
    const raw = String(urlOrPath ?? '');
    if (/^https?:\/\//i.test(raw)) {
        try {
            const absoluteUrl = new URL(raw);
            const connectionUrl = new URL(instanceUrl);
            if (absoluteUrl.origin === connectionUrl.origin) {
                return `${absoluteUrl.pathname}${absoluteUrl.search}${absoluteUrl.hash}`;
            }
        } catch {
            // ignore URL parsing errors
        }
        throw new Error('Absolute URLs are not supported.');
    }
    if (raw.startsWith('/')) {
        return raw;
    }
    return `${raw.startsWith('?') ? '' : '/'}${raw}`;
}
