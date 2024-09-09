import { api } from "lwc";
import ToolkitElement from 'core/toolkitElement';
import LightningAlert from 'lightning/alert';
import Toast from 'lightning/toast';
import { isEmpty,isElectronApp,classSet,isNotUndefinedOrNull,runActionAfterTimeOut,guid } from 'shared/utils';
import { SOQL,APEX,VF } from 'editor/languages';
import loader from '@monaco-editor/loader';
if(process.env.IS_CHROME){
    loader.config({ paths: { vs: '/assets/libs/monaco-editor/vs' } });
}
/** REQUIRED FIELDS : _source & _bodyField */

const INFO = 'INFO';
const Schemas = {
    ExecuteAnonymousResult:{
        column: 'number',
        compileProblem: 'string',
        compiled: 'boolean',
        exceptionMessage: 'string',
        exceptionStackTrace: 'string',
        line: 'number',
        success:'boolean',
        debugLog:'string'
    }
}


export default class App extends ToolkitElement {
    @api isCoverageEnabled = false;
    @api maxHeight;
    @api files = [];
    @api currentFile;
    @api metadataType;
    @api isActionHidden = false;
    @api isAddTabEnabled = false;
    @api isTabCloseableDisabled = false;

    @api isTabEnabled = false; // by default, we display tabs

    // Coverage
    @api isCoverageHighlighted = false;
    


    models = [];
    editor;
    monaco;
    decorations = [];

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

    handleCopyClick = () => {
        navigator.clipboard.writeText(this.currentModel.getValue());
        Toast.show({
            label: `Exported to your clipboard`,
            variant:'success',
        });
    }

    handleCoverageHighlightToggle = () => {
        this.isCoverageHighlighted = !this.isCoverageHighlighted;
        this.editor.updateOptions({ readOnly: this.isCoverageHighlighted });
        if(this.isCoverageHighlighted && isNotUndefinedOrNull(this.currentModelAdvanced._id)){
            this.isLoading = true;
            this.enableCodeCoverage();
        }else{
            this.editor.deltaDecorations(this.decorations, []);
        }
    }

    resetCoverage = () => {
        this.isCoverageHighlighted = false;
        this.editor.updateOptions({ readOnly: false });
    }

    /** Methods **/

    enableCodeCoverage = async () => {
        const recordId = this.currentModelAdvanced._id;
        const coverageRecord = await this.fetchCodeCoverage(recordId);
        if(isNotUndefinedOrNull(coverageRecord?.Coverage) && coverageRecord.Coverage.coveredLines.length > 0){
            this.highlightLines(
                coverageRecord.Coverage.coveredLines,
                coverageRecord.Coverage.uncoveredLines
            );
        };
        this.isLoading = false;
    }

    highlightLines = (covered,uncovered) => {
        const decorations = [
            ...covered.map(x => ({
                range: new monaco.Range(x, 1, x, Infinity),
                options: {
                    isWholeLine: true,
                    className: "highlighted-cover"
                }
            })),
            ...uncovered.map(x => ({
                range: new monaco.Range(x, 1, x, Infinity),
                options: {
                    isWholeLine: true,
                    className: "highlighted-uncover"
                }
            }))
        ];
        this.decorations = this.editor.deltaDecorations([], decorations);
    }

    fetchCodeCoverage = async (recordId) => {
        try{
            const query = `SELECT Id, CreatedDate, NumLinesCovered, NumLinesUncovered, CoverageLastModifiedDate,ApexClassOrTriggerId, Coverage FROM ApexCodeCoverageAggregate Where ApexClassOrTriggerId = '${recordId}'`;
            let queryExec = this.connector.conn.tooling.query(query);
            let result = await queryExec.run({ responseTarget:'Records',autoFetch : true, maxFetch : 1 }) || [];
            return result[0];
        }catch(e){
            console.error(e);
            return null;
        }
    }
    
    
    createModels = (files) => {
        this.models = files.map(x => ({
            name    : x.name,
            path    : x.path,
            model   : this.monaco.editor.createModel(x.body,x.language),
            state   : null,
            versionId: 1,
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
            versionId: 1,
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
            wordWrap: "on",
            //theme: "vs-dark"
        });

        this.editor.onDidChangeModelContent((event) => {
            //console.log('onDidChangeModelContent');
            this.isEditMode = this.models.filter(x => x.versionId != x.model.getAlternativeVersionId()).length > 0; //Only if there is changes !

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

    executeApexSoap = (apexcode,headers) => {  
        return this.connector.conn.soap._invoke("executeAnonymous", { apexcode: apexcode }, Schemas.ExecuteAnonymousResult,{
            xmlns: "http://soap.sforce.com/2006/08/apex",
            endpointUrl:this.connector.conn.instanceUrl + "/services/Soap/s/" + this.connector.conn.version,
            headers
        });
    }

    @api
    executeApex = async (headers) => {
        const model = this.currentModel;
        this.isLoading = true;
        // Reset errors :
        this.resetMarkers(model);
        // Execute
        return new Promise((resolve,reject) => {
            this.executeApexSoap(model.getValue(),headers)
            .then(res => {
                //console.log('res',res);
                if(!res.success && !res.compiled){
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
                resolve(res);
            })
            .catch(e => {
                console.error(e);
                LightningAlert.open({
                    message: e.message,
                    theme: 'error', // a red theme intended for error states
                    label: 'Error!', // this is the header text
                });
                reject(e)
            })
        })
        
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
        this.resetCoverage();
        
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
        this.connector.conn.tooling.sobject('ContainerAsyncRequest').retrieve(requestId)
        .then(async res => {
            

            //console.log('Deployment Status:', request);

            if (res.State === 'Queued' || res.State === 'InProgress') {
                // Poll again if not completed
                setTimeout(() => this.pollDeploymentStatus(requestId,containerId), 2000); // Wait 2 seconds before polling again
            } else {
                if(res.State === 'Completed'){
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
                    const componentFailures = res.DeployDetails.componentFailures.map(x => x.problem).join(' | ');
                    const markers = res.DeployDetails.componentFailures.map(x => ({
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
                        message: res.ErrorMsg || componentFailures,
                        theme: 'error', // a red theme intended for error states
                        label: 'Error!', // this is the header text
                    });
                }
                await this.connector.conn.tooling.sobject('MetadataContainer').destroy(containerId);
                this.isLoading = false;
            }
        })
        .catch(err => {
            console.error('Error retrieving deployment status:', err);
        })
    }

    deployApex = async () => {
        const tooling = this.connector.conn.tooling;
        const containerName = guid().substring(0,32);

        this.resetMarkers(this.currentModel);

        // Container
        const container = await tooling.sobject('MetadataContainer').create({Name: containerName});
        
        const apexClassMemberRecord = {
            ContentEntityId:this.currentModelAdvanced._id,
            Body:this.currentModel.getValue(),
            MetadataContainerId:container.id
        };
        
        /**  In the futur, to be optimized !*/
        /**
            const containerRequests = [
                {
                    method: 'POST',
                    url: `/services/data/v${this.connector.conn.version}/tooling/sobjects/MetadataContainer`,
                    referenceId: `containerRef`,
                    body: {
                        Name: containerName
                    }
                }
            ]

            const apexClassMemberRequests = this.models.map((x, index) => ({
                method: 'PATCH',
                url: `/services/data/v${this.connector.conn.version}/tooling/sobjects/ApexClassMember`,
                referenceId: `apexClassMemberRef_${index}`,
                body: {
                    Body: x.model.getValue(),
                    ContentEntityId:x._id,
                    MetadataContainerId:"@{containerRef.id}"
                }
            }));

            const ContainerAsyncRequests = [
                {
                    method: 'POST',
                    url: `/services/data/v${this.connector.conn.version}/tooling/sobjects/ContainerAsyncRequest`,
                    referenceId: `containerRef`,
                    body: {
                        MetadataContainerId: "@{containerRef.id}",
                        IsCheckOnly: false,
                    }
                }
            ];
        **/

        // Only take the first 1 (New JSforce is using the composite api)
        await tooling.sobject(`${this.metadataType}Member`).create(apexClassMemberRecord);
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
        const records = this.models.filter(x => x.versionId != x.model.getAlternativeVersionId()).map(x => {
            return {
                Source:x.model.getValue(),
                Id:x._file._source.attributes.url.split('/').slice(-1),
                attributes:x._file._source.attributes
            }
        });
        if(records.length <= 0) return;

        const result = await tooling.sobject(records[0].attributes.type).update(records);
        //console.log('result',records,result);
        if(result.find(x => !x.success)){
            const message = result.find(x => !x.success).errors.map(x => x.message).join(' | ');
            this.isLoading = false;
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

    get currentModelAdvanced(){
        return this.models.find(x => x.path === this.currentFile);
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
            isCloseable:this.models.length > 1 && !this.isTabCloseableDisabled,
            class:classSet('slds-tabs_scoped__item').add({'slds-is-active':x.path === this.currentFile}).toString()
        }))
    }

    get isToolDisplayed(){
        return this.models.length > 0;
    }

    get isTabDisplayed(){
        return this.isTabEnabled;
    }

    get isCodeCoverageDisplayed(){
        return this.isCoverageEnabled && (this.metadataType === 'ApexClass' || this.metadataType === 'ApexTrigger');
    }

    get isActionsDisplayed(){
        return !this.isActionHidden;
    }

    get isAddTabEnabledFormatted(){
        return this.isAddTabEnabled && this.models.length < 5;
    }
}