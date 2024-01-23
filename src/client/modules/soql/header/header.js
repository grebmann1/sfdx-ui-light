import { wire } from 'lwc';
import FeatureElement from 'element/featureElement';
import {
    connectStore,
    store
} from 'soql/store';

export default class Header extends FeatureElement{
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
