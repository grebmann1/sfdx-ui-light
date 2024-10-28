import { LightningElement, wire,api  } from 'lwc';
import Toast from 'lightning/toast';
import ToolkitElement from 'core/toolkitElement';
import { store,connectStore,SELECTORS,DESCRIBE,SOBJECT,UI,QUERY } from 'core/store';
import { isNotUndefinedOrNull,lowerCaseKey } from 'shared/utils';
import moment from 'moment';

export default class OutputPanel extends ToolkitElement {

    response;
    sobjectName;
    childResponse;
    childSobjectName;
    isLoading;
    _loadingMessage;
    _loadingInterval;


    error_title;
    error_message;
    currentTab;
    currentChildRecordId;
    

    @wire(connectStore, { store })
    storeChange({ query, ui, application }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if(!isCurrentApp) return;
        const queryState = SELECTORS.queries.selectById({query},lowerCaseKey(ui.currentTab?.id));
        // Tab Processing
        if(ui.currentTab && ui.currentTab.id != this.currentTab?.id){
            this.currentTab = ui.currentTab;
            this.resetError();
        }
        
        if(queryState){
            this.isLoading = queryState.isFetching;
            // loading Message
            if(this.isLoading){
                this.enableAutoDate(queryState.createdDate);
            }else{
                if(this._loadingInterval) clearInterval(this._loadingInterval);
            }

            // Response Processing
            if (queryState.error) {
                this.handleError(queryState.error);
                this.response = null;
            }else if (queryState.data && this.response !== queryState.data) {
                this.resetError();
                this.response = queryState.data;
                this.sobjectName = queryState.sobjectName;
            }else if(queryState.isFetching) {
                this.response = null;
                this.resetError();
            }
        }else {
            this.response = null;
            this.isLoading = false;
            if(this._loadingInterval) clearInterval(this._loadingInterval);
        }
        this.childResponse = ui.currentTab.childRelationship;
        if(this.childResponse){
            this.childSobjectName = this.childResponse.column;
            this.selectMainTable(this.childResponse.recordId);
        }
    }

    formatDate = (createdDate) => {
        //console.log('formatDate');
        this._loadingMessage = `Running for ${moment().diff(moment(createdDate), 'seconds')} seconds`;
    }

    enableAutoDate = (createdDate) => {
        if(this._loadingInterval) clearInterval(this._loadingInterval);
        this.formatDate(createdDate);
        this._loadingInterval = setInterval(() =>{
            this.formatDate(createdDate);
        },1000);
    }

    closeChildRelationship() {
        this.selectMainTable(null);
        store.dispatch(UI.reduxSlice.actions.deselectChildRelationship());
    }

    selectMainTable = (recordId) => {
        
        const _tableInstance = this.refs.maintable?.tableInstance;
        if(_tableInstance){
            //_tableInstance.deselectRow();
            _tableInstance.getRows()
            .filter(row => row.getElement().classList.contains('tabulator-highlight-row'))
            .forEach(row => {
                row.getElement().classList.remove('tabulator-highlight-row');
            })

            _tableInstance.getRows()
            .filter(row => recordId === row.getData().Id)
            .forEach(row => {
                row.getElement().classList.add('tabulator-highlight-row')
            })
            //_tableInstance.selectRow(_tableInstance.getRows().filter(row => row.getData().Id === this.childResponse.recordId));
            //this.refs.maintable.tableResize(0);
        }
        this.currentChildRecordId = recordId;
    }

    handleTableBuilt = () => {
        this.selectMainTable(this.currentChildRecordId);
    }
    

    handleError = e => {
        let errors = e.message.split(':');
        if(errors.length > 1){
            this.error_title = errors.shift();
        }else{
            this.error_title = 'Error';
        }
        this.error_message = errors.join(':');
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
    
    get hasError(){
        return isNotUndefinedOrNull(this.error_message);
    }

    get isResponseTableDisplayed(){
        return !this.hasError && this.response;
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
