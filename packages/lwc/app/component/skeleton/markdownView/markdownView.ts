import Toast from 'lightning/toast';
import { LightningElement } from 'lwc';
import { isUndefinedOrNull, isElectronApp } from 'shared/utils';

export default class MarkdowView extends LightningElement {
    body = 'Hello the world';
    version;

    connectedCallback() {
        this.loadVersion();
    }

    /** Methods **/

    loadVersion = async () => {
        const data = await (await fetch('/version')).json();
        this.version = `v${data.version || '1.0.0'}`;
    };

    getDocumentId = () => {
        return new URLSearchParams(window.location.search).get('documentId');
    };

    sendError = () => {
        Toast.show({
            label: 'Session Error',
            message: 'Invalid Session',
            variant: 'error',
            mode: 'dismissible',
        });
    };
}
