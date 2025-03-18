import {api, LightningElement, wire} from 'lwc';
import {classSet, isNotUndefinedOrNull, runActionAfterTimeOut} from 'shared/utils';
import {connectStore, store as legacyStore, store_application} from 'shared/store';
import { TYPE } from 'overlay/utils';
import constant from "core/constant";

export default class Header extends LightningElement {


    @api currentApplicationName = 'App Name';
    @api currentTabName = 'Home';
    @api applications;
    @api isUserLoggedIn = false;

    @api version = constant.version || '';

    @api isMenuSmall = false;

    @api isIconDisabled = false;

    @api placeholder = '';

    @api isComboboxDisplayed = false;

    @api searchValue;
    // Filter



    @wire(connectStore, {store})
    applicationChange({application}) {
        // Toggle Menu
        if (isNotUndefinedOrNull(application.isMenuExpanded)) {
            this.isMenuSmall = !application.isMenuExpanded;
        }
    }

    connectedCallback() {}

    /** Events **/

    search_handleChange = (e) => {
        e.stopPropagation();
        runActionAfterTimeOut(e.detail.value, (newValue) => {
            this.dispatchEvent(new CustomEvent("search", {
                detail: {value: newValue},
                bubbles: true
            }));
        }, 1000);
    };

    filter_handleChange = (e) => {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent("filter", {
            detail: {value: e.detail.value},
            bubbles: true
        }));
    }

    handleToggle = () => {
        this.isMenuSmall = !this.isMenuSmall;
        if (this.isMenuSmall) {
            legacyStore.dispatch(store_application.collapseMenu());
        } else {
            legacyStore.dispatch(store_application.expandMenu());
        }
    };

    /** Getters */

    get collapseClass() {
        return classSet("slds-grid button-container") //slds-show_medium
            .add({
                'slds-grid_align-end': !this.isMenuSmall,
                'slds-grid_align-center': this.isMenuSmall,
            })
            .toString()
    }

    get iconName() {
        return this.isMenuSmall ? 'utility:toggle_panel_left' : 'utility:toggle_panel_right';
    }

    get isIconDisplayed(){
        return !this.isIconDisabled;
    }

    get filter_options(){
        return [
            {label:'All',value: TYPE.ALL}, // Default Value
            {label:'Apex Class',value: TYPE.APEX_CLASS},
            {label:'Apex Trigger',value: TYPE.APEX_TRIGGER},
            {label:'Object',value: TYPE.OBJECT},
            {label:'Profile',value: TYPE.PROFILE},
            {label:'PermissionSet',value: TYPE.PERMISSION_SET},
            {label:'User',value: TYPE.USER}
        ]
    }

}