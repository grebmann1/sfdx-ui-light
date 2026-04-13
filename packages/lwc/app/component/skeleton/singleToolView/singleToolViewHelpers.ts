const DEFAULT_TOOL_PATH = 'api';

export function parseSingleToolBootstrapSeed(search = '') {
    const params = new URLSearchParams(String(search || ''));
    const applicationName = String(params.get('applicationName') || '')
        .trim()
        .toLowerCase();
    return {
        applicationName: applicationName || DEFAULT_TOOL_PATH,
        alias: params.get('alias'),
        redirectUrl: params.get('redirectUrl'),
        serverUrl: params.get('serverUrl'),
        sessionId: params.get('sessionId'),
    };
}
