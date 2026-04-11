import * as Session from './credentialStrategies/session';

type ChromeRuntimeMessage = {
    action: string;
    alias?: string;
    instanceUrl?: string;
    sourceTabId?: number;
    tabId?: number;
};

function getChromeRuntime() {
    return (
        window as Window & {
            chrome?: {
                runtime?: {
                    sendMessage?: (
                        message: ChromeRuntimeMessage,
                        callback?: (response?: unknown) => void
                    ) => void;
                };
            };
        }
    ).chrome?.runtime;
}

export function hasChromeBackgroundMessaging() {
    return typeof getChromeRuntime()?.sendMessage === 'function';
}

export async function sendBackgroundSessionMessage(message: ChromeRuntimeMessage) {
    const runtime = getChromeRuntime();
    const sendMessage =
        runtime && typeof runtime.sendMessage === 'function'
            ? runtime.sendMessage.bind(runtime)
            : null;
    if (!sendMessage) {
        return undefined;
    }
    return await new Promise(resolve => {
        try {
            sendMessage(message, response => resolve(response));
        } catch {
            resolve(undefined);
        }
    });
}

export async function findExistingSessionViaBackground({
    alias,
    instanceUrl,
}: {
    alias?: string;
    instanceUrl?: string;
} = {}) {
    const result = (await sendBackgroundSessionMessage({
        action: 'findExistingSession',
        alias,
        instanceUrl,
    })) as
        | {
              sessionId?: string;
              serverUrl?: string;
              error?: string;
          }
        | undefined;
    return result;
}

export async function fetchCookieForTabIdViaBackground(tabId: number) {
    return (await sendBackgroundSessionMessage({
        action: 'fetchCookieForTabId',
        tabId,
    })) as
        | {
              sessionId?: string;
              serverUrl?: string;
              error?: string;
          }
        | undefined;
}

export async function requestTabsPermissionViaBackground() {
    return (await sendBackgroundSessionMessage({
        action: 'requestTabsPermission',
    })) as
        | {
              granted?: boolean;
              error?: string;
          }
        | undefined;
}

export async function listOrgSessionsViaBackground() {
    return (await sendBackgroundSessionMessage({
        action: 'listOrgSessions',
    })) as
        | Array<{
              sessionId?: string;
              serverUrl?: string;
              label?: string;
              detail?: string;
          }>
        | {
              error?: string;
          }
        | undefined;
}

export async function connectSessionFromBackgroundResult({
    sessionId,
    serverUrl,
}: {
    sessionId?: string;
    serverUrl?: string;
}) {
    if (!sessionId || !serverUrl) {
        return null;
    }
    return await Session.connect({
        sessionId,
        serverUrl,
    });
}
