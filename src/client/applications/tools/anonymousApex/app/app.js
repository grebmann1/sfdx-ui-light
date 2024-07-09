import { api,track } from "lwc";
import { decodeError,isNotUndefinedOrNull,isEmpty,guid } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';

const INFO = 'INFO';
const DEBUG = 'DEBUG';
const Schemas = {}

Schemas.ExecuteAnonymousResult = {
    body:{
        result:{
            column: 'number',
            compileProblem: 'string',
            compiled: 'boolean',
            exceptionMessage: 'boolean',
            exceptionStackTrace: 'boolean',
            line: 'number',
            success:'boolean'
        }
    },
    header:{
        debugLog:'string'
    }
}

export default class App extends ToolkitElement {

    isLoading = false;
    isMonacoLoaded = false;
    isFilterUserDebugEnabled = false;

    // Apex
    apexScript; // ='CCR_TaskNotification__e event = new CCR_TaskNotification__e();\n// Publish the event\nDatabase.SaveResult result = EventBus.publish(event);';
    isApexRunning = false;

    _logs = [];
    _cacheFiles = [];
    @api
	set logs(value) {
		this._logs = value;
	}
	get logs() {
		return this._logs;
	}


    // Debugs
    debug = {
        debug_db : INFO,
        debug_callout : INFO,
        debug_apexCode : DEBUG,
        debug_validation : INFO,
        debug_profiling : INFO,
        debug_system : INFO,
    }

    connectedCallback(){
       this.loadFromCache();
    }

    disconnectedCallback() {
       
    }


	/** Methods  **/


    storeToCache = () => {
        let key = `${this.connector.configuration.alias}-anonymousapex-scripts`;
        window.defaultStore.setItem(key,JSON.stringify(this.refs.editor.editorUpdatedFiles));
    }

    loadFromCache = async () => {
        let key = `${this.connector.configuration.alias}-anonymousapex-scripts`;
        let _config = await window.defaultStore.getItem(key);
        try{
            if(isEmpty(_config)) return;
            this._cacheFiles = JSON.parse(_config)
        }catch(e){
            console.error(e);
        }
    }


    /** Events **/

    handleEditorChange = (e) => {
        this.storeToCache();
    }

    handleAddTab = (e) => {
        this.refs.editor.addFiles([this.generateEmptyFile()]);
    }

    debug_handleChange = (e) => {
        this.debug[e.currentTarget.dataset.key] = e.detail.value;
        let key = `${this.connector.configuration.alias}-debuglog`;
        window.defaultStore.setItem(key,JSON.stringify(this.debug));
    }

    handleFilterUserDebugChange = (e) => {
        this.isFilterUserDebugEnabled = e.detail.checked;
    }

    handleMonacoLoaded = (e) => {
        if(!this.isMonacoLoaded){
            this.initEditor();
        }
    }

    executeApex = async (e) => {
        this.isApexRunning = true;
        // Execute
        this.executeApexSoap( (err, res) => {
            //console.log('err, res',err, res);
            if (err) { 
                return console.error(err);
            }

            if(!isEmpty(res._header?.debugLog || '')){
                this.logs = res._header.debugLog.split('\n').map((x,i) => ({id:i,value:x}));
            }
            
            this.isApexRunning = false;
            // ...
        });
    }

    executeApexSoap = (callback) => {  
        this.refs.editor.executeApex(this.headers,callback);
    }

    /** Methods  **/

    generateEmptyFile = () => {
        const _uid = guid();
        return {   
            id:_uid,
            path:_uid,
            name:'Script',
            apiVersion:60,
            body:`System.debug('Hello the world');`,
            language:'apex',
        }
    }

    initEditor = () => {
        this.isMonacoLoaded = true;
        // Load from cache 
        const initFiles = this._cacheFiles || [];
        if(initFiles.length == 0){
            initFiles.push(this.generateEmptyFile())
        }
        // init by default
        this.refs.editor.displayFiles('ApexClass',initFiles);
    }

    filterLog = (item) => {
        return item.startsWith('Execute Anonymous') 
        || (this.isFilterUserDebugEnabled && item.includes('|USER_DEBUG|') || !this.isFilterUserDebugEnabled) // User Debug Filter
    }


    /** Getters */

    get isLogDisplayed(){
        return this._logs.length > 0;
    }

    get formattedFilterLogs(){
        return this._logs.map(x => x.value).filter(x => this.filterLog(x)).join('\n');
    }

    get debug_db_options(){
        return [
            {value:'NONE',label:'None'},
            {value:'INFO',label:'Info'},
            {value:'FINEST',label:'Finest'}
        ]
    }

    get debug_apexCode_options(){
        return [
            {value:'NONE',label:'None'},
            {value:'ERROR',label:'Error'},
            {value:'WARN',label:'Warn'},
            {value:'INFO',label:'Info'},
            {value:'DEBUG',label:'Debug'},
            {value:'FINE',label:'Fine'},
            {value:'FINER',label:'Finer'},
            {value:'FINEST',label:'Finest'}
        ]
    }

    get debug_validation_options(){
        return [
            {value:'NONE',label:'None'},
            {value:'INFO',label:'Info'},
        ]
    }

    get debug_callout_options(){
        return [
            {value:'NONE',label:'None'},
            {value:'INFO',label:'Info'},
            {value:'FINEST',label:'Finest'}
        ]
    }

    get debug_profiling_options(){
        return [
            {value:'NONE',label:'None'},
            {value:'INFO',label:'Info'},
            {value:'FINE',label:'Fine'},
            {value:'FINEST',label:'Finest'}
        ]
    }

    get debug_system_options(){
        return [
            {value:'NONE',label:'None'},
            {value:'INFO',label:'Info'},
            {value:'DEBUG',label:'Debug'},
            {value:'FINE',label:'Fine'},
        ]
    }

    get headers(){
        return {
            DebuggingHeader:{
                categories:[
                    {
                        category:'Apex_code',
                        level:this.debug.debug_apexCode
                    },
                    {
                        category:'Callout',
                        level:this.debug.debug_callout
                    },
                    {
                        category:'Validation',
                        level:this.debug.debug_validation
                    },
                    {
                        category:'Db',
                        level:this.debug.debug_db
                    },
                    {
                        category:'Apex_profiling',
                        level:this.debug.debug_profiling
                    },
                    {
                        category:'System',
                        level:this.debug.debug_system
                    }
                ]
            }
        }
    }
  
}