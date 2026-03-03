import { LightningElement, api } from 'lwc';
import { isEmpty } from 'shared/utils';

export default class CatalogPanel extends LightningElement {
    @api isOpen;
    @api size = 'slds-size_medium';
    @api title = 'Salesforce Catalog';
    @api tree = [];
    @api isLoading = false;
    @api errorMessage;

    searchFields = ['name', 'title', 'keywords'];
    minSearchLength = 1;

    handleSelect(event) {
        this.dispatchEvent(new CustomEvent('select', { detail: event.detail }));
    }

    handleClose(event) {
        this.dispatchEvent(new CustomEvent('close', { detail: event.detail }));
    }

    handleRefresh() {
        this.dispatchEvent(new CustomEvent('refresh'));
    }

    get hasError() {
        return !isEmpty(this.errorMessage);
    }
}

