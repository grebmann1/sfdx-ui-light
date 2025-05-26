import LightningAlert from 'lightning/alert';
import { LightningElement } from 'lwc';
import { isUndefinedOrNull, isElectronApp } from 'shared/utils';

export default class directView extends LightningElement {
    sessionId;
    serverUrl;
    redirectUrl;
    alias;

    // For direct connection
    connector;

    connectedCallback() {
        if (isElectronApp()) {
            this.alias = this.getAlias();
        } else {
            this.sessionId = this.getSessionId();
            this.serverUrl = this.getServerUrl();
            this.redirectUrl = this.getRedirectUrl();
            if (isUndefinedOrNull(this.sessionId) || isUndefinedOrNull(this.serverUrl)) {
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

    sendError = () => {
        LightningAlert.open({
            message: 'Invalid Session',
            theme: 'error', // a red theme intended for error states
            label: 'Error!', // this is the header text
        });
    };
}
