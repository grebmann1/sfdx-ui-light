import { LightningElement,api,track,wire} from "lwc";
import { isUndefinedOrNull,isEmpty,ROLES,guid,lowerCaseKey,isNotUndefinedOrNull } from "shared/utils";
import ToolkitElement from 'core/toolkitElement';
import { upsertThreadList,storeThread,getThread } from 'assistant/utils';
import { store,connectStore,EINSTEIN,SELECTORS} from 'core/store';
import {chat_template} from './template';
export default class Dialog extends ToolkitElement {

    worker;
    @api threadId;
    isLoading = false;

    @api openaiKey;
    @api openaiAssistantId;

    @track messages = [];

    @api dialogId;

    // prompt
    prompt;

    // Error
    error_title;
    error_message;

    connectedCallback(){
        /*this.worker = new Worker(chrome.runtime.getURL('workers/openaiWorker/worker.js'));

        this.worker.addEventListener('message',this.handleMessage);
        this.worker.addEventListener('error', this.handleError);

        this.loadExistingThread();*/
       
    }

    disconnectedCallback(){
        /*if(this.worker){
            this.worker.removeEventListener('message',this.handleMessage);
            this.worker.removeEventListener('error', this.handleError);
            this.worker.terminate();
        }*/
        
    }


    @wire(connectStore, { store })
    storeChange({ einstein,application }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if(!isCurrentApp) return;
        //console.log('einstein',einstein)
        //console.log('einstein.currentTab?.id',einstein.currentTab?.id);
        const einsteinState = SELECTORS.einstein.selectById({einstein},lowerCaseKey(einstein.currentTab?.id));
        if(einsteinState){
            this.isLoading = einsteinState.isFetching;
            //console.log('einsteinState --->',einsteinState);
             if(einsteinState.error){
                 //this._abortingMap[apex.currentTab.id] = null; // Reset the abortingMap
                 //this.resetResponse();
                 this.global_handleError(einsteinState.error)
             }else if(einsteinState.data){
                 // Reset First
                 this.resetError();
                 //this.resetEditorError();
                 // Assign Data
                 this.messages = null;
                 this.messages = JSON.parse(JSON.stringify(einsteinState.data));
                 //this._responseCreatedDate = apexState.createdDate;
                 //this._abortingMap[apex.currentTab.id] = null; // Reset the abortingMap`
                 
                 //this.header_formatDate();
             
             }else if(einsteinState.isFetching){
                 //this.resetResponse();
                 this.resetError();
                 //this.resetEditorError();
             }
        }else{
            this.resetError();
            this.isLoading = false;
        }

        
        
    }


    /** Methods **/

    resetError = () => {
        this.error_title = null;
        this.error_message = null;
    }

    scrollToBottom = () => {
        window.setTimeout(()=> {
            const messageElements = this.template.querySelectorAll('assistant-message');
            if(this.isLoading){
                this.template.querySelector('.slds-chat-listitem').scrollIntoView({ behavior: 'smooth', block: 'end' });
            }else{
                messageElements[messageElements.length - 1].scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
            
        },100);
    }

    /** Events **/

    handleInputChange = (e) => {
        this.prompt = e.target.value;
        //console.log('e.target.value',e.target.value);
    }

    handleSendClick = () => {
        const { einstein } = store.getState();
        const value = this.template.querySelector('.slds-publisher__input').value;
        if(!isEmpty(value)){
            //this.isLoading = true;
            this.messages.push({
                role:ROLES.USER,
                content:value.trim(),
                id:guid()
            });

            const einsteinApexRequest = chat_template(this.messages);
            //console.log('einsteinApexRequest',einsteinApexRequest);
            this.scrollToBottom();
            const einsteinPromise = store.dispatch(
                EINSTEIN.einsteinExecuteModel({
                    connector:this.connector,
                    body:einsteinApexRequest,
                    tabId:einstein.currentTab.id,
                    messages:this.messages,
                    createdDate:Date.now()
                })
            )
            //this.worker.postMessage(this.generateMessageForWorker(value,null,this.threadId));
            this.template.querySelector('.slds-publisher__input').value  = null; // reset
        }
    }


    global_handleError = e => {
        let errors = e.message.split(':');
        if(errors.length > 1){
            this.error_title = errors.shift();
        }else{
            this.error_title = 'Error';
        }
        this.error_message = errors.join(':');
    }



    /** Getters **/

    get isSendButtonDisabled(){
        return this.isLoading || isEmpty(this.prompt);
    }

    get hasError(){
        return isNotUndefinedOrNull(this.error_message);
    }
    
}