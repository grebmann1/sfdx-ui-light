import { api, track, LightningElement } from 'lwc';
import { GOOGLE_SIGNIN_SCOPES, GOOGLE_DRIVE_SCOPES } from './constants.js';

const POPUP_WIDTH = 520;
const POPUP_HEIGHT = 620;
const POLL_INTERVAL_MS = 400;

// Injected at build time by Rollup for extension bundles.
// Rollup replaces `process.env.IS_CHROME` with `true` before this code runs in the browser.
// The try/catch is a safety net for the web app build where process may not be defined at all.
declare const process: { env: { IS_CHROME?: boolean; WORKBENCH_BASE_URL?: string } };

export type GoogleUser = {
    token: string;
    email: string;
    name: string;
    picture: string;
};

function isChromeExtensionContext(): boolean {
    try {
        // After Rollup replacement this becomes: return true === true
        return (process.env.IS_CHROME as unknown) === true;
    } catch {
        return false;
    }
}

export default class GoogleAuth extends LightningElement {
    /** Absolute server base URL (e.g. https://app.sf-toolkit.com).
     *  Required when the component runs inside the Chrome extension. */
    @api serverUrl: string = '';

    @track isLoading = false;
    @track isDriveLoading = false;
    @track errorMessage: string | null = null;

    private _popup: Window | null = null;
    private _pollInterval: ReturnType<typeof setInterval> | null = null;

    disconnectedCallback() {
        this._cleanup();
    }

    handleSignIn() {
        this.errorMessage = null;
        if (isChromeExtensionContext()) {
            void this._openExtensionAuth(GOOGLE_SIGNIN_SCOPES);
        } else {
            this._openWebPopup();
        }
    }

    /** Call this from a "Connect Google Drive / Sheets" button.
     *  Dispatches a `driveconnected` event with the raw Google access token
     *  that can be used directly against the Sheets and Drive APIs. */
    @api
    handleConnectDrive() {
        this.errorMessage = null;
        if (!isChromeExtensionContext()) {
            this.errorMessage = 'Google Drive connection is only supported in the extension.';
            return;
        }
        this.isDriveLoading = true;
        (chrome as any).identity.getAuthToken(
            { interactive: true, scopes: GOOGLE_DRIVE_SCOPES },
            (token: string | undefined) => {
                this.isDriveLoading = false;
                if ((chrome as any).runtime.lastError || !token) {
                    this.errorMessage =
                        (chrome as any).runtime.lastError?.message || 'Drive access was cancelled.';
                    return;
                }
                this.dispatchEvent(
                    new CustomEvent('driveconnected', { detail: { accessToken: token }, bubbles: true })
                );
            }
        );
    }

    // Chrome extension flow: chrome.identity.getAuthToken() lets Chrome handle the OAuth dance
    // using the manifest's client_id. No client secret or redirect URI needed.
    // The resulting Google access token is validated server-side to create a backend session.
    private async _openExtensionAuth(scopes: string[]) {
        const base = (this.serverUrl || '').replace(/\/+$/, '');
        if (!base) {
            this.errorMessage = 'Server URL is not configured for this build.';
            return;
        }

        this.isLoading = true;
        (chrome as any).identity.getAuthToken(
            { interactive: true, scopes },
            async (token: string | undefined) => {
                if ((chrome as any).runtime.lastError || !token) {
                    this.isLoading = false;
                    this.errorMessage =
                        (chrome as any).runtime.lastError?.message || 'Sign-in was cancelled.';
                    return;
                }
                await this._verifyTokenWithBackend(token, base);
            }
        );
    }

    private async _verifyTokenWithBackend(accessToken: string, base: string) {
        try {
            const resp = await fetch(`${base}/google/oauth/verify-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken }),
            });
            if (!resp.ok) {
                throw new Error(`Server returned ${resp.status}`);
            }
            const data = await resp.json();
            this.isLoading = false;
            this._dispatchAuthenticated(data.token, data.email, data.name, data.picture);
        } catch {
            this.isLoading = false;
            this.errorMessage = 'Sign-in failed. Please try again.';
        }
    }

    // Web app flow: opens a popup to the server-side OAuth redirect
    private _openWebPopup() {
        const left = Math.round(window.screenX + (window.outerWidth - POPUP_WIDTH) / 2);
        const top = Math.round(window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2);
        const features = `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`;

        const base = (this.serverUrl || '').replace(/\/+$/, '');
        const authUrl = `${base}/google/oauth/authorize`;
        const popup = window.open(authUrl, 'google-auth', features);

        if (!popup) {
            this.errorMessage = 'Popup was blocked. Please allow popups for this site and try again.';
            return;
        }

        this._popup = popup;
        this.isLoading = true;
        this._startPolling();
    }

    private _startPolling() {
        this._pollInterval = setInterval(() => {
            try {
                if (!this._popup || this._popup.closed) {
                    this._cleanup();
                    this.isLoading = false;
                    return;
                }

                // Try to read the hash once the popup navigates back to our /google/callback page
                const hash = this._popup.location.hash;
                if (hash && hash.includes('token=')) {
                    this._cleanup();
                    const p = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
                    const token = p.get('token');
                    if (!token) {
                        this.isLoading = false;
                        this.errorMessage = 'Sign-in failed. Please try again.';
                        return;
                    }
                    this.isLoading = false;
                    this._dispatchAuthenticated(token, p.get('email') || '', p.get('name') || '', p.get('picture') || '');
                }
            } catch {
                // Cross-origin access throws until the popup redirects back — ignore
            }
        }, POLL_INTERVAL_MS);
    }

    private _dispatchAuthenticated(token: string, email: string, name: string, picture: string) {
        this.dispatchEvent(
            new CustomEvent('authenticated', {
                detail: { token, email, name, picture } as GoogleUser,
                bubbles: true,
            })
        );
    }

    private _cleanup() {
        if (this._pollInterval !== null) {
            clearInterval(this._pollInterval);
            this._pollInterval = null;
        }
        if (this._popup && !this._popup.closed) {
            this._popup.close();
        }
        this._popup = null;
    }
}
