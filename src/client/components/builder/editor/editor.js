import { LightningElement, api, track, wire } from 'lwc';
import hotkeysManager from './hotkeysmanager';
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
    editorId;

    connectedCallback() {
        this.enableShortcuts();
    }

    disconnectedCallback(){
        this.disableShortcuts();
    }

    /** Methods */

    enableShortcuts = () => {
        hotkeysManager.subscribe('ctrl+s,command+s',this.executeActionSave);
        hotkeysManager.subscribe('ctrl+enter,command+enter',this.executeActionMethod);
    }

    disableShortcuts = () => {
        hotkeysManager.unsubscribe('ctrl+s,command+s',this.executeActionSave);
        hotkeysManager.unsubscribe('ctrl+enter,command+enter',this.executeActionMethod);
    }

    executeActionSave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if(this.isEditorVisible){
            this.dispatchEvent(new CustomEvent("executesave", {bubbles: true,composed:true }))
        }
    }

    executeActionMethod = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if(this.isEditorVisible){
            this.dispatchEvent(new CustomEvent("executeaction", {bubbles: true,composed:true }))
        }
    }


    /** Getters */

    get isEditorVisible() {
        const element = this.template.querySelector('.editor-main-container');
        return element ? !element.hidden && element.offsetParent !== null : false;
    }

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

