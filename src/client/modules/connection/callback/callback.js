import { LightningElement } from 'lwc';


export default class Callback extends LightningElement {


    connectedCallback(){

        window.jsforce.browserClient = new window.jsforce.browser.Client(); // Reset
        window.jsforce.browserClient.init(window.jsforceSettings);
    }



}