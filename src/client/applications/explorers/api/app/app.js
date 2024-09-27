import { api,track,wire } from "lwc";
import { decodeError,isEmpty,isNotUndefinedOrNull,isUndefinedOrNull,classSet,normalizeString as normalize } from 'shared/utils';
import Toast from 'lightning/toast';
import ToolkitElement from 'core/toolkitElement';
import { connectStore,store,API } from 'core/store';
import moment from 'moment';

const METHOD = {
    GET:'GET',
    POST:'POST',
    PUT:'PUT',
    PATCH:'PATCH',
    DELETE:'DELETE'
}


const DEFAULT = {
    HEADER : 'Content-Type: application/json; charset=UTF-8\nAccept: application/json',
    ENDPOINT : '/services/data/v60.0',
    BODY : ''
}

const VIEWERS = {
    PRETTY : 'Pretty',
    RAW : 'Raw',
    PREVIEW : 'Preview'
}

const TABS = {
    BODY:'Body',
    HEADERS:'Headers'
}

export default class App extends ToolkitElement {

    isLoading = false;

    @track formattedRequests = [];
    @track endpoint = DEFAULT.ENDPOINT;
    @track method = METHOD.GET;
    @api header = DEFAULT.HEADER;
    @api body = DEFAULT.BODY;

    // Undo/Redo
    @track actions = [];
    actionPointer = 0;
    isEditing = false;


    currentModel;

    // Content
    @track content;
    @track contentType = 'json';
    @track contentHeaders = [];
    @track statusCode;
    @track executionStartDate;
    @track executionEndDate;

    // Viewer
    viewer_value = VIEWERS.PRETTY;

    // Tab
    tab_current = TABS.BODY;

    connectedCallback(){
        this.isFieldRendered = true;
    }

    renderedCallback(){
        this._hasRendered = true;

        if(this._hasRendered && this.template.querySelector('slds-tabset')){
            this.template.querySelector('slds-tabset').activeTabValue = this.tab_current;
        }
    }

    @wire(connectStore, { store })
    storeChange({ application,api }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if(!isCurrentApp) return;

        if(api){  
            this.tab_current = api.viewerTab;
        }
    }


    /** Methods  **/

    executeAPI = () => {
        
        try{
            const _request = this.formatRequest();
            if(isUndefinedOrNull(_request)) return;

            this.content = null; // reset content
            this.isLoading = true;

            const instance = this.connector.conn.httpApi();
            instance.on('response', async (res) => {
                console.log('response',res);
                // Set Response variables
                this.content = res.body;
                this.statusCode = res.statusCode;
                const _headers = res.headers || {};
                this.contentHeaders = Object.keys(_headers).map(key => ({key,value:_headers[key]}));
                this.contentType = instance.getResponseContentType(res);
                if(this.formattedContentType !== 'xml'){
                    this.content = await instance.getResponseBody(res);
                }

                this.executionEndDate = new Date();
                this.isLoading = false;

                // Simple set of pointer and action (When running, we reset at that pointer position !)
                if(this.actions.length > 0 && this.actionPointer != this.actions.length - 1){
                    this.actions = this.actions.slice(0,this.actionPointer + 1)
                }
                this.actions.push(this.formatAction());
                this.actionPointer = this.actions.length - 1;
            });

            // Execute the request
            this.executionStartDate = new Date();
            instance.request(_request);

        }catch(e){
            this.isLoading = false;
            console.error('caught by the catch',e);
        }
    }
    

    formatAction = () => {
        return {
            body:this.body,
            method:this.method,
            endpoint:this.endpoint,
            header:this.header,
            content:this.content
        }
    }

    reassignAction = () => {
        const action = this.actions[this.actionPointer];
        console.log('this.actions',this.actions);
        if(action){
            console.log('action',action);
            this.body = action.body;
            this.method = action.method;
            this.endpoint = action.endpoint;
            this.header = action.header;
            this.content = action.content;
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
            request.body = this.body;
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
        if(this.actionPointer <= 0){
            this.actionPointer = 0;
        }else{
            this.actionPointer = this.actionPointer - 1;
        }
    }

    increaseActionPointer = () => {
        if(this.actions.length - 1 <= this.actionPointer){
            this.actionPointer = this.actions.length - 1;
        }else{
            this.actionPointer = this.actionPointer + 1;
        }
    }

    injectHTML = () => {
        const iframe = this.template.querySelector('iframe');
        const iframeDocument = iframe.contentWindow.document;

        // Check if the content type is an image (e.g., PNG or JPG)
        if (['png','jpeg','jpg'].includes(this.formattedContentType)) {

        } else {
            // If it's not an image, inject the content as HTML
            iframeDocument.open();
            iframeDocument.write(this.formattedContent);
            iframeDocument.close();
        }
    }

    /** Events **/


    initBodyEditor = () => {
        const newModel = this.refs.bodyEditor.createModel({
            body:'',
            language:'txt'
        });
        this.refs.bodyEditor.displayModel(newModel);
    }

    initContentEditor = () => {
        //this.isLoading = false;
        this.currentModel = this.refs.contentEditor.createModel({
            body:this.formattedContent,
            language:this.formattedContentType
        });
        this.refs.contentEditor.displayModel(this.currentModel);
    }


    viewer_handleChange = (e) => {
        this.viewer_value = e.detail.value;
    }

    handleSelectTab(event) {
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
        this.actionPointer = 0;
        this.actions = [];

        this.header = DEFAULT.HEADER;
        this.endpoint = DEFAULT.ENDPOINT;
        this.body = DEFAULT.BODY;

        this.content = null;
    }

    endpoint_change = (e) => {
        this.endpoint = e.detail.value;
    }

    method_change = (e) => {
        this.method = e.detail.value;
    }

    body_change = (e) => {
        //console.log('body_change',e.detail);
        this.body = e.detail.value;
    }

    header_change = (e) => {
        this.header = e.target.value;
    }

    handle_customLinkClick = (e) => {
        // Assuming it's always GET method
        this.endpoint = e.detail.url;
        this.method = METHOD.GET;
        this.header = DEFAULT.HEADER;
        this.body = DEFAULT.BODY

        this.forceDomUpdate();
        this.executeAPI();
    }

    handle_downloadClick = () => {
        try {
            const blob = new Blob([this.formattedContent], { type: this.contentType });
            const url = URL.createObjectURL(blob);
            const download = document.createElement('a');
                download.href = window.URL.createObjectURL(blob);
                download.download = `${Date.now()}.${this.formattedContentType}`;
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

    /** Getters */

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
        }
        return this.content;
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

    get formattedContentType(){
        if(isUndefinedOrNull(this.contentType)) return 'text';

        if (/^(text|application)\/xml(;|$)/.test(this.contentType)) {
            return 'xml';
        } 
        if (/^application\/json(;|$)/.test(this.contentType)) {
            return 'json';
        } 

        if (/^text\/csv(;|$)/.test(this.contentType)) {
            return 'csv';
        }

        if (/^text\/html(;|$)/.test(this.contentType)) {
            return 'html';
        }

        if (/^image\/png(;|$)/.test(this.contentType)) {
            return 'png';
        }

        if (/^image\/jpeg(;|$)/.test(this.contentType)) {
            return 'jpeg';
        }

        if (/^image\/jpg(;|$)/.test(this.contentType)) {
            return 'jpg';
        }
        
        return 'text';
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
}