import { LightningElement,api} from "lwc";
import { isUndefinedOrNull } from "shared/utils";

export default class Footer extends LightningElement {

    @api versions = [];
    @api version;

    /** Events **/


    /** Getters **/

    get versionFormatted(){
        return isUndefinedOrNull(this.version)?'':`${this.version.label} (${this.version.version})`;
    }
}