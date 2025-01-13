import { api, wire, track } from "lwc";
import ToolkitElement from 'core/toolkitElement';
import { isEmpty, isElectronApp, isSalesforceId, classSet, isUndefinedOrNull, isNotUndefinedOrNull, runActionAfterTimeOut, formatFiles, sortObjectsByField, removeDuplicates } from 'shared/utils';
import { getWorker } from 'core/worker';
import jsonview from '@pgrabovets/json-view';
import Toast from 'lightning/toast';
import { CurrentPageReference, NavigationContext, generateUrl, navigate } from 'lwr/navigation';
import { store,connectStore,METADATA,APPLICATION } from 'core/store';

const METADATA_EXCLUDE_LIST = ['Flow', 'FlowDefinition'];

export default class App extends ToolkitElement {
    @wire(NavigationContext)
    navContext;

    @track isLoadingRecord = false;

    @track flowVersion_options = [];
    flowVersion_value;


    sobject;
    @track files;
    @track selectedRecord;
    currentTabId;

    //@track selection = {};
    //@track items = {}
    isEditorDisplayed = false;

    // Filters
    @track menuItems = [];
    keepFilter = false;



    // Tabs
    @track tabs = [];

    // Mode
    advancedMode = false;

    // Worker
    metadataResult;
    tasks = {};
    error;

    _hasRendered = false;


    _pageRef;
    @wire(CurrentPageReference)
    handleNavigation(pageRef) {
        if (isUndefinedOrNull(pageRef)) return;
        //if(JSON.stringify(this._pageRef) == JSON.stringify(pageRef)) return;

        if (pageRef?.state?.applicationName == 'metadata') {
            this._pageRef = pageRef;
            this.loadFromNavigation(pageRef);
        }
    }

    @wire(connectStore, { store })
    storeChange({ metadata,application }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if(!isCurrentApp) return;

        this.tabs = metadata.tabs;
        this.isLoadingRecord = metadata.isLoadingRecord;
        this.sobject = metadata.sobject;
        //this.currentTab = metadata.currentTab;
        
        // Standard Record Viewer
        if(isNotUndefinedOrNull(metadata.selectedRecord)){
            this.selectedRecord = null;
            this.selectedRecord = metadata.selectedRecord;
        }else{
            this.selectedRecord = null;
        }
        
        this.files = metadata.files;
        if(this.currentTabId != metadata.currentTabId){
            if(isNotUndefinedOrNull(this.files) && this.files.length > 0){
                this.displayEditor(this.files);
            }else{
                this.hideEditor();
            }
        }
        this.currentTabId = metadata.currentTabId;
        // Editor Viewer
        
        // Flow Versions
        this.flowVersion_options = metadata.flowVersionOptions || [];
        this.flowVersion_value = metadata.flowVersionValue;
        // update navigation url
        // Disabled for now, creating too many issues !!!
        if(isNotUndefinedOrNull(this.currentTabId) && this.tabs.find(x => x.id === this.currentTabId)){
            const tab = this.tabs.find(x => x.id === this.currentTabId);
            this.updateNavigationUrl(tab.attributes);
        }
        //this.updateNavigationUrl(metadata);
    }

    updateNavigationUrl = ({param1,param2,label1,label2,sobject,developerName}) => {
        const params = {
            applicationName: 'metadata',
            param1,
            param2,
            label1,
            label2,
            sobject,
            developerName,
        };
        
        // Filter out null or undefined values
        const filteredParams = Object.fromEntries(
            Object.entries(params).filter(([key, value]) => isNotUndefinedOrNull(value))
        );
        
        const urlParams = new URLSearchParams(filteredParams);
        
        // Construct the new URL
        const newUrl = `${window.location.origin}${window.location.pathname}?${urlParams.toString()}`;
        //console.log('newUrl',newUrl);
        // Update the URL without navigating
        window.history.pushState(null, '', newUrl);
    }

    loadFromNavigation = async ({ state }) => {
        let { applicationName } = state;
        if (applicationName != 'metadata') return; // Only for metadata
        store.dispatch(METADATA.reduxSlice.actions.setAttributes(state));
    }


    connectedCallback() {

        // Get the singleton instance of the worker
        /*const metadataWorker = getMetadataWorker(this.connector.conn);
            metadataWorker.onmessage = this.handleWorkerMessage.bind(this);
            metadataWorker.postMessage({ action: 'loadFullMetadataSet'});*/

        store.dispatch(async (dispatch, getState) => {
            dispatch(METADATA.reduxSlice.actions.loadCacheSettings({
                alias:this.alias
            }));
            dispatch(METADATA.reduxSlice.actions.initTabs());
        })
    }

    renderedCallback(){
        if(!this._hasRendered){
            this._hasRendered = true;
        }

        // Tab change
        if(this._hasRendered && this.template.querySelector('slds-tabset') && this.currentTabId){
            this.template.querySelector('slds-tabset').activeTabValue = this.currentTabId;
        }
    }

    /** Events */

    flowVersion_handleChange = async (e) => {
        if(e.detail.programmatic) return; // reject if change is coming from value change
        const versionId = e.detail.value;
        const version = this.flowVersion_options.find(x => x.value === versionId);
        //this.load_specificMetadataRecord(versionId,this.currentTab.id,true);
        const {metadata} = store.getState();
        const attributes = {
            param2:versionId,
            label2:version.label,
            param1:metadata.param1,
            sobject:metadata.sobject
        };

        this.updateNavigationUrl(attributes);
        await store.dispatch(METADATA.reduxSlice.actions.setAttributes(attributes));
        await store.dispatch(METADATA.fetchMetadataRecord(attributes))
        /*navigate(this.navContext, {
            type: 'application',
            state: {
                ...this._pageRef.state,
                param2:versionId,
                label2: version.label
            }
        });*/
    }

    handleSelectTab = async (e) => {
        const tabId = e.target.value;
        if(this.currentTabId != tabId){
            await store.dispatch(METADATA.reduxSlice.actions.selectionTab({
                id:tabId
            }));
            const { metadata } = store.getState();
            await store.dispatch(METADATA.fetchSpecificMetadata({ sobject:metadata.sobject }));
        }
        
    }

    handleCloseTab = (e) => {
        const tabId = e.detail.value;
        store.dispatch(METADATA.reduxSlice.actions.removeTab({
            id:tabId
        }));
    }

    handleItemSelection = async (e) => {
        store.dispatch(METADATA.fetchMetadataRecord(e.detail))
        
    }

    handleMenuSelection = (e) => {
        const { name,label } = e.detail;
        const existingState = this.navContext?.state || {};
        const newState = {
            applicationName: 'metadata',
            sobject: name,
        };

        // Filter out redundant state properties
        const filteredState = Object.fromEntries(
            Object.entries(existingState).filter(([key]) => !(key in newState))
        );

        // Merge filtered existing state with the new state
        const finalState = { ...filteredState, ...newState };

        navigate(this.navContext, {
            type: 'application',
            state: finalState,
        });
    }

    goToMetadata = (e) => {
        //this.hideEditor();
        //this.hideJsonViewer();
        /*this.handleMenuSelection({
            detail: {
                name: e.currentTarget.dataset.name,
                label: e.currentTarget.dataset.name
            }
        });*/
        //e.currentTarget.dataset.name
        navigate(this.navContext, {
            type: 'application',
            state: {
                applicationName: 'metadata',
                sobject: e.currentTarget.dataset.name,
            },
        });
    }

    /** Methods */

    displayEditor = (files) => {
        if(this.refs.editor){
            this.refs.editor.displayFiles(this.sobject, files,{
                isTabEnabled:files.length > 1 // only for LWC and Aura
            });
        }
        this.isEditorDisplayed = true;
    }

    hideEditor = () => {
        //this.refs.editor.displayFiles(files);
        this.isEditorDisplayed = false;
    }

    hideJsonViewer = () => {
        if (this.visualizer) {
            try {
                jsonview.destroy(this.visualizer);
            } catch (e) { console.error(e) }
        }
    }

    /** Getters */

    get isFlowPicklistDisplayed(){
        return isNotUndefinedOrNull(this.selectedRecord) && this.selectedRecord.attributes?.type == 'Flow';
    }

    get formattedTabs(){
        return this.tabs.map((x,index) => {
            return {
                ...x,
                isCloseable:this.tabs.length > 1,
                class:classSet('slds-tabs_scoped__item').add({'slds-is-active':x.path === this.currentTabId}).toString()
            }
        })
    }

    get isTabHeaderDisplayed(){
        return this.tabs.length > 0;
    }

    get noRecordMessage() {
        return `This record wasn't found in your metadata.`;
    }

    get pageClass() {
        return super.pageClass + ' slds-p-around_small';
    }

    get editorClass() {
        return classSet("slds-full-height").add({ 'slds-hide': !this.isEditorDisplayed }).toString();
    }

    get isMetadataViewerDisplayed() {
        return isNotUndefinedOrNull(this.selectedRecord);
    }

    get selectedRecordLoadingMessage(){
        return `Loading ${this.sobject}`;
    }

    get isNoRecord(){
        return !this.isLoadingRecord 
            && this.currentTabId != null
            && this.files?.length === 0 
            && isUndefinedOrNull(this.selectedRecord)
    }


    /** Web Worker */

    // Handle messages from the web worker
    handleWorkerMessage = (event) => {
        const { type, action, result, tasks, taskId, message } = event.data;

        switch (type) {
            case 'result':
                if (action === 'fetchMetadata') {
                    this.metadataResult = result;
                }
                break;

            case 'tasks':
                this.tasks = tasks;
                break;

            case 'error':
                this.error = `Error in task ${taskId}: ${message}`;
                break;

            case 'taskUpdate':
                if (this.tasks[taskId]) {
                    this.tasks[taskId].status = event.data.status;
                }
                break;

            case 'taskRemoved':
                delete this.tasks[taskId];
                break;

            default:
                console.error('Unknown message type:', type);
        }
    }

}