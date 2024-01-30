import { api } from "lwc";
import FeatureElement from 'element/featureElement';
import { isEmpty,isElectronApp,classSet,isNotUndefinedOrNull,runActionAfterTimeOut } from 'shared/utils';
import loader from '@monaco-editor/loader';
import {setAllLanguages} from './languages';



export default class App extends FeatureElement {

    @api files = [];
    @api currentFile;


    models;
    editor;
    monaco;

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

    /** Methods **/
    
    @api
    displayFiles = (files) => {
        this.files = files;
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
            state   : null
        }));
    }

    createEditor = () => {
        if(this.models.length == 0) return;

        this.currentFile = this.models[0].path;
        this.editor = this.monaco.editor.create(this.refs.editor, {
            model: this.models[0].model,
            minimap: {
                enabled: false
            },
            automaticLayout:true
            //readOnly: true,
            //scrollBeyondLastLine: false,
            //theme: "vs-dark"
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