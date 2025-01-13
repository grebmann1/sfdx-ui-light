import { api,track,wire } from "lwc";
import ToolkitElement from 'core/toolkitElement';
import { CurrentPageReference,NavigationContext, generateUrl, navigate } from 'lwr/navigation';
import { isUndefinedOrNull,isNotUndefinedOrNull,classSet,isEmpty,runActionAfterTimeOut,getRecordId,isSalesforceId } from 'shared/utils';
import { store,connectStore,RECORDVIEWER,DOCUMENT } from 'core/store';
import moment from 'moment';
import Toast from 'lightning/toast';
import { CATEGORY_STORAGE } from 'builder/storagePanel';

export default class App extends ToolkitElement {
    

    _hasRendered = false;
    isLoading = false;
    _loadingMessage;

    // Tabs
    @track tabs = [];
    currentTab;

    // Record
    @track recordId;
    @track record; // value populated by the recordExplorer component
    @track recordType;
    @track refreshedDate;
    @track hasError = false;

    // Interval
    _headerInterval;

    // Search Input
    @track searchInputValue;
    // Filter Input
    @track filterInputValue;

    // Recent
    @track isRecentToggled = false;
    recentRecordItems = [];


    _pageRef;
    @wire(CurrentPageReference)
    handleNavigation(pageRef){
        if(isUndefinedOrNull(pageRef)) return;
        if(JSON.stringify(this._pageRef) == JSON.stringify(pageRef)) return;
        
        const applicationName = pageRef?.state?.applicationName || '';
        if(applicationName.toLowerCase() == 'recordviewer'){
            this._pageRef = pageRef;
            this.loadFromNavigation(pageRef);
        }
    }


    connectedCallback(){
        //this.isLoading = true;
        this.header_enableAutoDate();
    }

    renderedCallback(){
        this._hasRendered = true;
        if(this.refs.recordViewerTab){
            this.refs.recordViewerTab.activeTabValue = this.currentTab?.id;
        }
    }

    disconnectedCallback() {
       clearInterval(this._headerInterval);
    }

    @wire(connectStore, { store })
    storeChange({ recordViewer,application,recents }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if(!isCurrentApp) return;

        this.tabs = recordViewer.tabs;
        this.currentTab = recordViewer.currentTab;
        this.isRecentToggled = recordViewer.recentPanelToggled;
        //this.isLoading = true

        if(isNotUndefinedOrNull(this.currentTab)){
            this.recordId = this.currentTab.id;
            this.record = this.currentTab.record;
            this.refreshedDate = this.currentTab.refreshedDate;
            this.recordType = this.currentTab.recordType;
            this.header_formatDate();
        }else{
            this.recordId = null;
            this.record = null;
            this.refreshedDate = null;
            this.recordType = null;
        }

        // Recent API
        if (recents && recents.recordViewers) {
            this.recentRecordItems = recents.recordViewers.map((item, index) => {
                return { 
                    id: `${index}`, 
                    content: `${item.sobjectName} • ${item.recordId}`, 
                    extra : item // see if no conflict with the code builder component 
                };
            });
        }
    }

	/** Methods  **/

    loadFromNavigation = ({state}) => {
        const { recordId }  = state;
        if(isNotUndefinedOrNull(recordId)){
            this.hasError = false;
            const tab = RECORDVIEWER.formatTab({id:recordId});
            store.dispatch(RECORDVIEWER.reduxSlice.actions.upsertTab({tab}));
        }
    }

    header_formatDate = () => {
        this.refreshedDateFormatted = this.refreshedDate?moment(this.refreshedDate).fromNow():null;
    }

    header_enableAutoDate = () => {
        this.header_formatDate();
        this._headerInterval = setInterval(() =>{
            this.header_formatDate();
        },30000);
    }

    /** Events **/

    executeSearchClick = (e) => {
        // Extract the record id
        const recordId = isSalesforceId(this.searchInputValue)?this.searchInputValue:getRecordId(this.searchInputValue);
        if(isUndefinedOrNull(recordId)){
            Toast.show({
                label: `No valid recordId`,
                variant:'error',
                mode:'dismissible'
            });
        }else{
            const tab = RECORDVIEWER.formatTab({id:recordId});
            store.dispatch(RECORDVIEWER.reduxSlice.actions.upsertTab({tab}));
            this.searchInputValue = null; // reset
        }
    }

    searchInput_handleChange = (e) => {
        this.searchInputValue = e.detail.value;
    }

    filterInput_handleChange = (e) => {
        this.filterInputValue = e.detail.value;
        runActionAfterTimeOut(e.detail.value, (newValue) => {
            if(this.refs.recordViewerExplorer){
                this.refs.recordViewerExplorer.updateFilter(newValue);
            }
        }, 400);
    }

    handleRecordExplorerDataLoad = (e) => {
        const { record,refreshedDate,recordType,success,recordId } = e.detail;
        this.hasError = !success;
        if(this.hasError)return;

        const tab = RECORDVIEWER.formatTab({
            id:recordId,
            record,
            recordType,
            refreshedDate
        });
        // Add to Recent Panel :
        store.dispatch(DOCUMENT.reduxSlices.RECENT.actions.saveRecordViewers({
            item:{
                recordId:recordId,
                sobjectName:record?.attributes?.type
            }, 
            alias:this.connector.conn.alias,
        }));
        store.dispatch(RECORDVIEWER.reduxSlice.actions.upsertTab({tab}));
    }

    /** Tabs */


    handleSelectTab = (e) => {
        const tabId = e.target.value;
        store.dispatch(RECORDVIEWER.reduxSlice.actions.selectionTab({id:tabId,alias:this.alias}));
    }

    handleCloseTab = async (e) => {
        const tabId = e.detail.value;
        store.dispatch(RECORDVIEWER.reduxSlice.actions.removeTab({id:tabId}));
    }

    /** Storage Files */

    handleRecentToggle = () => {
        store.dispatch(RECORDVIEWER.reduxSlice.actions.updateRecentPanel({
            value:!this.isRecentToggled,
            alias:this.alias,
        }));
    }
    
    handleSelectItem = (e) => {
        e.stopPropagation();
        const { id,content,category,extra } = e.detail;
        // Check if tab is already open with
        if(category === CATEGORY_STORAGE.RECENT){
            // Open in new tab
            const tab = RECORDVIEWER.formatTab({id:extra.recordId});
            store.dispatch(RECORDVIEWER.reduxSlice.actions.upsertTab({tab}));
        }else{
            console.warn(`${category} not supported !`);
        }
    }
    

    handleRemoveItem = (e) => {
        e.stopPropagation();
        const { id } = e.detail;
        store.dispatch(DOCUMENT.reduxSlices.APIFILE.actions.removeOne(id))
    }

    
    /** Getters */

    get isEmptyTab(){
        return this.tabs.length === 0;
    }

    get isSearchButtonDisabled(){
        return isEmpty(this.searchInputValue);
    }

    get isNoRecord(){
        return isUndefinedOrNull(this.record) && isNotUndefinedOrNull(this.recordId) && this.hasError;
    }

    get isMetaDisplayed(){
        return isNotUndefinedOrNull(this.record);
    }

    get isViewerDisplayed(){
        return isNotUndefinedOrNull(this.recordId);
    }

    get hasRecordType(){
        return isNotUndefinedOrNull(this.recordType);
    }

    get pageClass(){//Overwrite
        return super.pageClass+' slds-p-around_small';
    }

    get formattedTabs(){
        return this.tabs.map((x,index) => {
            return {
                ...x,
                name:x.record?.Name || x.id,
                class:classSet('slds-tabs_scoped__item').add({'slds-is-active':x.id === this.recordId}).toString()
            }
        })
    }

    get recordName(){
        return this.record?.Name;
    }
}