import { LightningElement, api, track, wire } from 'lwc';
import { LABELS } from './editorLabels';


const BUILDER_MODE = {
    EDIT_MODE:'EDIT_MODE',
    READ_MODE:'READ_MODE'
}

export default class Editor extends LightningElement {

    @api isLoading = false;
    @api isLeftPanelToggled = false;
    @api isRightPanelToggled = false;
    @api isHeaderHidden = false;
    @api isToolbarHidden = false;

    // Header
    @api title;
    @api subtitle;


    labels = LABELS;


    /** Getters */

    get showSpinner() {
        return (
            this.isLoading
        );
    }

    get spinnerAlternativeText() {
        return LABELS.spinnerAlternativeText;
    }

    get isReadOnlyMode() {
        return this.builderMode === BUILDER_MODE.READ_MODE;
    }

    get showLeftPanelClass() {
        return this.isLeftPanelToggled?'slds-show':'slds-hide'
    }

    get showRightPanel() {
        return this.isRightPanelToggled;
    }

    get isHeaderDisplayed(){
        return !this.isHeaderHidden;
    }

    get isToolbarDisplayed(){
        return !this.isToolbarHidden;
    }

}

