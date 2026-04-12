import { LightningElement } from 'lwc';
import { parseVscodeBootstrapSeed } from 'shared/utils';

export default class Vscode extends LightningElement {
    alias;
    sessionId;
    serverUrl;
    redirectUrl;
    sourceTabId;

    connectedCallback() {
        const seed = parseVscodeBootstrapSeed(window.location.search);
        this.alias = seed.alias;
        this.sessionId = seed.sessionId;
        this.serverUrl = seed.serverUrl;
        this.redirectUrl = seed.redirectUrl;
        this.sourceTabId = seed.sourceTabId;
    }
}
