import { LightningElement,api} from "lwc";

export default class Popup extends LightningElement {

    @api sessionId;
    @api serverUrl;

    async connectedCallback(){
        console.log('sessionId',this.sessionId);
        console.log('serverUrl',this.serverUrl);
    }


    /** Events **/

    redirectToWebsite = () => {
        chrome.tabs.create({
            url:'https://sf-toolkit.com/extension?sessionId='+window.sessionId+'&serverUrl=https://'+window.serverUrl
        }, tab => {});
    }
}