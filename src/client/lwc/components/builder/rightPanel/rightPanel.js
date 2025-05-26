import { api, LightningElement } from 'lwc';
import { classSet } from 'shared/utils';

export default class RightPanel extends LightningElement {
    @api isVariableWidth = false;

    get cssClass() {
        return classSet(
            'slds-panel slds-size_full slds-panel_docked slds-panel_docked-right slds-is-open slds-scrollable_none'
        )
            .add({
                'fixed-width': !this.isVariableWidth,
            })
            .toString();
    }
}
