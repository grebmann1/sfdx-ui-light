import {LightningElement,api} from "lwc";

export default class ViewerValue extends LightningElement {

    @api value;
    @api type;

    /** Getters */


    get isBoolean(){
        return this.type === 'boolean';
    }
    
}