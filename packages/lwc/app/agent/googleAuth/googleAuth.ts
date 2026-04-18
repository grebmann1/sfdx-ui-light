import { api, track, LightningElement } from 'lwc';
import { GOOGLE_SIGNIN_SCOPES, GOOGLE_DRIVE_SCOPES } from './constants.js';

export { GOOGLE_SIGNIN_SCOPES, GOOGLE_DRIVE_SCOPES } from './constants.js';

export type GoogleUser = {
    token: string;
    email: string;
    name: string;
    picture: string;
};

export default class GoogleAuth extends LightningElement {
    /** Absolute server base URL (e.g. https://app.workbench-salesforce.com). */
    @api serverUrl: string = '';

    @track isLoading = false;
    @track isDriveLoading = false;
    @track errorMessage: string | null = null;

    handleSignIn() {
        this.errorMessage = null;
        void this._openExtensionAuth(GOOGLE_SIGNIN_SCOPES);
    }

    /** Dispatches a `driveconnected` event with the raw Google access token
     *  for use directly against the Sheets and Drive APIs. */
    @api
    handleConnectDrive() {
        this.errorMessage = null;
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

    // chrome.identity.getAuthToken() lets Chrome handle the OAuth dance using the manifest's
    // client_id. The resulting Google access token is validated server-side to create a session.
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
            if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
            const data = await resp.json();
            this.isLoading = false;
            this.dispatchEvent(
                new CustomEvent('authenticated', {
                    detail: { token: data.token, email: data.email, name: data.name, picture: data.picture } as GoogleUser,
                    bubbles: true,
                })
            );
        } catch {
            this.isLoading = false;
            this.errorMessage = 'Sign-in failed. Please try again.';
        }
    }
}
