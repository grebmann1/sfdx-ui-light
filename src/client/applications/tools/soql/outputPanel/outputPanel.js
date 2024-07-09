import { LightningElement, wire,api  } from 'lwc';
import Toast from 'lightning/toast';
import ToolkitElement from 'core/toolkitElement';
import { store,connectStore,SELECTORS,DESCRIBE,SOBJECT,UI } from 'core/store';

import { isNotUndefinedOrNull } from 'shared/utils';

export default class OutputPanel extends ToolkitElement {

    response;
    childResponse;
    isLoading;

    _sObject;

    error_title;
    error_message;

    @wire(connectStore, { store })
    storeChange({ query, ui }) {
        this.isLoading = query.isFetching;
        if (query.data) {
            if (this.response !== query.data) {
                this.resetError();
                this.response = query.data;
                this._sObject = ui.query.sObject;
            }
        } else {
            this.response = undefined;
        }
        if (query.error) {
            this.handleError(query.error);
        }
        this.childResponse = ui.childRelationship;
    }

    closeChildRelationship() {
        store.dispatch(UI.reduxSlice.actions.deselectChildRelationship());
    }

    async exportCsv() {
        this.isLoading = true;
        try {
            const data = await this.template
                .querySelector('soql-output-table.main-output')
                .generateCsv();
            const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
            const blob = new Blob([bom, data], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const download = document.createElement('a');
                download.href = window.URL.createObjectURL(blob);
                download.download = `${this._sObject}.csv`;
                download.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            Toast.show({
                message: this.i18n.OUTPUT_PANEL_FAILED_EXPORT_CSV,
                errors: e
            });
        }
        this.isLoading = false;
    }

    handleError = e => {
        let errors = e.message.split(':');
        if(errors.length > 1){
            this.error_title = errors.shift();
        }else{
            this.error_title = 'Error';
        }
        this.error_message = errors.join(':');
        console.error(e);
        store.dispatch(UI.reduxSlice.actions.clearQueryError());
    }

    resetError = () => {
        this.error_title = null;
        this.error_message = null;
    }


    /** Getters */
    
    get isError(){
        return isNotUndefinedOrNull(this.error_message);
    }
}
