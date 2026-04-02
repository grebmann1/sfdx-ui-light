import { isChromeExtension } from './env';

/**
 * Chrome extension specific utilities
 */

type RawOrg = {
    alias: string;
    value?: string;
    [key: string]: unknown;
};

type MappedOrg = RawOrg & {
    id: string;
    username: string;
    company: string;
    name: string;
};

export async function getAllOrgs(debugMode: boolean = false): Promise<MappedOrg[]> {
    if (debugMode) {
        return [
            {
                id: 'DEMO-B2C',
                username: 'DEMO-B2C@test.com',
                company: 'DEMO',
                name: 'B2C',
                alias: 'DEMO-B2C',
            },
        ];
    }
    const response = await window.electron?.invoke('org-getAllOrgs');
    const res = Array.isArray(response) ? (response as RawOrg[]) : [];
    const sorted = res.sort((a, b) => a.alias.localeCompare(b.alias));
    const mapped = sorted.map(item => {
        return {
            ...item,
            ...{
                id: item.alias,
                username: item.value ?? '',
                company: `${
                    item.alias.split('-').length > 1 ? item.alias.split('-').shift() : ''
                }`.toUpperCase(),
                name: item.alias.split('-').pop(),
            },
        };
    });
    return mapped;
}

type RedirectParams = {
    baseUrl: string;
    redirectUrl?: string;
    sessionId?: string;
    serverUrl?: string;
    isNewTab?: boolean;
};

const buildRedirectUrl = ({ baseUrl, redirectUrl, sessionId, serverUrl }: RedirectParams): string => {
    const params = new URLSearchParams();
    if (sessionId) {
        params.append('sessionId', sessionId);
        params.append('serverUrl', serverUrl || '');
    }

    if (redirectUrl) {
        params.append('redirectUrl', redirectUrl);
    }
    const url = new URL(baseUrl);
    url.search = params.toString();
    return url.href;
};

export const redirectToUrlViaChrome = ({
    baseUrl,
    redirectUrl,
    sessionId,
    serverUrl,
    isNewTab,
}: RedirectParams): void => {
    const url = buildRedirectUrl({ baseUrl, redirectUrl, sessionId, serverUrl });
    if (isNewTab) {
        window.open(url, '_blank');
    } else {
        window.open(url);
    }
};

type VscodeEditorUrlParams = Pick<RedirectParams, 'sessionId' | 'serverUrl'>;

export const getVscodeEditorUrl = ({ sessionId, serverUrl }: VscodeEditorUrlParams): string => {
    const baseUrl =
        typeof chrome !== 'undefined' && typeof chrome.runtime?.getURL === 'function'
            ? chrome.runtime.getURL('/views/vscode.html')
            : '/views/vscode.html';
    return buildRedirectUrl({ baseUrl, sessionId, serverUrl });
};

type ChromeTab = {
    id?: number;
};

export async function getCurrentTab(): Promise<ChromeTab | null> {
    if (!isChromeExtension() || !chrome.tabs?.query) return null;
    let queryOptions = { active: true, lastFocusedWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

export const refreshCurrentTab = (): void => {
    if (!isChromeExtension() || !chrome.tabs?.query || !chrome.tabs?.reload) return;

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.reload(tabs[0]?.id);
    });
};
