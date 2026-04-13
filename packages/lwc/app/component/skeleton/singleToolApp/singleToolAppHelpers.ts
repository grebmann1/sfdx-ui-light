export const DEFAULT_TOOL_PATH = 'api';
export const ALLOWED_SINGLE_TOOL_PATHS = new Set([DEFAULT_TOOL_PATH]);

export function normalizeSingleToolPath(value) {
    const normalized = String(value || '')
        .trim()
        .toLowerCase();
    return normalized || DEFAULT_TOOL_PATH;
}

export function getRequestedPathFromPage(pageRef) {
    const name = pageRef?.state?.applicationName;
    return normalizeSingleToolPath(name);
}

export function resolveSingleToolConfig(
    requestedPath,
    appList,
    allowedPaths = ALLOWED_SINGLE_TOOL_PATHS
) {
    const normalizedPath = normalizeSingleToolPath(requestedPath);
    if (!allowedPaths.has(normalizedPath)) {
        return null;
    }
    return appList.find(app => app.path === normalizedPath) || null;
}

export function buildPageRefForPath(path) {
    return {
        type: 'application',
        state: {
            applicationName: normalizeSingleToolPath(path),
        },
    };
}
