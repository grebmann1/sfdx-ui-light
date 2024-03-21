import { LightningElement,api} from "lwc";
import { isUndefinedOrNull } from "shared/utils";

export default class Footer extends LightningElement {

    @api versions = [];
    @api version;

    username;

    connectedCallback(){

    }

    /** Events **/


    /** Getters **/

    get usernameFormatted(){
        return isUndefinedOrNull(window.connector.header.username)?'':`${window.connector.header.username}`;
    }

    get versionFormatted(){
        return isUndefinedOrNull(this.version)?'':`${this.version.label} (${this.version.version})`;
    }
}