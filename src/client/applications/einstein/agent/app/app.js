import { LightningElement,api,track,wire} from "lwc";
import Toast from 'lightning/toast';
import ToolkitElement from 'core/toolkitElement';
import { isUndefinedOrNull,isNotUndefinedOrNull,isEmpty,guid,classSet,ROLES } from "shared/utils";
import { GLOBAL_EINSTEIN} from 'assistant/utils';
import { store,connectStore,AGENTBUILDER} from 'core/store';
import { TEMPLATE,INTRUCTIONS,generateInstructionForAssistant,generateWelcomeMessage } from 'agent/utils';

export default class App extends ToolkitElement {

    isLoading = false;
    _hasRendered = false;

    // Models
    responseModel;
    jsonModel;

    // dialog
    dialogId;

    // openaiKey
    openaiKey;
    isInjected;


    get body() {
        return this._body;
    }

    set body(value) {
        if (this._hasRendered) {
            const inputEl = this.refs?.agentCode?.currentModel;
            if (inputEl && this._body != value) {
                inputEl.setValue(isUndefinedOrNull(value) ? '' : value);
            }
        }
        this._body = value;
    }

    connectedCallback() {
        this.checkForInjected();

        //this.body = JSON.stringify(JSON.parse(TEMPLATE.BASIC), null, 4);
        
    }

    renderedCallback(){
        this._hasRendered = true;
    }

    
    @wire(connectStore, { store })
    storeChange({ agentBuilder,application }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if(!isCurrentApp) return;
        if(agentBuilder.body){
            this.body = agentBuilder.body;
        }
    }

    /** Events **/

    handleMonacoLoad = () => {
        this.agentCodeModel = this.refs.agentCode.createModel({
            body: this.body || '',
            language: 'json'
        });
        this.refs.agentCode.displayModel(this.agentCodeModel);
    }

    handleStartProcess = async () => {
        await store.dispatch(AGENTBUILDER.reduxSlice.actions.init({
            alias:GLOBAL_EINSTEIN,
            openaiKey:this.openaiKey
        }));
        this.refs.dialog.handleStartClick();
    }

    
    

    /** Methods **/
    
    checkForInjected = async () => {
        let el = document.getElementsByClassName('injected-openai-key');
        if(el){
            let content = el[0]?.textContent;
            if(isEmpty(content)) return;
            this.isInjected = true;
            try{
                const {openai_key} = JSON.parse(content);
                if(isNotUndefinedOrNull(openai_key)){
                    this.openaiKey = openai_key;
                }
            }catch(e){
                console.error('Issue while injecting',e);
            }
        }
    }


    /** Getters **/

    get pageClass(){//Overwrite
        return `${super.pageClass} slds-p-around_small`;
    }
}