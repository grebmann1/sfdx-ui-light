export function buildOrgOpenUrl(payload: Record<string, any>): string | null {
    if (typeof payload.redirectUrl === 'string' && payload.redirectUrl.trim()) {
        return payload.redirectUrl;
    }

    const serverUrl =
        typeof payload.serverUrl === 'string' && payload.serverUrl.trim()
            ? payload.serverUrl
            : typeof payload.instanceUrl === 'string' && payload.instanceUrl.trim()
              ? payload.instanceUrl
              : null;

    if (!serverUrl) {
        return null;
    }

    if (typeof payload.sessionId === 'string' && payload.sessionId.trim()) {
        return `${serverUrl}/secur/frontdoor.jsp?sid=${encodeURIComponent(payload.sessionId)}`;
    }

    return serverUrl;
}
