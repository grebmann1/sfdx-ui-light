import { api,track,wire } from "lwc";
import { decodeError,guid,runActionAfterTimeOut,lowerCaseKey,compareString,isEmpty,isNotUndefinedOrNull,isUndefinedOrNull,classSet,normalizeString as normalize,prettifyXml,autoDetectAndFormat } from 'shared/utils';
import Toast from 'lightning/toast';
import ToolkitElement from 'core/toolkitElement';
import { connectStore,store,API,DOCUMENT,SELECTORS } from 'core/store';
import { CATEGORY_STORAGE } from 'builder/storagePanel';
import { DEFAULT,VIEWERS,METHOD,TABS, generateDefaultTab,formattedContentType } from 'api/utils';
import SaveModal from "builder/saveModal";
import moment from 'moment';
import LightningConfirm from 'lightning/confirm';





export default class App extends ToolkitElement {

    isLoading = false;

    @track formattedRequests = [];
    @track endpoint;
    @track method;
    @api header;
    @api body;

    // Undo/Redo
    @track actions = [];
    actionPointer = 0;
    isEditing = false;

    currentModel;

    // Aborting
    _abortingMap = {};
    isApiRunning = false;

    // Changes
    currentFile;
    isDraft = false;

    // Recent & Saved
    @track isRecentToggled = false;
    recentApiItems = [];
    savedApiItems = [];

    // Content
    @track content;
    @track contentType = 'json';
    @track contentHeaders = [];
    @track statusCode;
    @track executionStartDate;
    @track executionEndDate;

    // Viewer
    viewer_value = VIEWERS.PRETTY;

    // Tabs
    @track tabs = [];
    currentTab;

    // Viewer Tab
    tab_current = TABS.BODY;

    // Interval
    _loadingInterval;
    _loadingMessage;

    connectedCallback(){
        this.isFieldRendered = true;
        store.dispatch((dispatch, getState) => {
            dispatch(API.reduxSlice.actions.updateCurrentApiVersion({
                alias:this.alias,
                version:this.currentApiVersion
            }));
            dispatch(API.reduxSlice.actions.loadCacheSettings({
                alias:this.alias,
                apiFiles:getState().apiFiles
            }));
            dispatch(DOCUMENT.reduxSlices.APIFILE.actions.loadFromStorage({
                alias:this.alias
            }));
            dispatch(API.reduxSlice.actions.initTabs({
                apiFiles:getState().apiFiles
            }));
        })
    }

    renderedCallback(){
        this._hasRendered = true;

        if(this.refs.resultTab){
            this.refs.resultTab.activeTabValue = this.tab_current;
        }

        if(this.refs.requestTab){
            this.refs.requestTab.activeTabValue = this.currentTab?.id;
        }
    }

    @wire(connectStore, { store })
    storeChange({ application,api,recents,apiFiles }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if(!isCurrentApp) return;
        // if(api){}
        this.tab_current = api.viewerTab;
        this.isRecentToggled = api.recentPanelToggled;
        this.tabs = api.tabs;
        this.currentTab = api.currentTab;
        if(api.currentTab && this._hasRendered){
            //this.currentTab = api.currentTab;
            if(this.currentTab.fileId != this.currentFile?.id){
                this.currentFile = SELECTORS.apiFiles.selectById({apiFiles},lowerCaseKey(this.currentTab.fileId));
            }
        }
        // Variables (Need to handle some exceptions)
        if(this.body != api.body){
            this.body = api.body;
            if(this._hasRendered && this.refs.bodyEditor && this.refs.bodyEditor.currentModel){
                this.refs.bodyEditor.currentModel.setValue(this.body);
            }
        }
        if(this.method != api.method){
            this.method = api.method;
            if(this._hasRendered){
                this.refs.method.value = this.method;
            }
            
        }
        if(this.header != api.header){
            this.header = api.header;
            if(this._hasRendered){
                this.template.querySelector('.slds-textarea-header').value = this.header;
            }
        }
        if(this.endpoint != api.endpoint){
            this.endpoint = api.endpoint;
            if(this._hasRendered){
                this.refs.method.endpoint = this.endpoint;
            }
        }

        // Actions
        this.actions        = api.actions || [];
        this.actionPointer  = api.actionPointer || 0;

        // Api State
        const apiState = SELECTORS.api.selectById({api},lowerCaseKey(api.currentTab?.id));
        if(apiState){
            this.isApiRunning = apiState.isFetching;
            if(this.isApiRunning){
                this.loading_enableAutoDate(apiState.createdDate);
            }else{
                if(this._loadingInterval) clearInterval(this._loadingInterval);
            }
            if(apiState.error){
                this._abortingMap[api.currentTab.id] = null; // Reset the abortingMap
                this.resetResponse();
                ////this.global_handleError(apiState.error)
            }else if(apiState.response){
                // Reset First
                ////this.resetError();
                ////this.resetEditorError();

                // Assign Data
                this.statusCode = apiState.response.statusCode;
                this.contentType = apiState.response.contentType;
                this.contentHeaders = apiState.response.contentHeaders;
                this.executionStartDate = apiState.response.executionStartDate;
                this.executionEndDate   = apiState.response.executionEndDate;
                if(this.content != apiState.response.content){
                    this.content = apiState.response.content;
                    this.updateContentEditor();
                }
                
                

                this._abortingMap[api.currentTab.id] = null; // Reset the abortingMap`
                ////this.header_formatDate();
                // Handle Error from Salesforce
                if(!apiState.response.statusCode <= 400 /**&& apexState.data.compiled**/){
                    ////this.handleError(apiState.data);
                }
            }else if(apiState.isFetching){
                this.resetResponse();
                ////this.resetError();
                ////this.resetEditorError();
            }
        }else {
            this.resetResponse();
            ////this.resetError();
            ////this.resetEditorError();
            this.isLoading = false;
            //if(this._loadingInterval) clearInterval(this._loadingInterval);
        }

        // Recent API
        if (recents && recents.api) {
            this.recentApiItems = recents.api.map((item, index) => {
                return { 
                    id: `${index}`, 
                    content: `${item.method} • ${item.endpoint}`, 
                    extra : item // see if no conflict with the code builder component 
                };
            });
        }

        /** Saved API */    
        if (apiFiles) {
            const entities = SELECTORS.apiFiles.selectAll({apiFiles});
            this.savedApiItems = entities.filter(item => item.isGlobal || item.alias == this.alias).map((item, index) => {
                return item; // no mutation for now
            });
        }
    }


    /** Methods  **/

    executeAPI = () => {
        const _originalRequest = this.currentRequestToStore;
        const _formattedRequest = this.formatRequest();
        if(isUndefinedOrNull(_formattedRequest)) return;

        this.isApiRunning = true;
        // Execute
        const apiPromise = store.dispatch(API.executeApiRequest({
            connector:this.connector,
            request:_originalRequest,
            formattedRequest:_formattedRequest,
            tabId:this.currentTab.id,
            createdDate:Date.now()
        }));

        this._abortingMap[this.currentTab.id] = apiPromise;
    }
    

    reassignAction = () => {
        const action = this.actions[this.actionPointer];
        if(action){
            this.body = action.request.body;
            this.method = action.request.method;
            this.endpoint = action.request.endpoint;
            this.header = action.request.header;
            this.statusCode = action.response.statusCode;
            this.contentType = action.response.contentType;
            this.contentHeaders = action.response.contentHeaders;
            this.executionStartDate = action.response.executionStartDate;
            this.executionEndDate   = action.response.executionEndDate;
            this.content = action.response.content;
            this.updateContentEditor();
        }else{  
            this.reset_click();
        }
        
        // Update fields directly (LWC issues)
        this.forceDomUpdate();

    }

    forceDomUpdate = () => {
        this.refs.method.value      = this.method;
        this.refs.method.endpoint   = this.endpoint;
        this.template.querySelector('.slds-textarea-header').value = this.header;
        this.refs.bodyEditor.currentModel.setValue(this.body);
        if(this.refs.contentEditor){
            //this.refs.contentEditor.currentModel.setValue(this.content);
        }
    }

    replaceVariableValues = (text) => {
        if(isEmpty(text)) return text;
        // Todo: Enhance this to provide more variables
        return text.replace(/{sessionId}/g, this.connector.conn.accessToken);
    }

    formatRequest = () => {
        // Ensure the endpoint starts with a leading slash if not a full URL
        const formattedEndpoint = this.endpoint.startsWith('/') ? this.endpoint : `/${this.endpoint}`;
    
        // If the endpoint is a full URL, use it, otherwise, prepend the instance URL
        const targetUrl = this.endpoint.startsWith('http') ? this.endpoint : `${this.connector.conn.instanceUrl}${formattedEndpoint}`;
    
        // Create the base request object with method and URL
        const request = {
            method: this.method,
            url: targetUrl,
        };
    
        // Include body for PATCH, POST, or PUT requests
        if ([METHOD.PATCH, METHOD.POST, METHOD.PUT].includes(this.method)) {
            request.body = this.replaceVariableValues(this.body);
        }
        
    
        // Process headers if they are defined
        if (isNotUndefinedOrNull(this.header)) {
            const headers = {};
            let isValidHeader = true;
    
            // Clean up the header string and process each line
            this.header
                .replace(/^\s*[\r\n]/gm, "") // Remove empty lines
                .trim()
                .split('\n')
                .forEach(line => {
                    const lineArr = line.split(':');
                    if (lineArr.length >= 2) {
                        const key = lineArr.shift().trim(); // Get the header name
                        headers[key] = lineArr.join(':').trim(); // Combine the remaining parts of the header value
                        headers[key] = this.replaceVariableValues(headers[key]);
                    } else {
                        isValidHeader = false; // Flag invalid header
                    }
                });
    
            // If any headers are invalid, show a toast notification
            if (!isValidHeader) {
                Toast.show({
                    label: `Invalid Header`,
                    variant: 'error',
                    mode: 'dismissible',
                });
                return null;
            } else {
                // Add headers to the request if valid and not empty
                if (Object.keys(headers).length > 0) {
                    request.headers = {
                        ...request.headers,
                        ...headers,
                    };
                }
            }
        }
    
        return request; // Return the formatted request object
    };
    

    decreaseActionPointer = () => {
        store.dispatch(API.reduxSlice.actions.decreaseActionPointer({
            tabId:this.currentTab?.id,
            alias:this.alias,
        }));
    }

    increaseActionPointer = () => {
        store.dispatch(API.reduxSlice.actions.increaseActionPointer({
            tabId:this.currentTab?.id,
            alias:this.alias,
        }));
    }

    injectHTML = () => {
        const iframe = this.template.querySelector('iframe');
        const iframeDocument = iframe.contentWindow.document;

        // Check if the content type is an image (e.g., PNG or JPG)
        if (['png','jpeg','jpg'].includes(formattedContentType(this.contentType))) {

        } else {
            // If it's not an image, inject the content as HTML
            iframeDocument.open();
            iframeDocument.write(this.formattedContent);
            iframeDocument.close();
        }
    }

    // API State Processing
    resetResponse = () => {
        this.content        = null;
        this.statusCode     = null;
        this.contentHeaders = null;
        this.contentType    = null;
        this.executionStartDate = null;
        this.executionEndDate = null;
    }

    // Loading
    
    loading_formatDate = (createdDate) => {
        this._loadingMessage = `Running for ${moment().diff(moment(createdDate), 'seconds')} seconds`;
    }

    loading_enableAutoDate = (createdDate) => {
        if(this._loadingInterval) clearInterval(this._loadingInterval);
        this.loading_formatDate(createdDate);
        this._loadingInterval = setInterval(() =>{
            this.loading_formatDate(createdDate);
        },1000);
    }

    /** Events **/

    initBodyEditor = () => {
        const newModel = this.refs.bodyEditor.createModel({
            body:this.body,
            language:autoDetectAndFormat(this.body) || 'txt' // Language should be improved in the editor
        });
        this.refs.bodyEditor.displayModel(newModel);
    }

    initContentEditor = () => {
        if(!this._hasRendered || !this.refs.contentEditor) return;
        //this.isLoading = false;
        this.currentModel = this.refs.contentEditor.createModel({
            body:this.formattedContent,
            language:formattedContentType(this.contentType)
        });
        this.refs.contentEditor.displayModel(this.currentModel);
    }

    updateContentEditor = () => {
        if(!this._hasRendered || !this.refs.contentEditor || isUndefinedOrNull(this.currentModel) || isUndefinedOrNull(this.refs.contentEditor.currentModel)) return;
        this.refs.contentEditor.currentModel.setValue(this.formattedContent);
        this.refs.contentEditor.currentMonaco.editor.setModelLanguage(this.refs.contentEditor.currentModel, formattedContentType(this.contentType));
    }


    viewer_handleChange = (e) => {
        this.viewer_value = e.detail.value;
    }

    viewer_handleSelectTab = (event) => {
        store.dispatch(API.reduxSlice.actions.updateViewerTab({
            value:event.target.value,
            alias:this.alias,
        }));
    }

    

    undo_click = () => {
         if(this.actions.length > 0 && this.actions.length > this.actionPointer){
            this.decreaseActionPointer();
            this.reassignAction();
        }
    }

    redo_click = () => {
        if(this.actions.length > 0 && this.actions.length -1 >= this.actionPointer){
            this.increaseActionPointer();
            this.reassignAction();
        }
    }


    reset_click = (e) => {
        store.dispatch(API.reduxSlice.actions.resetTab({
            tabId:this.currentTab?.id,
            alias:this.alias,
        }));
    }

    updateRequestStates = (e) => {
        const { api } = store.getState();
        runActionAfterTimeOut(e,async (lastEvent) => {
            const _newDraft = (
                this.currentFile 
                && (
                    this.currentFile.extra?.body != this.body
                    || this.currentFile.extra?.method != this.method
                    || this.currentFile.extra?.endpoint != this.endpoint
                    || this.currentFile.extra?.header != this.header
                )
            ) === true // enforce boolean
            if (this.body !== api.body || this.method !== api.method || this.endpoint !== api.endpoint || this.header !== api.header || this.draft != _newDraft) {
                this.draft = _newDraft;
                store.dispatch(API.reduxSlice.actions.updateRequest({
                    ...this.currentRequestToStore,
                    connector:this.connector,
                    tabId:this.currentTab.id,
                    isDraft:_newDraft // update the draft status
                }));
                // Reset Error
                /*if(isNotUndefinedOrNull(this.hasEditorError)){
                    this.resetEditorError();
                }*/
            }
        },{timeout:500});
    }

    endpoint_change = (e) => {
        this.endpoint = e.detail.value;
        this.updateRequestStates(e);
    }

    method_change = (e) => {
        this.method = e.detail.value;
        this.updateRequestStates(e);
    }

    body_change = (e) => {
        if(this.body == e.detail.value) return;
        this.body = e.detail.value;
        this.updateRequestStates(e);
    }

    header_change = (e) => {
        this.header = e.target.value;
        this.updateRequestStates(e);
    }

    handle_customLinkClick = (e) => {
        // Assuming it's always GET method
        this.endpoint = e.detail.url;
        this.method = METHOD.GET;
        this.body = DEFAULT.BODY // Reset Body
        //this.header = DEFAULT.HEADER;
        //this.updateRequestStates(e);
        store.dispatch(API.reduxSlice.actions.updateRequest({
            ...this.currentRequestToStore,
            connector:this.connector,
            tabId:this.currentTab?.id
        }));
        //this.forceDomUpdate();
        this.executeAPI();
    }

    handle_downloadClick = () => {
        try {
            const blob = new Blob([this.formattedContent], { type: this.contentType });
            const url = URL.createObjectURL(blob);
            const download = document.createElement('a');
                download.href = window.URL.createObjectURL(blob);
                download.download = `${Date.now()}.${formattedContentType(this.contentType)}`;
                download.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            Toast.show({
                message: 'Failed Exporting JSON',
                errors: e
            });
        }
    }

    handleSaveClick = () => {
        console.log('save click');
        
        const { api } = store.getState();
        const file = api.currentTab.fileId?SELECTORS.apiFiles.selectById(store.getState(),lowerCaseKey(api.currentTab.fileId)):null;
        SaveModal.open({
            title:'Save API Request',
            _file:file
        }).then(async data => {
            if(isUndefinedOrNull(data)) return;
            const item = this.currentRequestToStore;
            const { name,isGlobal } = data;
            store.dispatch(async (dispatch,getState) => {
                await dispatch(DOCUMENT.reduxSlices.APIFILE.actions.upsertOne({
                    id:name, // generic
                    isGlobal, // generic
                    content:null,
                    alias:this.alias,
                    extra:item
                }));
                const apiFiles = getState().apiFiles;
                await dispatch(API.reduxSlice.actions.linkFileToTab({
                    fileId:name,
                    alias:this.alias,
                    apiFiles
                }));
            });

            // Reset draft

        })
    }

    /** Tabs */

    handleAddTab = (e) => {
        const tab = generateDefaultTab(this.currentApiVersion);
        store.dispatch(API.reduxSlice.actions.addTab({tab}));
    }

    handleSelectTab = (e) => {
        const tabId = e.target.value;
        store.dispatch(API.reduxSlice.actions.selectionTab({id:tabId,alias:this.alias}));
    }

    handleCloseTab = async (e) => {
        const tabId = e.detail.value;
        const currentTab = this.tabs.find(x => x.id === tabId);
        const params = {variant: 'headerless',message: 'This request has unsaved changes ! Do you want delete it ?'}
        if(!currentTab.isDraft || currentTab.isDraft && isUndefinedOrNull(currentTab.fileId) || currentTab.isDraft && await LightningConfirm.open(params)){
            store.dispatch(API.reduxSlice.actions.removeTab({id:tabId,alias:this.alias}));
        }
    }

    /** Storage Files */

    handleRecentToggle = () => {
        store.dispatch(API.reduxSlice.actions.updateRecentPanel({
            value:!this.isRecentToggled,
            alias:this.alias,
        }));
    }
    
    handleSelectItem = (e) => {
        e.stopPropagation();
        const { api,apiFiles } = store.getState();
        const { id,content,category,extra } = e.detail;
        // Check if tab is already open with
        if(category === CATEGORY_STORAGE.SAVED){
            // Check if tab is already open or create new one
            
            const tabs = api.tabs;
            const existingTab = tabs.find(x => compareString(x.fileId,id));
            if(existingTab){
                // Existing tab
                store.dispatch(API.reduxSlice.actions.selectionTab(existingTab));
            }else{
                const tab = generateDefaultTab(this.currentApiVersion);
                    tab.body = extra.body;
                    tab.header = extra.header;
                    tab.method = extra.method;
                    tab.endpoint = extra.endpoint;
                    tab.fileId = id
                store.dispatch(API.reduxSlice.actions.addTab({tab,apiFiles}));
            }
        }else if(category === CATEGORY_STORAGE.RECENT){
            // Open in new tab
            const tab = generateDefaultTab(this.currentApiVersion);
                tab.body = extra.body;
                tab.header = extra.header;
                tab.method = extra.method;
                tab.endpoint = extra.endpoint;

            store.dispatch(API.reduxSlice.actions.addTab({tab}));
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

    get currentApiVersion(){
        return this.connector.conn.version || '60.0';
    }

    get formattedTabs(){
        return this.tabs.map((x,index) => {
            return {
                ...x,
                name:x.fileId || `Request ${index + 1}`,
                isCloseable:this.tabs.length > 1,
                class:classSet('slds-tabs_scoped__item').add({'slds-is-active':x.path === this.currentFile}).toString()
            }
        })
    }

    get currentRequestToStore(){
        return {
            endpoint    : this.endpoint,
            method      : this.method,
            body        : this.body,
            header      : this.header,
        };
    }

    get currentRequestWithActions(){
        return {
            ...this.currentRequestToStore,
            actions       : this.actions,
            actionPointer : this.actionPointer
        }
    }

    get currentRequestWithContent(){
        return {
            ...this.currentRequestToStore,
            content:this.content
        }
    }

    get duration(){
        let total = this.executionEndDate - this.executionStartDate;
        return moment(total || 0).millisecond();
    }

    get isUndoDisabled(){
        return this.actionPointer <= 0;
    }

    get isRedoDisabled(){
        return this.actionPointer >= this.actions.length - 1;
    }

    get isBodyDisabled(){
        return this.method == METHOD.GET || this.method == METHOD.DELETE || this.isLoading;
    }

    get isHeaderDisabled(){
        return this.isLoading;
    }

    get isBodyDisplayed(){
        return this.tab_normalizedCurrent === TABS.BODY;
    }

    get isHeadersDisplayed(){
        return this.tab_normalizedCurrent === TABS.HEADERS;
    }

    get method_options(){
        return Object.keys(METHOD).map(x => ({label:x,value:x}))
    }

    get isExecuteApiDisabled(){
        return false;
    }

    get contentLength(){
        if(isUndefinedOrNull(this.content)) return 0;
        //5726285
        return (new TextEncoder()).encode(JSON.stringify(this.content)).length;
    }

    get isContentDisplayed(){
        return isNotUndefinedOrNull(this.content);
    }

    get isFormattedContentDisplayed(){
        return this.contentLength < 100000;
    }

    get formattedContent(){
        if(typeof this.content === 'object' && isNotUndefinedOrNull(this.content)){
            return JSON.stringify(this.content, null, 4);
        }else if (this.formattedContentType === 'xml'){
            return prettifyXml(this.content);
        }
        return this.content;
    }

    get formattedContentType(){
        return formattedContentType(this.contentType);
    }

    get pageClass(){
        return super.pageClass+' slds-p-around_small';
    }

    get prettyContainerClass(){
        return classSet("slds-full-height slds-scrollable_y").add({'slds-hide':!(this.viewer_value === VIEWERS.PRETTY)}).toString();
    }


    get rawContainerClass(){
        return classSet("slds-full-height slds-scrollable_y").add({'slds-hide':!(this.viewer_value === VIEWERS.RAW)}).toString();
    }

    get previewContainerClass(){
        return classSet("slds-full-height slds-scrollable_y").add({'slds-hide':!(this.viewer_value === VIEWERS.PREVIEW)}).toString();
    }

    get viewer_options(){
        return Object.values(VIEWERS).map(x => ({value:x,label:x}))
    }

    get tab_normalizedCurrent(){
        return normalize(this.tab_current, {
            fallbackValue: TABS.BODY,
            validValues: [TABS.BODY,TABS.HEADERS],
            toLowerCase:false
        });
    }

    get PAGE_CONFIG(){
        return {
            TABS
        }
    }

    get badgeClass(){
        return (this.statusCode < 400 ? 'slds-theme_success': 'slds-theme_error');
    }

    get isSaveButtonDisabled(){
        return this.isLoading;
    }
}