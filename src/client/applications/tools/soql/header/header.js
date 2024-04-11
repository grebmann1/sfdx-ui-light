import { api,wire } from 'lwc';
import FeatureElement from 'element/featureElement';
import {
    connectStore,
    store
} from 'soql/store';

export default class Header extends FeatureElement{
    _apiUsage;

    @api isLeftToggled = false;

    @wire(connectStore, { store })
    storeChange({ ui }) {
        this._apiUsage = ui.apiUsage;
    }

    connectedCallback(){
        //this.handleToggle();
    }

    /** Events **/

    handleToggle = (e) => {
        this.isLeftToggled = ! this.isLeftToggled;
        this.dispatchEvent(new CustomEvent("lefttoggle", { 
            detail:{value:this.isLeftToggled},
            bubbles: true,composed: true 
        }));
    }

    /** Getters **/

    get apiUsage() {
        if (!this._apiUsage) return '';
        return `${this._apiUsage.used}/${this._apiUsage.limit}`;
    }

}
