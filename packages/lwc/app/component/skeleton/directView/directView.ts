import Toast from 'lightning/toast';
import { api, LightningElement } from 'lwc';
import { isUndefinedOrNull, isElectronApp } from 'shared/utils';

export default class directView extends LightningElement {
    @api variant = 'default';
    sessionId;
    serverUrl;
    redirectUrl;
    alias;
    sourceTabId;

    // For direct connection
    connector;

    connectedCallback() {
        if (isElectronApp()) {
            this.alias = this.getAlias();
            this.sessionId = this.getSessionId();
            this.serverUrl = this.getServerUrl();
            this.redirectUrl = this.getRedirectUrl();
            this.sourceTabId = this.getSourceTabId();
        } else {
            this.alias = this.getAlias();
            this.sessionId = this.getSessionId();
            this.serverUrl = this.getServerUrl();
            this.redirectUrl = this.getRedirectUrl();
            this.sourceTabId = this.getSourceTabId();
            const hasAliasBootstrap =
                typeof this.alias === 'string' && this.alias.trim().length > 0;
            const hasSessionBootstrap =
                !isUndefinedOrNull(this.sessionId) && !isUndefinedOrNull(this.serverUrl);
            if (!hasAliasBootstrap && !hasSessionBootstrap && isUndefinedOrNull(this.sourceTabId)) {
                this.sendError();
            }
        }
    }

    getSessionId = () => {
        return new URLSearchParams(window.location.search).get('sessionId');
    };

    getServerUrl = () => {
        return new URLSearchParams(window.location.search).get('serverUrl');
    };

    getRedirectUrl = () => {
        return new URLSearchParams(window.location.search).get('redirectUrl');
    };

    getAlias = () => {
        return new URLSearchParams(window.location.search).get('alias');
    };

    getSourceTabId = () => {
        return new URLSearchParams(window.location.search).get('sourceTabId');
    };

    get isVscodeVariant() {
        return String(this.variant || '').toLowerCase() === 'vscode';
    }

    sendError = () => {
        Toast.show({
            label: 'Session Error',
            message: 'Invalid Session',
            variant: 'error',
            mode: 'dismissible',
        });
    };
}
