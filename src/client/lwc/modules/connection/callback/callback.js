import { LightningElement } from 'lwc';

export default class Callback extends LightningElement {
    connectedCallback() {
        window.jsforce.browserClient = new window.jsforce.BrowserClient(); // Reset
        window.jsforce.browserClient.init(window.jsforceSettings);
    }
}
