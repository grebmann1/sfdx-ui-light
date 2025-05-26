import { LightningElement, api } from 'lwc';
import {
    isEmpty,
    runActionAfterTimeOut,
    normalizeString as normalize,
    classSet,
} from 'shared/utils';

export default class VerticalPanel extends LightningElement {
    @api position;
    @api isOpen;
    @api size = 'slds-size_medium';
    @api title = 'Filter';

    hasLoaded = false;

    /** Events */

    handleClose = e => {
        e.preventDefault();
        this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    };

    /** Methods */

    /** Getters */

    get filterPanelClass() {
        return classSet(
            `slds-panel ${this.normalizedSize} slds-panel_docked slds-panel_docked-${this.normalizedPosition} slds-panel_drawer`
        )
            .add({
                'slds-is-open slds-flex-column': this.isOpen,
            })
            .toString();
    }

    get normalizedSize() {
        return normalize(this.size, {
            fallbackValue: 'default',
            validValues: ['default', 'slds-size_medium', 'slds-size_full'],
        });
    }

    get normalizedPosition() {
        return normalize(this.position, {
            fallbackValue: 'right',
            validValues: ['left', 'right'],
        });
    }
}
