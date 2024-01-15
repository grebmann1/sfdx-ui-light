import { LightningElement,api} from "lwc";
import { isEmpty,runActionAfterTimeOut} from 'shared/utils';
import { classSet } from 'lightning/utils';


export default class MenuItem extends LightningElement {

    @api isSelected;
    @api name;
    @api filter;
    @api label;
    @api current;



    async connectedCallback(){}

    /** Events */

    handleClick = (e) => {
        e.preventDefault();
        this.dispatchEvent(new CustomEvent("select", { detail:{name:this.name},bubbles: true }));
    }

    /** Methods */




    /** Getters */
    get currentClass(){
        return classSet('slds-nav-vertical__item')
             .add({
                'slds-is-active':this.current === this.name
             })
             .toString();
    }

    get formattedLabel(){
        if(isEmpty(this.filter)){
            return this.label;
        }

        var regex = new RegExp('('+this.filter+')','gi');
        if(regex.test(this.label)){
            return this.label.toString().replace(/<?>?/,'').replace(regex,'<span style="font-weight:Bold; color:blue;">$1</span>');
        }else{
            return this.label;
        }
    }


}