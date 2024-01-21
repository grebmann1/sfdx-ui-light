import { LightningElement, wire, api } from 'lwc';
import { I18nMixin } from 'element/i18n';
import {
    connectStore,
    store
} from 'soql/store';

export default class Header extends I18nMixin(LightningElement) {
    _apiUsage;

    

    @wire(connectStore, { store })
    storeChange({ ui }) {
        this._apiUsage = ui.apiUsage;
    }

    get apiUsage() {
        if (!this._apiUsage) return '';
        return `${this._apiUsage.used}/${this._apiUsage.limit}`;
    }

}
