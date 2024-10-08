import { api,wire } from "lwc";
import ToolkitElement from 'core/toolkitElement';
import Toast from 'lightning/toast';
import { classSet,isNotUndefinedOrNull,runActionAfterTimeOut,guid,isChromeExtension } from 'shared/utils';
import { store,connectStore } from 'core/store';
import { SOQL,APEX,VF,LOG } from 'editor/languages';
import loader from '@monaco-editor/loader';


export default class Default extends ToolkitElement {

    @api maxHeight;
    @api isReadOnly = false;
    @api files = [];
    @api currentFile;
    @api metadataType;
    @api isActionHidden = false;
    @api isAddTabEnabled = false;

    @api isTabEnabled = false; // by default, we display tabs
    @api theme;

    // Hidden feature

    @api isToolkitHidden = false;
    @api isEinsteinHidden = false;
    @api isCopyHidden = false;
    


    models = [];
    editor;
    monaco;

    isEditMode = false;
    isLoading = false;
    hasLoaded = false;

    counter = 0;


    _useToolingApi = false;

    /*@wire(connectStore, { store })
    storeChange({ ui,sobject }) {}
    */

    async connectedCallback(){
        if(process.env.IS_CHROME){
            loader.config({ paths: { vs: window.monacoUrl || '/assets/libs/monaco-editor/vs' } });
        }
        await this.loadMonacoEditor();
    }

    /** Events */

    handleCopyClick = () => {
        navigator.clipboard.writeText(this.currentModel.getValue());
        Toast.show({
            label: `Exported to your clipboard`,
            variant:'success',
        });
    }


    /** Methods **/

    createEditor = (model) => {

       /* const innerContainer2 = document.createElement('div');
            innerContainer2.setAttribute("slot", "editor");
            innerContainer2.style.width = '100%';
            innerContainer2.style.height = '100%';
        this.refs.editor.appendChild(innerContainer2);*/

        this.currentFile = model;
        this.editor = this.monaco.editor.create(this.refs.editor, {
            model: model,
            theme:this.theme || 'vs',
            readOnly:this.isReadOnly,
            wordWrap: "on",
            autoIndent: true,
            formatOnType: true,
            formatOnPaste: true,
            minimap: {
                enabled: false
            },
            automaticLayout:true,
            scrollBeyondLastLine: false,
            fixedOverflowWidgets: true
        });
        this.editor.onDidChangeModelContent(this.handleModelContentChange);
        this.editor.onKeyDown((e) => {
            if ((e.ctrlKey || e.metaKey) && e.keyCode === this.monaco.KeyCode.KeyS) {
                e.preventDefault();
                this.dispatchEvent(new CustomEvent("monacosave", {bubbles: true,composed:true }));
            }
        });
        this.editor.onDidPaste((e) => {
            const pastedText = this.editor.getModel()?.getValueInRange(e.range);
    
            // Auto-detect format and apply formatting
            const _format = this.autoDetectAndFormat(pastedText);
    
            // Replace the editor content with the formatted text if found !
            if(_format){
                this.monaco.editor.setModelLanguage(this.editor.getModel(), _format); 
            }
            
            
        });
    }


    // Auto-detect format and apply appropriate formatting
    
    autoDetectAndFormat = (text) => {
        const trimmedText = text.trim();

        // Detect if the content is JSON
        if (trimmedText.startsWith('{') || trimmedText.startsWith('[')) {
            return 'json';
        }

        // Detect if the content is XML
        if (trimmedText.startsWith('<')) {
            return 'xml';
        }
        return null;
    }

    loadMonacoEditor = async () => {
        // This always return the same instance, be carefull to not had duplicate !!!!
        this.monaco = await loader.init();
        // Configure Language
        APEX.configureApexLanguage(this.monaco);
        SOQL.configureSoqlLanguage(this.monaco);
        VF.configureVisualforceLanguage(this.monaco);
        LOG.configureApexLogLanguage(this.monaco);
        // Completion
        APEX.configureApexCompletions(this.monaco);
        this.dispatchEvent(new CustomEvent("monacoloaded", {bubbles: true }));
        this.hasLoaded = true;
    }

    handleModelContentChange = (event) => {
        runActionAfterTimeOut(this.editor.getValue(),(value) => {
            this.dispatchEvent(
                new CustomEvent("change", {
                    detail:{
                        value:this.editor.getValue(),
                        type:this.autoDetectAndFormat(this.editor.getValue()),
                    },
                    bubbles: true 
                })
            );
        },{timeout:200});
    }
    
    @api
    addMarkers = (markers) => {
        this.monaco.editor.setModelMarkers(this.currentModel, "owner", markers);
    }

    @api
    resetMarkers = () => {
        this.monaco.editor.setModelMarkers(this.currentModel, "owner",[]);
    }


    @api
    displayModel = (model) => {
        if(this.editor){
            this.editor.setModel(model); // set last model
        }else{
            this.createEditor(model);
        }
    }

    @api
    createModel = ({body,language}) => {
        return this.monaco.editor.createModel(body,language);
    }

    /** Getters */

    @api
    get currentModel(){
        return this.editor?.getModel() || null;
    }

    @api
    get currentEditor(){
        return this.editor;
    }

    @api
    get currentMonaco(){
        return this.monaco;
    }

    get isToolkitDisplayed(){
        return !this.isToolkitHidden;
    }

    get isCopyDisplayed(){
        return !this.isCopyHidden;
    }

    get isEinsteinDisplayed(){
        return !this.isEinsteinHidden;
    }

}