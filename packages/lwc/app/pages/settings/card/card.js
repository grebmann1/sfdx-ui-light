import { api, LightningElement } from 'lwc';

export default class Card extends LightningElement {
    @api isFirst = false;

    get cardClass() {
        return 'slds-card slds-card_boundary ' + (this.isFirst ? '' : 'slds-card-no-top');
    }
}
