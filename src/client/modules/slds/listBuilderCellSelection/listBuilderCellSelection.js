import {LightningElement,api} from 'lwc';

export default class ListBuilderCellSelection extends LightningElement {
    @api recordId;
    @api checked;
    @api label;
    @api excluded;

    handleValueChange = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.checked = e.detail.checked;
        this.sendEvent();
    }

    sendEvent = () => {
        this.dispatchEvent(new CustomEvent('rowselect', {
            composed: true,
            bubbles: true,
            cancelable: true,
            detail: {
                name: this.recordId,
                checked:this.checked,
                label:this.label
            }
        }));
    }
}