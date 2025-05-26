import { api, wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { store, connectStore } from 'core/store';

export default class Header extends ToolkitElement {
    _apiUsage;

    @wire(connectStore, { store })
    storeChange({ ui }) {
        this._apiUsage = ui.apiUsage;
    }

    connectedCallback() {}

    /** Events **/

    /** Getters **/

    get apiUsage() {
        if (!this._apiUsage) return '';
        return `${this._apiUsage.used}/${this._apiUsage.limit}`;
    }
}
