import {LightningElement,api} from "lwc";
import FeatureElement from 'element/featureElement';


export default class App extends FeatureElement {

    async connectedCallback(){}

    /** Events */

    /** Methods */


    /** Getters */
    
    get pageClass(){
        return super.pageClass+' slds-p-around_small';
    }
}