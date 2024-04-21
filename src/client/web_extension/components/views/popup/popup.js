import { LightningElement,api} from "lwc";
import { isUndefinedOrNull,isNotUndefinedOrNull,normalizeString as normalize} from "shared/utils";


export default class Popup extends LightningElement {

    @api currentApplication;
    @api isConnectorLoaded = false;
    @api versions = [];
    @api version;
    @api recordId;


    connectedCallback(){}
    

    /** Events **/

    /** Methods **/

    /** Getters **/

  
}