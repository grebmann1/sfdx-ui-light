import { api } from "lwc";
import FeatureElement from 'element/featureElement';
import LightningAlert from 'lightning/alert';

import { isEmpty,isElectronApp,classSet,isNotUndefinedOrNull,runActionAfterTimeOut,guid } from 'shared/utils';
import loader from '@monaco-editor/loader';
import {setAllLanguages} from './languages';

/** REQUIRED FIELDS : _source & _bodyField */

export default class App extends FeatureElement {

    @api files = [];
    @api currentFile;
    @api metadataType;
    


    models = [];
    editor;
    monaco;

    isEditMode = false;
    isLoading = false;

    connectedCallback(){
        console.log('code editor');
        this.loadMonacoEditor();
    }

    /** Events */

    handleSelectTab(event) {
        
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
        this.displayFiles(this.metadataType,this.files); // we reset
    }

    /** Methods **/

    pollDeploymentStatus = (requestId,containerId) => {
        this.connector.conn.tooling.sobject('ContainerAsyncRequest').retrieve(requestId, async (err, request) => {
            if (err) { return console.error('Error retrieving deployment status:', err); }

            console.log('Deployment Status:', request);

            if (request.State === 'Queued' || request.State === 'InProgress') {
                // Poll again if not completed
                setTimeout(() => this.pollDeploymentStatus(requestId,containerId), 2000); // Wait 2 seconds before polling again
            } else {
                if(request.State === 'Completed'){
                    //console.log('Deployment completed successfully.');
                    this.updateFilesFromModels();
                    this.isEditMode = false;
                    this.dispatchEvent(new CustomEvent("saved", {bubbles: true }));
                }else{
                    //console.error('Deployment failed:', request.ErrorMsg);
                    const componentFailures = request.DeployDetails.componentFailures.map(x => x.problem).join(' | ');
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
        }
        this.isLoading = false;
    }

    saveCode = async () => {
        this.isLoading = true;
        
        if(['ApexClass','ApexTrigger','ApexPage','ApexComponent'].includes(this.metadataType)){
            this.deployApex()
        }else{
            this.deployOthers();
        }

        
    }   
    
    @api
    displayFiles = (metadataType,files) => {
        console.log('files',metadataType,files);

        this.metadataType = metadataType;
        this.files = files;
        this.isEditMode = false;

        this.createModels();
        if(this.editor){
            this.editor.setModel(this.models[0].model);
        }else{
            this.createEditor();
        }
        this.editor.focus();
    }
    
    createModels = () => {
        this.models = this.files.map(x => ({
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

        this.currentFile = this.models[0].path;
        this.editor = this.monaco.editor.create(this.refs.editor, {
            model: this.models[0].model,
            minimap: {
                enabled: false
            },
            automaticLayout:true,
            readOnly: false,
            //scrollBeyondLastLine: false,
            //theme: "vs-dark"
        });

        this.editor.onDidChangeModelContent((event) => {
            this.isEditMode = true;
            //console.log('onDidChangeModelContent',event);
        });
    }


    loadMonacoEditor = async () => {
        this.monaco = await loader.init();
        this.monaco.languages.register({ id: 'visualforce' });
        this.monaco.languages.register({ id: 'handlebars' });
        this.monaco.languages.register({ id: 'razor' });
        setAllLanguages(this.monaco.languages);
    }

    /** Getters */
    
    get formattedFiles(){
        return this.files.map(x => ({
            ...x,
            class:classSet('slds-tabs_scoped__item').add({'slds-is-active':x.path === this.currentFile}).toString()
        }))
    }

    get isToolDisplayed(){
        return this.files.length > 0;
    }
}