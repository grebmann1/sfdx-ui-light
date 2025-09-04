import { LightningElement, api } from 'lwc';
import { classSet } from 'shared/utils';

export default class ApiAppSettings extends LightningElement {

    
    @api isFullWidth = false;
    @api isTitleHidden = false;
    @api isSectionHeaderHidden = false;

    /**
     * The configuration object for API Application Settings.
     * Should be passed from the parent component.
     */
    @api config;

    /**
     * Handler for input field changes.
     * Should be passed from the parent component.
     */
    @api inputfield_change;


    /** Getters **/

    get cardClass() {
        return classSet('slds-col slds-size_1-of-1 slds-p-horizontal_small')
        .add({
            'slds-large-size_1-of-2': !this.isFullWidth,
        })
        .toString();
    }

    get isTitleDisplayed() {
        return !this.isTitleHidden;
    }

    get isSectionHeaderDisplayed() {
        return !this.isSectionHeaderHidden;
    }
}
