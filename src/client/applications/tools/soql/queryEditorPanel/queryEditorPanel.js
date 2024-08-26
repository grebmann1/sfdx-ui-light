import { wire, api,track } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { store,connectStore,SELECTORS,SOBJECT,DESCRIBE,QUERY,UI } from 'core/store';
import { fullApiName,isUndefinedOrNull,isNotUndefinedOrNull,lowerCaseKey,guid,classSet,runActionAfterTimeOut,extractErrorDetailsFromQuery } from 'shared/utils';
import LightningConfirm from 'lightning/confirm';


export default class QueryEditorPanel extends ToolkitElement {
    @api namespace;
    
    isMenuSmall = false;
    _sobjectMeta;
    _soql;
    _hasRendered = false;
    _error; // Used to inject error in editor
    _response;
    @track tabs = [];
    currentTab;

    // Models
    currentModel;

    // Changes
    currentFile;
    isDraft = false;

    get soql() {
        return this._soql;
    }

    set soql(value) {
        if(this._hasRendered){
            const inputEl = this.refs?.editor?.currentModel;
            if (inputEl && this._soql != value){
                inputEl.setValue(isUndefinedOrNull(value)?'':value);
            }
        }
        this._soql = value;
    }

    @api
    get useToolingApi(){
        return this._useToolingApi;
    }
    set useToolingApi(value){
        this._useToolingApi = value === true;
        store.dispatch(UI.reduxSlice.actions.toggleToolingApi({useToolingApi:this._useToolingApi}));
    }

    //fetchSObjectsIfNeeded

    _childRelationships = [];
    _sobjectSize = 0;

    @wire(connectStore, { store })
    storeChange({ ui,sobject,query,queryFiles,application }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if(!isCurrentApp) return;

        const { soql,tabs,currentTab } = ui;
        if (ui.query) {
            const sobjectState = SELECTORS.sobject.selectById({sobject},lowerCaseKey(fullApiName(ui.query.sObject,this.namespace)));
            if (sobjectState) {
                this._sobjectMeta = sobjectState.data;
            }
            if(ui.query && this._sobjectMeta){
                this.mapChildRelationships(ui.query);
            }
        }

        this.tabs = tabs;
        if(currentTab && this._hasRendered){
            this.currentTab = currentTab;
            if(this.currentTab.fileId != this.currentFile?.id){
                this.currentFile = SELECTORS.queryFiles.selectById({queryFiles},lowerCaseKey(this.currentTab.fileId));
            }
        }

        const queryState = SELECTORS.queries.selectById({query},lowerCaseKey(currentTab?.id));
        if(queryState){
            this._response = null;
            if(queryState.error){
                this.handleError(queryState.error);
            }else if(queryState.data){
                this._response = queryState.data;
            }
        }else{
            this._response = null;
        }
        
        if(this.soql != soql){
            this.soql = soql;
        }
    }

    handleError = (e) => {
        const error = extractErrorDetailsFromQuery(e.message);
        console.log('error',error);
        if(error && isNotUndefinedOrNull(error.row) && isNotUndefinedOrNull(error.column) && this.refs.editor && isUndefinedOrNull(this._error)){
            this._error = error;
            this.refs.editor.resetMarkers();
            this.refs.editor.addMarkers(
                [{
                    startLineNumber: error.row,
                    endLineNumber: error.row,
                    startColumn: error.column,
                    endColumn: error.column,
                    message: error.message,
                    severity: this.refs.editor.currentMonaco.MarkerSeverity.Error
                }]
            );
        }
    }

    resetError = () => {
        if(this.refs.editor){
            console.log('clear Error');
            this.refs.editor.resetMarkers();
            this._error = null;
        }
    }

    renderedCallback(){
        this._hasRendered = true;
        if(this._hasRendered && this.template.querySelector('slds-tabset')){
            this.template.querySelector('slds-tabset').activeTabValue = this.currentTab?.id;
        }
    }

    mapChildRelationships = (query) => {
        const relationships = query.fields.filter(x => x.type === 'FieldSubquery').map(x => x.subquery.relationshipName);
        const SObjects = this._sobjectMeta.childRelationships.filter(x =>relationships.includes(x.relationshipName)).map(x => x.childSObject);
        const { describe } = store.getState();
        SObjects
        .filter(sobjectName => !this._childRelationships.includes(sobjectName))
        .forEach(sobjectName => {
            this._childRelationships.push(sobjectName);
            store.dispatch(SOBJECT.describeSObject({
                connector:this.connector.conn,
                sObjectName:sobjectName,
                useToolingApi:describe.nameMap[lowerCaseKey(sobjectName)]?.useToolingApi
            }))
        })
        
    }

    handleToolingApiCheckboxChange = (e) => {
        this.useToolingApi = e.detail.checked;
    }

    handleSoqlChange(event) {

        runActionAfterTimeOut(event,async (lastEvent) => {
            const { value } = lastEvent.detail;
            //console.log('handleSoqlChange',this._soql !== value);
            const _newDraft = this.currentFile && this.currentFile.content != value;
            if (this._soql !== value || this.draft != _newDraft) {
                this._soql = value;
                this.draft = _newDraft;
                store.dispatch(UI.reduxSlice.actions.updateSoql({
                    connector:this.queryConnector,
                    soql:value,
                    isDraft:_newDraft
                }));
                // Reset Error
                if(isNotUndefinedOrNull(this._error)){
                    this.resetError();
                }
            }
        },{timeout:20});

        
        
    }


    /** Getters **/

    @api
    get editor(){
        return this.refs?.editor;
    }

    get queryConnector(){
        return this.useToolingApi?this.connector.conn.tooling:this.connector.conn;
    }

    get iconName(){
        return this.isMenuSmall?'utility:toggle_panel_left':'utility:toggle_panel_right';
    }

    get formattedTabs(){
        return this.tabs.map((x,index) => {
            return {
                ...x,
                name:x.fileId || `Query ${index + 1}`,
                isCloseable:this.tabs.length > 1,
                class:classSet('slds-tabs_scoped__item').add({'slds-is-active':x.path === this.currentFile}).toString()
            }
        })
    }

    get isTotalRecordDisplayed(){
        return isNotUndefinedOrNull(this.totalRecords);
    }

    get totalRecords(){
        return this._response?.totalSize;
    }

    /** Tabs */

    handleAddTab = (e) => {
        store.dispatch(UI.reduxSlice.actions.addTab({
            tab:{
                id:guid(),
                body:''
            }
        }));
    }

    handleSelectTab = (e) => {
        const tabId = e.target.value;
        store.dispatch(UI.reduxSlice.actions.selectionTab({id:tabId,alias:this.alias}));
    }

    handleCloseTab = async (e) => {
        const tabId = e.detail.value;
        const currentTab = this.tabs.find(x => x.id === tabId);
        const params = {variant: 'headerless',message: 'This query has unsaved changes ! Do you want delete it ?'}
        if(!currentTab.isDraft || currentTab.isDraft && isUndefinedOrNull(currentTab.fileId) || currentTab.isDraft && await LightningConfirm.open(params)){
            store.dispatch(UI.reduxSlice.actions.removeTab({id:tabId,alias:this.alias}));
        }
    }
    

    /** Monaco Editor */
    
    handleMonacoLoaded = (e) => {
        this.currentModel = this.refs.editor.createModel({
            body:this._soql,
            language:'soql'
        });
        this.refs.editor.displayModel(this.currentModel);
    }
}
