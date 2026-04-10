export function truncateText(text: unknown, maxChars: number) {
    const value = typeof text === 'string' ? text : String(text ?? '');
    if (value.length <= maxChars) {
        return value;
    }
    return `${value.slice(0, maxChars)}\n\n[Truncated ${value.length - maxChars} chars]`;
}

export function stringifyUri(uri: unknown) {
    if (!uri) return '';
    const candidate = uri as {
        fsPath?: string;
        path?: string;
        toString?: () => string;
    };
    return candidate.fsPath || candidate.path || candidate.toString?.() || String(uri);
}
