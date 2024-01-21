
import { LightningElement, api } from 'lwc';
import { I18nMixin } from 'element/i18n';
import {
    store,
    selectChildRelationship,
} from 'soql/store';
import { isUndefinedOrNull } from 'shared/utils';

export default class OutputCell extends I18nMixin(LightningElement) {
    @api connector;
    @api value;

    get isChildRelationship() {
        return this.value && this.value.rawData && this.value.rawData.totalSize;
    }

    get url() {
        if (!/^[0-9A-Za-z]{18}$/.test(this.value.data)) return null;
        return `${this.connector.header.sfdxAuthUrl}&retURL=${this.value.data}`;
    }

    get isDataDisplayed(){
        return isUndefinedOrNull(this.url);
    }

    handleClick() {
        store.dispatch(selectChildRelationship(this.value.rawData));
    }
}
