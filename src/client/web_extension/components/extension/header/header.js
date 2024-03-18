import { LightningElement,api} from "lwc";
import { isUndefinedOrNull } from "shared/utils";

export default class Header extends LightningElement {


    /** Events **/

    redirectToWebsite = () => {
        chrome.tabs.create({
            url:'https://sf-toolkit.com/app',
            //url:'https://sf-toolkit.com/extension?sessionId='+window.sessionId+'&serverUrl=https://'+window.serverUrl
        }, tab => {});
    }

    /** Getters **/


}