import Toast from 'lightning/toast';
import { api, LightningElement } from 'lwc';
import {
    hasVscodeExplicitBootstrap,
    hasVscodeBootstrapEntrySeed,
    isElectronApp,
    parseVscodeBootstrapSeed,
} from 'shared/utils';

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
        const seed = this.getBootstrapSeed();
        this.alias = seed.alias;
        this.sessionId = seed.sessionId;
        this.serverUrl = seed.serverUrl;
        this.redirectUrl = seed.redirectUrl;
        this.sourceTabId = seed.sourceTabId;

        const hasValidBootstrapSeed = this.isVscodeVariant
            ? hasVscodeBootstrapEntrySeed(seed)
            : hasVscodeExplicitBootstrap(seed);
        if (!isElectronApp() && !hasValidBootstrapSeed) {
            this.sendError();
        }
    }

    getBootstrapSeed = () => {
        return parseVscodeBootstrapSeed(window.location.search);
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
