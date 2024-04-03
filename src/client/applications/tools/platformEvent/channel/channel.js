import { api,track } from "lwc";
import { decodeError,isNotUndefinedOrNull,classSet } from 'shared/utils';
import FeatureElement from 'element/featureElement';

export default class Channel extends FeatureElement {

    isLoading = false;

    @api item;
    @api selectedItem;


    /** Events **/

    selectChannel = (e) => {
        this.dispatchEvent(new CustomEvent("select", { 
            detail:{value:this.item.name},
            bubbles: true,composed: true 
        }));
    }

    removeChannel = () => {
        this.item.unsubscribe();
        this.dispatchEvent(new CustomEvent("delete", { 
            detail:{value:this.item.name},
            bubbles: true,composed: true 
        }));
    }
    

    /** Methods  **/

    /** Getters */

    get itemClass(){
        return classSet("slds-p-around_small slds-border_bottom channel-item slds-grid slds-justify-content-space-between")
        .add({
            'slds-is-active':this.selectedItem == this.item.name,
        }).toString();
    }

}