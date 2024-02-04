import { api } from "lwc";
import { isEmpty,isElectronApp } from 'shared/utils';
import FeatureElement from 'element/featureElement';


export default class App extends FeatureElement {

    
    connectedCallback(){}

    
    /** Events */
 
    /** Methods */
    
    /** Getters */
    
    get pageClass(){
        return super.pageClass+' slds-overflow-hidden';
    }

}