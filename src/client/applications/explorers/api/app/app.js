import { api,track } from "lwc";
import { decodeError,isEmpty,isNotUndefinedOrNull,isUndefinedOrNull } from 'shared/utils';
import Toast from 'lightning/toast';
import ToolkitElement from 'core/toolkitElement';

const METHOD = {
    GET:'GET',
    POST:'POST',
    PUT:'PUT',
    PATCH:'PATCH',
    DELETE:'DELETE'
}
const TABS = {
    PARAMETERS:'Parameters',
    RESPONSE:'Response'
}

const DEFAULT = {
    HEADER : 'Content-Type: application/json; charset=UTF-8\nAccept: application/json',
    ENDPOINT : '/services/data/v60.0',
    BODY : ''
}

export default class App extends ToolkitElement {

    isLoading = false;

    @track formattedRequests = [];
    @track endpoint = DEFAULT.ENDPOINT;
    @track content;
    @track method = METHOD.GET;
    @api header = DEFAULT.HEADER;
    @api body = DEFAULT.BODY;

    // Undo/Redo
    @track actions = [];
    actionPointer = 0;
    isEditing = false;


    connectedCallback(){
        this.isFieldRendered = true;
    }


    /** Methods  **/

    executeAPI = () => {
        const _request = this.formatRequest();
        this.content = null; // reset content
        this.isEditing = false;
        try{
            this.isLoading = true;
            this.connector.conn.request(_request,(err, res) => {
                //console.log('err,res',err,res);
                if(err){
                    Toast.show({
                        label: err.message || 'Error during request',
                        variant:'error',
                        mode:'dismissible'
                    });
                }else{
                    Toast.show({
                        label: 'Success Call',
                        variant:'success',
                    });
                }
                this.content = res;

                // Simple set of pointer and action (When running, we reset at that pointer position !)
                if(this.actions.length > 0 && this.actionPointer != this.actions.length - 1){
                    this.actions = this.actions.slice(0,this.actionPointer + 1)
                }
                this.actions.push(this.formatAction());
                this.actionPointer = this.actions.length - 1;
                this.isLoading = false;
            })
        }catch(e){
            console.error(e);
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

        if(action){
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

        // reset editing
        this.isEditing = false;
    }

    forceDomUpdate = () => {
        this.refs.method.value      = this.method;
        this.refs.method.endpoint   = this.endpoint;
        this.template.querySelector('.slds-textarea-header').value = this.header;
        this.template.querySelector('.slds-textarea-body').value = this.body;
    }

    formatRequest = () => {
        const _request = {
            method: this.method, 
            url: `${this.connector.conn.instanceUrl}/${this.endpoint}`
        }
        
        if([METHOD.PATCH,METHOD.POST,METHOD.PUT].includes(this.method)){
            _request.body = this.body;
        }
        if(isNotUndefinedOrNull(this.header)){
            // Basic headers for now (Using line split)
            const _header = {};
            this.header.split('\n').forEach(line => {
                const lineArr = line.split(':');
                if(lineArr.length >= 2){
                    const key = (lineArr.shift()).trim();
                    _header[key] = lineArr.join(':').trim();
                }
            });
            if(Object.keys(_header).length > 0){
                _request.headers = {
                    ..._request.headers,
                    ..._header
                };
            }
        }


        return _request;
    }

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

    /** Events **/

    undo_click = () => {
        if(this.isEditing){
            this.reassignAction();
        }else if(this.actions.length > 0 && this.actions.length > this.actionPointer){
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
        this.isEditing = false;
    }

    endpoint_change = (e) => {
        this.isEditing = true;
        this.endpoint = e.detail.value;
    }

    method_change = (e) => {
        this.isEditing = true;
        this.method = e.detail.value;
    }

    body_change = (e) => {
        this.isEditing = true;
        this.body = e.target.value;
    }

    header_change = (e) => {
        this.isEditing = true;
        this.header = e.target.value;
    }

    handle_customLinkClick = (e) => {
        this.isEditing = true;
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
            const blob = new Blob([this.formattedContent], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const download = document.createElement('a');
                download.href = window.URL.createObjectURL(blob);
                download.download = `${Date.now()}.json`;
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

    get isUndoDisabled(){
        return this.actionPointer <= 0 && !this.isEditing;
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

    get isParamsDisplayed(){
        return this.currentTab === TABS.PARAMETERS;
    }

    get isResponseDisplayed(){
        return this.currentTab === TABS.RESPONSE;
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
        return isNotUndefinedOrNull(this.content)?JSON.stringify(this.content, null, 4):'';
    }
    get pageClass(){
        return super.pageClass+' slds-p-around_small';
    }
}