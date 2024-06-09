import { LightningElement,api} from "lwc";
import Toast from 'lightning/toast';
import { isUndefinedOrNull } from "shared/utils";
import FeatureElement from 'element/featureElement';

export default class Footer extends FeatureElement {

    @api versions = [];
    @api version;

    connectedCallback(){

    }

    /** Events **/

    handleCopy = () => {
        navigator.clipboard.writeText(this.usernameFormatted);
        Toast.show({
            label: 'Username exported to your clipboard',
            variant:'success',
        });
    }


    /** Getters **/

    get usernameFormatted(){
        return isUndefinedOrNull(this.connector.header.username)?'':`${this.connector.header.username}`;
    }

    get versionFormatted(){
        return isUndefinedOrNull(this.version)?'':`${this.version.label} (${this.version.version})`;
    }
}