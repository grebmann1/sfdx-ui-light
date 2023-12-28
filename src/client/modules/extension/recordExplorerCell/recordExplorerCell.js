import {LightningElement,api} from "lwc";
import { isNotUndefinedOrNull,isEmpty } from "shared/utils";
export default class RecordExplorerCell extends LightningElement {

    @api value;
    @api type;
    @api name;
    @api label;
    @api filter;


    async connectedCallback(){}

    renderedCallback() {
        if(this.template.querySelector('.injector')){
            // Issue will happen with "HTML values";
            this.template.querySelector('.injector').innerHTML = this.formattedValue;
        }
    }

    handleCopy = () => {
        navigator.clipboard.writeText(this.value);
    }


    /** Getters */

    get isBoolean(){
        return this.type === 'boolean';
    }
    

    get formattedValue(){
        if(isEmpty(this.filter)) return this.value;

        var regex = new RegExp('('+this.filter+')','gi');
        if(isNotUndefinedOrNull(this.value) && regex.test(this.value)){
            return this.value.toString().replace(/<?>?/,'').replace(regex,'<span style="font-weight:Bold; color:blue;">$1</span>');
        }

        return this.value;
    }
    
}