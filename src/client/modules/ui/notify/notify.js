import {LightningElement,api} from 'lwc';

export default class Notify extends LightningElement {
    @api isCloseDiplayed = false;

    /** Events */

    handleClose = (e) => {
        this.dispatchEvent(new CustomEvent("close"));
    }
}