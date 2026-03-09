import { LightningElement } from 'lwc';

/**
 * OAuth callback page (loaded in popup after server redirect to /callback#...).
 * Runs jsforce handleCallbackResponse() so tokens are stored and the popup closes.
 * Must use the same prefix/state as the opener so the opener finds the tokens.
 */
export default class Callback extends LightningElement {
    connectedCallback() {
        if (typeof window === 'undefined' || !window.jsforce) return;
        const hash = window.location.hash?.substring(1);
        const stateFromStorage =
            typeof localStorage !== 'undefined' ? localStorage.getItem('jsforce_state') : null;
        if (hash && stateFromStorage) {
            const params = new URLSearchParams(hash);
            const stateFromHash = params.get('state');
            if (params.get('access_token') && stateFromHash === stateFromStorage) {
                const prefix = stateFromStorage.split('.')[0];
                const refreshToken = params.get('refresh_token');
                if (refreshToken && prefix) {
                    try {
                        localStorage.setItem(`${prefix}_refresh_token`, refreshToken);
                    } catch (e) {
                        // ignore
                    }
                }
            }
        }
        window.jsforce.browserClient = new window.jsforce.BrowserClient();
        window.jsforce.browserClient.init(window.jsforceSettings || {});
    }
}
