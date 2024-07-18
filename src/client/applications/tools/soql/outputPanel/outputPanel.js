import { LightningElement, wire,api  } from 'lwc';
import Toast from 'lightning/toast';
import ToolkitElement from 'core/toolkitElement';
import { store,connectStore,SELECTORS,DESCRIBE,SOBJECT,UI,QUERY } from 'core/store';

import { isNotUndefinedOrNull,lowerCaseKey } from 'shared/utils';

export default class OutputPanel extends ToolkitElement {

    response;
    sobjectName;
    childResponse;
    childSobjectName;
    isLoading;


    error_title;
    error_message;
    currentTab;
    currentChildRecordId;
    @wire(connectStore, { store })
    storeChange({ query, ui }) {
        const queryState = SELECTORS.queries.selectById({query},lowerCaseKey(ui.currentTab?.id));
        if(queryState){
            this.isLoading = queryState.isFetching;
            if (queryState.data && this.response !== queryState.data) {
                this.resetError();
                this.response = queryState.data;
                this.sobjectName = queryState.sobjectName;
            }
            if (queryState.error) {
                this.handleError(queryState.error);
            }
        }else {
            this.response = undefined;
        }
        
        if(ui.currentTab && ui.currentTab.id != this.currentTab?.id){
            this.currentTab = ui.currentTab;
            this.resetError();
        }
        
        this.childResponse = ui.childRelationship;
        if(this.childResponse){
            this.childSobjectName = this.childResponse.column;
            this.selectMainTable(this.childResponse.recordId);
        }
    }

    closeChildRelationship() {
        this.selectMainTable(null);
        store.dispatch(UI.reduxSlice.actions.deselectChildRelationship());
    }

    selectMainTable = (recordId) => {
        const _tableInstance = this.refs.maintable?.tableInstance;
        if(_tableInstance){
            //_tableInstance.deselectRow();
            const setOfIds = [this.currentChildRecordId,recordId].filter(x => x != null);
            _tableInstance.getRows()
            .filter(row => setOfIds.includes(row.getData().Id))
            .forEach(row => {
                if(row.getData().Id == this.currentChildRecordId){
                    row.getElement().classList.remove('tabulator-highlight-row');
                }else{
                    row.getElement().classList.add('tabulator-highlight-row');
                }
            })
            //_tableInstance.selectRow(_tableInstance.getRows().filter(row => row.getData().Id === this.childResponse.recordId));
            //this.refs.maintable.tableResize(0);
        }
        this.currentChildRecordId = recordId;
    }

    

    handleError = e => {
        let errors = e.message.split(':');
        if(errors.length > 1){
            this.error_title = errors.shift();
        }else{
            this.error_title = 'Error';
        }
        this.error_message = errors.join(':');
        //console.error(e);
        const { ui } = store.getState();
        store.dispatch(QUERY.reduxSlice.actions.clearQueryError({tabId:ui.currentTab.id}));
    }

    resetError = () => {
        this.error_title = null;
        this.error_message = null;
    }


    /** Getters */

    @api
    get columns(){
        return this.refs.maintable?.columns;
    }
    
    get isError(){
        return isNotUndefinedOrNull(this.error_message);
    }

    get childRelationshipPanelClass(){
        return this.childResponse?'child-relationship-panel slds-height-30':'child-relationship-panel';
    }

    get childRelationshipPanelClass(){
        return this.childResponse?'child-relationship-panel slds-height-30':'child-relationship-panel';
    }

    get mainOutputClass(){
        return this.childResponse?'main-output slds-height-70':'main-output slds-full-height'
    }
}
