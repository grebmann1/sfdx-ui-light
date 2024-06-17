import { LightningElement, api, track } from 'lwc';
import { normalizeString,generateUniqueId } from 'shared/utils';
import hotkeys from 'hotkeys-js';

export default class ShortcutSelector extends LightningElement {
    @api label = 'Shortcut Selector';

    @api disabled = false;

    @api value = null;



    /** Events **/

    connectedCallback(){
    }

    handleEditClick = () => {
        this.isEditMode = true;
    }

    handleSaveClick = () => {
        this.isEditMode = false;
    }

    handleInputFocus = () => {
        this.bindShortcut();
    }

    handleInputFocusOut = () => {
        this.unbindShortcut();
    }

    /** Methods **/

    shortcutHandler = (e,handler) => {
        e.preventDefault();
        this.value = hotkeys.getPressedKeyString();
        this.dispatchEvent(new CustomEvent("change", {detail:{value:this.value},bubbles: true,composed: true  }));
    }

    bindShortcut = () => {
        hotkeys('*', this.shortcutHandler);
    }

    unbindShortcut = () => {
        hotkeys.unbind('*', this.shortcutHandler);
    }
    

    /** Getters **/

    get isDisabled(){
        return this.disabled;
    }
   
}