import { LightningElement,api} from "lwc";
import { isUndefinedOrNull } from "shared/utils";

export default class Popup extends LightningElement {

    @api sessionId;
    @api serverUrl;
    @api versions = [];
    @api version;

    async connectedCallback(){
        console.log('sessionId',this.sessionId);
        console.log('serverUrl',this.serverUrl);
        console.log('version',this.version);
    }


    /** Events **/

    redirectToWebsite = () => {
        chrome.tabs.create({
            url:'https://sf-toolkit.com/extension?sessionId='+window.sessionId+'&serverUrl=https://'+window.serverUrl
        }, tab => {});
    }

    handleChangeVersionClick = (e) => {
        
    }

    /** Getters **/

    get versionFormatted(){
        return isUndefinedOrNull(this.version)?'':`${this.version.label} (${this.version.version})`;
    }
}