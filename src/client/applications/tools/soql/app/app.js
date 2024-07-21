import { api,wire,track} from "lwc";
import ToolkitElement from 'core/toolkitElement';
import LightningConfirm from 'lightning/confirm';
import Toast from 'lightning/toast';
import SaveModal from "builder/saveModal";
import PerformanceModal from "soql/PerformanceModal";
import { store,connectStore,SELECTORS,DESCRIBE,UI,QUERY,DOCUMENT,APPLICATION } from 'core/store';
import { guid,isNotUndefinedOrNull,isUndefinedOrNull,fullApiName,compareString,lowerCaseKey,getFieldValue,isObject,arrayToMap,extractErrorDetails } from 'shared/utils';
import { CATEGORY_STORAGE } from 'builder/storagePanel';
import moment from 'moment';

export default class App extends ToolkitElement {

    @track selectedSObject;
    @track isLeftToggled = true;
    @track isRecentToggled = false;
    @api namespace;

    @track recentQueries = [];
    @track savedQueries = [];

    @track selectedRecords = [];
    @track selectedChildRecords = [];

    soql;
    _useToolingApi;
    sobjectPrefixMapping;

    // Response
    _response;
    _responseCreatedDate;
    _responseCreatedDateFormatted;
    _responseNextRecordsUrl;
    _responseRows;
    _sobject;
    _interval;
    

    connectedCallback() {
        store.dispatch(DESCRIBE.describeSObjects({
            connector:this.connector.conn
        }))
        //this.sobjectPrefixMapping = this.generatePrefixMapping();
        //store.dispatch(QUERY.reduxSlice.actions.dummyData());
        
        if(this.alias){
            store.dispatch((dispatch, getState) => {
                dispatch(DOCUMENT.reduxSlices.QUERYFILE.actions.loadFromStorage({
                    alias:this.alias
                }));
                dispatch(UI.reduxSlice.actions.loadCacheSettings({
                    alias:this.alias,
                    queryFiles:getState().queryFiles
                }));
                dispatch(UI.reduxSlice.actions.initTabs({
                    queryFiles:getState().queryFiles
                }));
            })
        }
        this.enableAutoDate();
    }

    disconnectedCallback(){
        clearInterval(this._interval);
    }

    @wire(connectStore, { store })
    storeChange({ query,ui,describe,queryFiles,recents }) {
        if(ui && this._useToolingApi != ui.useToolingApi){
            this._useToolingApi = ui.useToolingApi;
        }
        this.isLeftToggled      = ui.leftPanelToggled;
        this.isRecentToggled    = ui.recentPanelToggled;
        this.soql               = ui.soql;

        const fullSObjectName = ui.selectedSObject ? lowerCaseKey(fullApiName(ui.selectedSObject,this.namespace)):null;
        if(fullSObjectName && describe.nameMap && describe.nameMap[fullSObjectName]){
            this.selectedSObject = fullSObjectName;
            this._sobject = describe.nameMap[fullSObjectName];
        }else{
            this.selectedSObject = null;
        }

        /** Responses */

        const queryState = SELECTORS.queries.selectById({query},lowerCaseKey(ui.currentTab?.id));
        if(queryState && queryState.data){
            this._response = queryState.data;
            this._responseCreatedDate = queryState.createdDate;
            this._responseNextRecordsUrl = queryState.data.nextRecordsUrl;
            this._responseRows = queryState.data.records;
            this.formatDate();
        }else {
            this._response = undefined;
        }

        /** Recent Queries */
        if (recents && recents.queries) {
            this.recentQueries = recents.queries.map((query, index) => {
                return { id: `${index}`, content: query };
            });
        }

        /** Saved Queries */
        if (queryFiles) {
            const entities = SELECTORS.queryFiles.selectAll({queryFiles});
            this.savedQueries = entities.map((item, index) => {
                return item; // no mutation for now
            });
        }

        
    }

    formatDate = () => {
        this._responseCreatedDateFormatted = this._responseCreatedDate?moment(this._responseCreatedDate).fromNow():null;
    }

    enableAutoDate = () => {
        this.formatDate();
        this._interval = setInterval(() =>{
            this.formatDate();
        },30000);
    }


    deleteRecords = async (sobject,records) => {
        if(isUndefinedOrNull(sobject)) return;
        console.log('sobject',sobject);
        const connector = sobject.useToolingApi?this.connector.conn.tooling:this.connector.conn;
        const rets = await connector.sobject(sobject.name).delete(records.map(x => x.Id));
        return rets;
    }

    /** Events **/
    
    handlePerformanceCheckClick = async (e) => {
        console.log('handlePerformanceCheckClick');

        console.log('fetchQueryPerformances');
        try{
            const { ui } = store.getState();
            //this.isLoading = true;
            const result = await store.dispatch(QUERY.explainQuery({
                connector:this.queryConnector,
                soql:this.soql,
                tabId:ui.currentTab.id
            })).unwrap();
            //this.isLoading = false;
            console.log('result',result);
            const plans = result.data.plans;
            PerformanceModal.open({plans});
            
        } catch (e) {
            // handle error here
            console.log('error',e); 
            
            //this.isLoading = false;
        }
    }

    handleLeftToggle = (e) => {
        store.dispatch(UI.reduxSlice.actions.updateLeftPanel({
            value:!this.isLeftToggled,
            alias:this.alias,
        }));
    }

    handleRecentToggle = (e) => {
        store.dispatch(UI.reduxSlice.actions.updateRecentPanel({
            value:!this.isRecentToggled,
            alias:this.alias,
        }));
    }
    
    handleFormatQueryClick = e => {
        store.dispatch(UI.reduxSlice.actions.formatSoql());
    }

    handleRunClick = e => {
        const isAllRows = false;
        const inputEl = this.refs?.editor?.editor?.currentModel
        if (!inputEl) return;
        const query = inputEl.getValue();
        if (!query) return;

        const { ui } = store.getState();
        store.dispatch(QUERY.executeQuery({
            connector:this.queryConnector,
            soql:query, 
            tabId:ui.currentTab.id,
            sobjectName:this.selectedSObject,
            isAllRows
        }));
    }

    handleSaveClick = () => {
        const { ui } = store.getState();
        const file = ui.currentTab.fileId?SELECTORS.queryFiles.selectById(store.getState(),lowerCaseKey(ui.currentTab.fileId)):null;
        SaveModal.open({
            title:'Save Query',
            _file:file
        }).then(async data => {
            if(isUndefinedOrNull(data)) return;

            const { name,isGlobal } = data;
            store.dispatch(async (dispatch,getState) => {
                await dispatch(DOCUMENT.reduxSlices.QUERYFILE.actions.upsertOne({
                    id:name, // generic
                    isGlobal, // generic
                    content:this.soql,
                    alias:this.alias,
                    extra:{
                        useToolingApi:this._useToolingApi === true, // Needed for queries
                    }
                }));
                await dispatch(UI.reduxSlice.actions.linkFileToTab({
                    fileId:name,
                    alias:this.alias,
                    queryFiles:getState().queryFiles
                }));
            });

            // Reset draft

        })
    }

    handleMonacoSave = (e) => {
        e.stopPropagation();
        const { ui } = store.getState();
        const file = ui.currentTab.fileId?SELECTORS.queryFiles.selectById(store.getState(),lowerCaseKey(ui.currentTab.fileId)):null;
        if(isNotUndefinedOrNull(file)){
            // Existing file
            store.dispatch(async (dispatch,getState) => {
                await dispatch(DOCUMENT.reduxSlices.QUERYFILE.actions.upsertOne({
                    ...file,
                    content:this.soql
                }))
                await dispatch(UI.reduxSlice.actions.linkFileToTab({
                    fileId:file.id,
                    alias:file.alias,
                    queryFiles:getState().queryFiles
                }));
            })
            
        }
    }

    handleRowSelection = (e) => {
        const { describe } = store.getState();
        console.log('describe',describe);
        const {rows,isChildTable} = e.detail;
        if(isChildTable){
            this.selectedChildRecords = rows;
        }else{
            this.selectedRecords = rows;
        }
        console.log('handleRowSelection',rows,isChildTable)
    } 

    deleteSelectedRecords = async (e) => {
        const { describe } = store.getState();
        const customMessages = [];
        let _sobject,_sobjectChild; 
        if(this.selectedRecords.length > 0){
            const _item = this.selectedRecords[0];
            _sobject = describe.prefixMap[_item.Id.substr(0,3)];
            if(_sobject){
                customMessages.push(`${this.selectedRecords.length} ${this.selectedRecords.length == 1 ? _sobject.label:_sobject.labelPlural}`)
            }
        }
        if(this.selectedChildRecords.length > 0){
            const _item = this.selectedChildRecords[0];
            _sobjectChild = describe.prefixMap[_item.Id.substr(0,3)];
            if(_sobjectChild){
                customMessages.push(`${this.selectedChildRecords.length} ${this.selectedChildRecords.length == 1 ? _sobjectChild.label:_sobjectChild.labelPlural}`)
            }
        }
        const params = {variant: 'headerless',message: `Are you sure that you want to delete ${customMessages.join(' & ')}?`}
        if(!await LightningConfirm.open(params)) return;
        store.dispatch(APPLICATION.reduxSlice.actions.startLoading());

        // Child
        const retChild  = await this.deleteRecords(_sobjectChild,this.selectedChildRecords) || [];
        // Parent
        const retParent = await this.deleteRecords(_sobject,this.selectedRecords) || [];

        for (const ret of [...retChild,...retParent]) {
            if (ret.success) {
                console.log(`Deleted Successfully : ${ret.id}`);
            }else{
                console.error(ret);
            }
        }
        store.dispatch(APPLICATION.reduxSlice.actions.stopLoading());
    }


    /** Copy & Download */

    

    copyCSV = async (e) => {
        const data = await this.generateCsv();
        navigator.clipboard.writeText(data);
        Toast.show({
            label: `CSV exported to your clipboard`,
            variant:'success',
        });
    }

    copyExcel = async (e) => {
        const data = await this.generateCsv("\t");
        navigator.clipboard.writeText(data);
        Toast.show({
            label: `Excel exported to your clipboard`,
            variant:'success',
        });
    }

    copyJSON = async (e) => {
        await this._fetchSubsequentRecords(this._responseNextRecordsUrl);
        navigator.clipboard.writeText(JSON.stringify(this._responseRows, null, 4));
        Toast.show({
            label: `JSON exported to your clipboard`,
            variant:'success',
        });
    }

    downloadCSV = async (e) => {
        try {
            const data = await this.generateCsv(',');
            const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
            const blob = new Blob([bom, data], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const download = document.createElement('a');
                download.href = window.URL.createObjectURL(blob);
                download.download = `${this.sobjectPlurialLabel}.csv`;
                download.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            Toast.show({
                message: this.i18n.OUTPUT_PANEL_FAILED_EXPORT_CSV,
                errors: e
            });
        }
    }

    downloadJSON = async (e) => {
        try {
            await this._fetchSubsequentRecords(this._responseNextRecordsUrl);
            const blob = new Blob([JSON.stringify(this._responseRows, null, 4)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const download = document.createElement('a');
                download.href = window.URL.createObjectURL(blob);
                download.download = `${this.sobjectPlurialLabel}.json`;
                download.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            Toast.show({
                message: this.i18n.OUTPUT_PANEL_FAILED_EXPORT_JSON,
                errors: e
            });
        }
    }

    async generateCsv(separator) {
        await this._fetchSubsequentRecords(this._responseNextRecordsUrl);
        const header = this.refs.output.columns.join(separator);
        const data = this._responseRows
            .map(row => {
                return this.refs.output.columns
                    .map(column => {
                        const value = getFieldValue(column,row);
                        return isObject(value)?JSON.stringify(value.records):value;
                    })
                    .join(separator);
            })
            .join('\n');
        return `${header}\n${data}`;
    }

    async _fetchNextRecords(nextRecordsUrl) {
        if (!nextRecordsUrl) return;
        const res = await this.connector.conn.request({
            method: 'GET',
            url: nextRecordsUrl,
            //headers: salesforce.getQueryHeaders()
        });
        this._responseNextRecordsUrl = res.nextRecordsUrl;
        this._responseRows = [...this._responseRows, ...res.records];
    }

    async _fetchSubsequentRecords(nextRecordsUrl) {
        await this._fetchNextRecords(nextRecordsUrl);
        if (this._responseNextRecordsUrl) {
            await this._fetchSubsequentRecords(this._responseNextRecordsUrl);
        }
    }

    

    /** Storage Files  **/

    handleSelectItem = (e) => {
        e.stopPropagation();
        const { ui,queryFiles } = store.getState();
        const { id,content,category,extra } = e.detail;
        // Check if tab is already open with
        if(category === CATEGORY_STORAGE.SAVED){
            // Check if tab is already open or create new one
            
            const tabs = ui.tabs;
            const existingTab = tabs.find(x => compareString(x.fileId,id));
            if(existingTab){
                // Existing tab
                store.dispatch(UI.reduxSlice.actions.selectionTab(existingTab));
            }else{
                store.dispatch(UI.reduxSlice.actions.addTab({
                    tab:{
                        id:guid(),
                        body:content,
                        fileId:id
                    },
                    queryFiles
                }));
            }
        }else if(category === CATEGORY_STORAGE.RECENT){
            // Open in existing tab
            if(ui.currentTab.fileId){
                store.dispatch(UI.reduxSlice.actions.addTab({
                    tab:{
                        id:guid(),
                        body:content
                    }
                }));
            }else{
                store.dispatch(UI.reduxSlice.actions.updateSoql({
                    connector:this.queryConnector,
                    soql:content
                }));
            }
            
        }else{
            console.warn(`${category} not supported !`);
        }

        

    }

    handleRemoveItem = (e) => {
        e.stopPropagation();
        const { id } = e.detail;
        store.dispatch(DOCUMENT.reduxSlices.QUERYFILE.actions.removeOne(id))
    }

    /** Getters **/

    get pageClass(){//Overwrite
        return super.pageClass+' slds-p-around_small';
    }
    
    get sobjectsPanelClass() {
        return this.selectedSObject ? 'slds-hide' : '';
    }

    get isFieldsPanelDisplayed(){
        return isNotUndefinedOrNull(this.selectedSObject);
    }

    get toggleLeftIconName(){
        return this.isLeftToggled?'utility:toggle_panel_right':'utility:toggle_panel_left';
    }

    get toggleRecentVariant(){
        return this.isRecentToggled?'brand':'bare';
    }

    get queryConnector(){
        return this.useToolingApi?this.connector.conn.tooling:this.connector.conn;
    }

    get isMetaDisplayed(){
        return isNotUndefinedOrNull(this._response);
    }

    get totalRecords(){
        return this._response?.totalSize;
    }
    
    get sobjectPlurialLabel(){
        return this._sobject?.labelPlural;
    }

    get isDownloadDisabled(){
        return isUndefinedOrNull(this._response);
    }

    get isDeleteDisabled(){
        return this.selectedRecords.length == 0 && this.selectedChildRecords.length == 0;
    }


}