import { LightningElement } from 'lwc';

export default class installPage extends LightningElement {
    redirect_url = '/app';

    connectedCallback() {
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get('redirect_url');
        if (redirect) {
            this.redirect_url = redirect;
        }
    }

    handleTutorialComplete() {
        window.location.href = this.redirect_url || 'https://sf-toolkit.com/';
    }
}
