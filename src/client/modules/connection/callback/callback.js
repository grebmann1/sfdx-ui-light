import { LightningElement } from 'lwc';


export default class Callback extends LightningElement {


    connectedCallback(){
        window.jsforce.browser.on('connect', function(conn) {
            //window.close();
        });
    }



}