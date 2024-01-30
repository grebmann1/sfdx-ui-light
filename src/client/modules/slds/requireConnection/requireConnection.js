import { api } from "lwc";
import FeatureElement from 'element/featureElement';


export default class RequireConnection extends FeatureElement {

    @api title = "No Salesforce Connection";
    @api subTitle = "It's required to be connected to an Org to use this feature";
    @api isRequired = false;

    /** Events */

    /** Methods */

    /** Getters */
    get isDisplayed(){
        return !this.isRequired || this.isRequired && this.isUserLoggedIn;
    }
}