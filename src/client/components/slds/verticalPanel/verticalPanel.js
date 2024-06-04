import { LightningElement,api} from "lwc";
import { isEmpty,runActionAfterTimeOut} from 'shared/utils';
import { classSet } from 'lightning/utils';


export default class VerticalPanel extends LightningElement {

    @api isOpen;
    @api size = 'slds-size_medium';
    @api title = 'Filter';

    hasLoaded = false;

    /** Events */

    handleClose = (e) => {
        e.preventDefault();
        this.dispatchEvent(new CustomEvent("close", {bubbles: true}));
    }

    /** Methods */




    /** Getters */

    get filterPanelClass(){
        return classSet(`slds-panel ${this.size} slds-panel_docked slds-panel_docked-right slds-panel_drawer`)
        .add({
            'slds-is-open':this.isOpen
        }).toString();
    }


}