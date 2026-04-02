import { LightningElement } from 'lwc';
import { isElectronApp } from 'shared/utils';

export default class FullView extends LightningElement {
    sessionId;
    serverUrl;
    redirectUrl;
    alias;

    // For direct connection
    connector;

    connectedCallback() {
        // LWR Static Site Generation can render this component in a Node context (no `window`).
        // Avoid accessing browser globals during SSR/SSG.
        if (typeof window === 'undefined') {
            return;
        }

        if (isElectronApp()) {
            this.alias = this.getAlias();
        } else {
            this.sessionId = this.getSessionId();
            this.serverUrl = this.getServerUrl();
            this.redirectUrl = this.getRedirectUrl();
        }
    }

    getSessionId = () => {
        if (typeof window === 'undefined') return null;
        return new URLSearchParams(window.location.search).get('sessionId');
    };

    getServerUrl = () => {
        if (typeof window === 'undefined') return null;
        return new URLSearchParams(window.location.search).get('serverUrl');
    };

    getRedirectUrl = () => {
        if (typeof window === 'undefined') return null;
        return new URLSearchParams(window.location.search).get('redirectUrl');
    };

    getAlias = () => {
        if (typeof window === 'undefined') return null;
        return new URLSearchParams(window.location.search).get('alias');
    };
}
