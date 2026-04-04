import { LightningElement } from 'lwc';

export default class Vscode extends LightningElement {
    alias;
    sessionId;
    serverUrl;
    redirectUrl;
    sourceTabId;

    connectedCallback() {
        const params = new URLSearchParams(window.location.search);
        this.alias = params.get('alias');
        this.sessionId = params.get('sessionId');
        this.serverUrl = params.get('serverUrl');
        this.redirectUrl = params.get('redirectUrl');
        this.sourceTabId = params.get('sourceTabId');
    }
}
