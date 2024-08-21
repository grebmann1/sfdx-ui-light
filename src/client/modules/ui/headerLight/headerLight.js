import { LightningElement,api,wire } from 'lwc';
import { isElectronApp, isEmpty, classSet,isNotUndefinedOrNull } from 'shared/utils';
import constant from "core/constant";

export default class HeaderLight extends LightningElement {

    @api version = constant.version || '';
    

    /** Getters */

    get formattedVersion(){
        return `${this.version}`;
    }

    get collapseClass(){
        return classSet("slds-grid button-container slds-show_medium")
        .add({
            'slds-grid_align-end':!this.isMenuSmall,
            'slds-grid_align-center':this.isMenuSmall,
        })
        .toString()
    }

    get iconName(){
        return this.isMenuSmall?'utility:toggle_panel_left':'utility:toggle_panel_right';
    }

}