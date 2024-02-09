import { LightningElement,api} from "lwc";
import { isEmpty,runActionAfterTimeOut} from 'shared/utils';
import { classSet } from 'lightning/utils';


export default class MenuItem extends LightningElement {

    @api isSelected;
    @api name;
    @api highlight;
    @api label;
    @api current;



    connectedCallback(){}

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
        if(isEmpty(this.highlight)){
            return this.label;
        }

        var regex = new RegExp('('+this.highlight+')','gi');
        if(regex.test(this.label)){
            return this.label.toString().replace(/<?>?/,'').replace(regex,'<span style="font-weight:Bold; color:blue;">$1</span>');
        }else{
            return this.label;
        }
    }


}