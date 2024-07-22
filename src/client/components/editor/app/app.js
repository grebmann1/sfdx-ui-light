import { api } from "lwc";
import ToolkitElement from 'core/toolkitElement';
import LightningAlert from 'lightning/alert';
import Toast from 'lightning/toast';

import { isEmpty,isElectronApp,classSet,isNotUndefinedOrNull,runActionAfterTimeOut,guid } from 'shared/utils';
import loader from '@monaco-editor/loader';
import { SOQL,APEX,VF } from 'editor/languages';

/** REQUIRED FIELDS : _source & _bodyField */

const INFO = 'INFO';
const Schemas = {
    ExecuteAnonymousResult:{
        body:{
            result:{
                column: 'number',
                compileProblem: 'string',
                compiled: 'boolean',
                exceptionMessage: 'string',
                exceptionStackTrace: 'string',
                line: 'number',
                success:'boolean'
            }
        },
        header:{
            debugLog:'string'
        }
    }
}


export default class App extends ToolkitElement {

    @api maxHeight;
    @api files = [];
    @api currentFile;
    @api metadataType;
    @api isActionHidden = false;
    @api isAddTabEnabled = false;

    @api isTabEnabled = false; // by default, we display tabs
    


    models = [];
    editor;
    monaco;

    isEditMode = false;
    isLoading = false;
    hasLoaded = false;

    counter = 0;

    async connectedCallback(){
        await this.loadMonacoEditor();
    }

    /** Events */

    handleAddTab = (e) => {
        //console.log('editor - handleAddTab');
        // Process this in the parent component
    }

    handleCloseTab = (e) => {
        const tabId = e.detail.value;
        //console.log('editor - handleCloseTab',tabId);
        // Process this in the parent component

        const currentTabId = this.template.querySelector('slds-tabset').activeTabValue;
        this.models = this.models.filter(x => x.path != tabId);
        const latestModel = this.models[this.models.length - 1];
        if(currentTabId == tabId){
            this.editor.setModel(latestModel.model); // set last model
            this.template.querySelector('slds-tabset').activeTabValue = latestModel.path;
        }
        this.dispatchEvent(new CustomEvent("change", {detail:{value:'delete',type:'tab'},bubbles: true }));
    }

    handleSelectTab(event){
        
        const oldModelIndex = this.models.findIndex(x => x.path === this.currentFile);
        if(oldModelIndex >= 0){
            // Save previous state
            this.models[oldModelIndex].state = this.editor.saveViewState();
        }
        
        this.currentFile = event.target.value;
        const element = this.models.find(x => x.path === this.currentFile);

        // Switch model
        this.editor.setModel(element.model);
        if(element.state){
            this.editor.restoreViewState(element.state);
        }
		
		this.editor.focus();
    }

    onSaveClick = () => {
        this.saveCode();
    }

    onCancelClick = () => {
        this.isEditMode = false;
        //console.log('this.metadataType,this.files',this.metadataType,this.files)
        this.displayFiles(this.metadataType,this.files); // we reset
    }

    /** Methods **/

    
    
    createModels = (files) => {
        this.models = files.map(x => ({
            name    : x.name,
            path    : x.path,
            model   : this.monaco.editor.createModel(x.body,x.language),
            state   : null,
            _id     : x.id,
            _metadata : x.metadata,
            _file   : x
        }));
    }

    addModels = (files) => {
        return files.map(x => ({
            name    : x.name,
            path    : x.path,
            model   : this.monaco.editor.createModel(x.body,x.language),
            state   : null,
            _id     : x.id,
            _metadata : x.metadata,
            _file   : x
        }));
    }

    updateFilesFromModels = () => {
        this.files = this.models.map(x => {
            return {
                ...x._file,
                body:x.model.getValue()
            }
        })
    }

    createEditor = () => {
        if(this.models.length == 0) return;

        const innerContainer2 = document.createElement('div');
            innerContainer2.setAttribute("slot", "editor");
            innerContainer2.style.width = '100%';
            innerContainer2.style.height = '100%';
        this.refs.editor.appendChild(innerContainer2);

        this.currentFile = this.models[0].path;
        //console.log('this.models[0].model',this.models[0].model);
        this.editor = this.monaco.editor.create(innerContainer2, {
            model: this.models[0].model,
            minimap: {
                enabled: false
            },
            automaticLayout:true,
            readOnly: false,
            scrollBeyondLastLine: false,
            //theme: "vs-dark"
        });

        this.editor.onDidChangeModelContent((event) => {
            //console.log('onDidChangeModelContent');
            this.isEditMode = true;

            runActionAfterTimeOut(this.editor.getValue(),(value) => {
                this.dispatchEvent(new CustomEvent("change", {detail:{value,type:'body'},bubbles: true }));
            },{timeout:300});
            //console.log('onDidChangeModelContent',event);
        });
    }

    loadMonacoEditor = async () => {
        this.monaco = await loader.init();
        // Configure Language
        APEX.configureApexLanguage(this.monaco);
        SOQL.configureSoqlLanguage(this.monaco);
        VF.configureVisualforceLanguage(this.monaco);
        // Completion
        APEX.configureApexCompletions(this.monaco);

        this.dispatchEvent(new CustomEvent("monacoloaded", {bubbles: true }));
        this.hasLoaded = true;
    }

    autocomplete_searchField = (object,field) => {
        return ['Id','Name','Contact'];
    }

    executeApexSoap = (apexcode,headers,callback) => {  
        this.connector.conn.soap._invoke("executeAnonymous", { apexcode: apexcode }, Schemas.ExecuteAnonymousResult, callback,{
            xmlns: "http://soap.sforce.com/2006/08/apex",
            endpointUrl:this.connector.conn.instanceUrl + "/services/Soap/s/" + this.connector.conn.version,
            headers
        });
    }

    @api
    executeApex = async (headers,callback) => {
        const model = this.currentModel;
        this.isLoading = true;
        // Reset errors :
        this.resetMarkers(model);
        // Execute
        this.executeApexSoap(model.getValue(),headers, (err, res) => {
            //console.log('err, res',err, res);
            if (err) { 
                LightningAlert.open({
                    message: err.message,
                    theme: 'error', // a red theme intended for error states
                    label: 'Error!', // this is the header text
                });
            }else if(!res.success && !res.compiled){
                this.addMarkers(
                    model,
                    [{
                        startLineNumber: res.line,
                        endLineNumber: res.line,
                        startColumn: 1,
                        endColumn: model.getLineLength(res.line),
                        message: res.compileProblem,
                        severity: this.monaco.MarkerSeverity.Error
                    }]
                );
            }
            this.isLoading = false;
            callback(err,res);
        });
    }
    
    @api
    addMarkers = (model,markers) => {
        this.monaco.editor.setModelMarkers(model, "owner", markers);
    }

    @api
    resetMarkers = (model) => {
        this.monaco.editor.setModelMarkers(model, "owner",[]);
    }

    @api
    addFiles = (files) => {
        const _newModels = this.addModels(files);
        this.models = [].concat(this.models,_newModels);

        const latestModel = this.models[this.models.length - 1];
        this.editor.setModel(latestModel.model); // set last model
        window.setTimeout(()=>{
            if(!this.template.querySelector('slds-tabset')) return;
            this.template.querySelector('slds-tabset').activeTabValue = latestModel.path;
            
        },1)
        this.dispatchEvent(new CustomEvent("change", {detail:{value:'add',type:'tab'},bubbles: true }));
    }

    @api
    displayFiles = (metadataType,files) => {
        if(this.counter >= 10) return;
        this.files = files;

        this.metadataType = metadataType;
        this.isEditMode = false;

        this.createModels(files);
        const firstModel = this.models[0];
        if(this.editor){
            this.editor.setModel(firstModel.model); // set last model
        }else{
            this.createEditor();
        }
        window.setTimeout(()=>{
            if(!this.template.querySelector('slds-tabset')) return;
            this.template.querySelector('slds-tabset').activeTabValue = firstModel.path;
        },1)
    }


    /** Deployment Methods */

    saveCode = async () => {
        this.isLoading = true;
        if(['ApexClass','ApexTrigger','ApexPage','ApexComponent'].includes(this.metadataType)){
            this.deployApex()
        }else{
            this.deployOthers();
        }
    }

    pollDeploymentStatus = (requestId,containerId) => {
        this.connector.conn.tooling.sobject('ContainerAsyncRequest').retrieve(requestId, async (err, request) => {
            if (err) { return console.error('Error retrieving deployment status:', err); }

            //console.log('Deployment Status:', request);

            if (request.State === 'Queued' || request.State === 'InProgress') {
                // Poll again if not completed
                setTimeout(() => this.pollDeploymentStatus(requestId,containerId), 2000); // Wait 2 seconds before polling again
            } else {
                if(request.State === 'Completed'){
                    //console.log('Deployment completed successfully.');
                    this.updateFilesFromModels();
                    this.isEditMode = false;
                    Toast.show({
                        label: 'Saved',
                        variant:'success',
                    });
                    this.dispatchEvent(new CustomEvent("saved", {bubbles: true }));
                }else{
                    //console.error('Deployment failed:', request.ErrorMsg);
                    const componentFailures = request.DeployDetails.componentFailures.map(x => x.problem).join(' | ');
                    const markers = request.DeployDetails.componentFailures.map(x => ({
                        startLineNumber: x.lineNumber,
                        endLineNumber:x.lineNumber,
                        startColumn: 1,
                        endColumn:this.currentModel.getLineLength(x.lineNumber),
                        message: x.problem,
                        severity: monaco.MarkerSeverity.Error
                    }));
                    this.addMarkers(
                        this.currentModel,
                        markers
                    );

                    await LightningAlert.open({
                        message: request.ErrorMsg || componentFailures,
                        theme: 'error', // a red theme intended for error states
                        label: 'Error!', // this is the header text
                    });
                }
                await this.connector.conn.tooling.sobject('MetadataContainer').destroy(containerId);
                this.isLoading = false;
            }
        });
    }

    deployApex = async () => {
        const tooling = this.connector.conn.tooling;
        const containerName = guid().substring(0,32);
        // Container
        const container = await tooling.sobject('MetadataContainer').create({Name: containerName});
        const records = this.models.map(x => ({
            ContentEntityId:x._id,
            Body:x.model.getValue(),
            MetadataContainerId:container.id
        }));

        await tooling.sobject(`${this.metadataType}Member`).create(records);
        // deployment request
        const asyncRequest = await tooling.sobject('ContainerAsyncRequest').create({
            MetadataContainerId: container.id,
            IsCheckOnly: false,
        });
        // Start polling for deployment status
        setTimeout(() => this.pollDeploymentStatus(asyncRequest.id,container.id), 1000);
    }


    deployOthers = async () => {
        const tooling = this.connector.conn.tooling;
        //console.log('this.models',this.models);
        const records = this.models.map(x => {
            return {
                Source:x.model.getValue(),
                Id:x._file._source.attributes.url.split('/').slice(-1),
                attributes:x._file._source.attributes
            }
        });
        const result = await tooling.sobject(records[0].attributes.type).update(records);
        //console.log('result',records,result);
        if(result.find(x => !x.success)){
            const message = result.find(x => !x.success).errors.map(x => x.message).join(' | ');
            await LightningAlert.open({
                message: message,
                theme: 'error', // a red theme intended for error states
                label: 'Error!', // this is the header text
            });
        }else{
            this.isEditMode = false;
            Toast.show({
                label: 'Saved',
                variant:'success',
            });
        }
        this.isLoading = false;
    }
    
    
    

    /** Getters */

    get dynamicStyle(){
        return this.maxHeight?`height:${this.maxHeight};`:'position: relative;flex-grow: 1;overflow: auto;';
    }

    @api
    get currentModel(){
        return this.editor.getModel();
    }

    @api
    get currentEditor(){
        return this.editor;
    }

    @api
    get currentMonaco(){
        return this.monaco;
    }

    @api 
    get editorUpdatedFiles(){
        return this.models.map(x => {
            return {
                ...x._file,
                body:x.model.getValue()
            }
        })
    }
    
    get formattedModels(){
        return this.models.map(x => ({
            ...x,
            isCloseable:this.models.length > 1,
            class:classSet('slds-tabs_scoped__item').add({'slds-is-active':x.path === this.currentFile}).toString()
        }))
    }

    get isToolDisplayed(){
        return this.models.length > 0;
    }

    get isTabDisplayed(){
        return this.isTabEnabled;
    }

    get isActionsDisplayed(){
        return !this.isActionHidden;
    }

    get isAddTabEnabledFormatted(){
        return this.isAddTabEnabled && this.models.length < 5;
    }
}