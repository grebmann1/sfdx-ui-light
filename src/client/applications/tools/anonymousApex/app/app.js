import { api,track } from "lwc";
import { decodeError,isNotUndefinedOrNull,isEmpty,guid } from 'shared/utils';
import FeatureElement from 'element/featureElement';

const INFO = 'INFO';
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

export default class App extends FeatureElement {

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
        debug_apexCode : INFO,
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


    showErrorOnMonaco = (data) => {
        this.refs.editor.addMarkers(
            this.refs.editor.currentModel,
            [{
                startLineNumber: data.line,
                endLineNumber:data.line,
                startColumn: 1,
                endColumn:model.getLineLength(data.line),
                message: data.compileProblem,
                severity: monaco.MarkerSeverity.Error
            }]
        );
    }

    storeToCache = () => {
        let key = `${this.connector.header.alias}-anonymousapex-scripts`;
        window.defaultStore.setItem(key,JSON.stringify(this.refs.editor.editorUpdatedFiles));
    }

    loadFromCache = async () => {
        let key = `${this.connector.header.alias}-anonymousapex-scripts`;
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
        let key = `${this.connector.header.alias}-debuglog`;
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
        const model = this.refs.editor?.currentModel?.getValue();
        this.isApexRunning = true;
        // Reset errors :
        this.refs.editor.resetMarkers(this.refs.editor.currentModel);
        // Execute
        this.executeApexSoap(model, (err, res) => {
            console.log('err, res',err, res);
            if (err) { 
                return console.error(err);
            }else if(!res.success){
                this.showErrorOnMonaco(res);
            }

            if(!isEmpty(res._header?.debugLog || '')){
                this.logs = res._header.debugLog.split('\n').map((x,i) => ({id:i,value:x}));
            }
            
            this.isApexRunning = false;
            // ...
        });
    }

    executeApexSoap = (apexcode,callback) => {  
        this.connector.conn.soap._invoke("executeAnonymous", { apexcode: apexcode }, Schemas.ExecuteAnonymousResult, callback,{
            xmlns: "http://soap.sforce.com/2006/08/apex",
            endpointUrl:this.connector.conn.instanceUrl + "/services/Soap/s/" + this.connector.conn.version,
            headers:{
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
        });
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
            language:'java',
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
  
}