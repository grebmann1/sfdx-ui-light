import { LightningElement,api,track,wire} from "lwc";
import { isUndefinedOrNull,isEmpty,ROLES,guid,lowerCaseKey,isNotUndefinedOrNull,isChromeExtension,loadExtensionConfigFromCache,CACHE_CONFIG,safeParseJson } from "shared/utils";
import ToolkitElement from 'core/toolkitElement';
import SaveModal from "assistant/saveModal";
import { GLOBAL_EINSTEIN } from 'assistant/utils';
import { generateInstructionForAssistant } from 'agent/utils';

import { store,connectStore,AGENTBUILDER,SELECTORS} from 'core/store';
const LATEST_MODEL = 'sfdc_ai__DefaultGPT4Omni';
const DEFAULT_LOADING_MESSAGE = 'Analyzing your request';
export default class Dialog extends ToolkitElement {

    isLoading = false;
    loadingMessage;

    @track messages = [];
    @api dialogId;

    // prompt
    prompt;

    // Error
    error_title;
    error_message;
    errorIds;

    // openaiKey
    @api openaiKey;
    isInjected;

    // monitoring
    @track deploymentIds = [];

    connectedCallback(){}

    disconnectedCallback(){}

    


    @wire(connectStore, { store })
    storeChange({ agentBuilder,application }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication)
        if(!isCurrentApp) return;


        // Reset First
        this.resetError();
        this.messages = JSON.parse(JSON.stringify(agentBuilder.messages));
        this.isLoading = agentBuilder.isFetching;
        if(agentBuilder.error){
            this.global_handleError(agentBuilder.error);
        }
        this.scrollToBottom();

        // Update Loading Message
        if(agentBuilder.loadingMessage){
            this.loadingMessage = agentBuilder.loadingMessage;
        }
    }


    /** Methods **/

    resetError = () => {
        this.error_title = null;
        this.error_message = null;
    }

    scrollToBottom = () => {
        window.setTimeout(()=> {
            
            if(this.isLoading){
                const loadingMessageEl = this.template.querySelector('.slds-chat-listitem');
                if(loadingMessageEl){
                    loadingMessageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }else{
                const messageElements = [...this.template.querySelectorAll('assistant-message')];
                if(messageElements.length > 0){
                    messageElements[messageElements.length - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
            
        },100);
    }

    /** Events **/

    /*handleRenameClick = () => {
        const { einstein } = store.getState();
        //console.log('einstein',einstein);
        SaveModal.open({
            title:'Rename Dialog',
            name:einstein.name
        }).then(async data => {
            //console.log('data',data);
        })
    }*/

    handleInputChange = (e) => {
        this.prompt = e.target.value;
    }

    handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent the default behavior of Enter key
            this.handleSendClick();
        }
    }

    handleClearClick = (e) => {
        // clearDialog (we reset from the parent app !!!)
    
    }

    handleSpeechChange = (e) => {
        const speech = e.detail.value;
        //console.log('speech data',speech);
        this.prompt = speech;
        this.template.querySelector('.slds-publisher__input').value = speech;
    }

    @api
    handleStartClick = async () => {
        const res = await this.connector.conn.identity();
    
        let messages = [
            {
                role:ROLES.USER,
                content:generateInstructionForAssistant(res.display_name || 'User'),
                id:guid(),
                hidden:true
            },
            // This is only for testing ! (to be removed)
            /*{
                role:ROLES.SYSTEM,
                content: `Hello Michael Tietze! Let's get started with the onboarding of a new agent for you. Could you please provide me with the following information?
                    1. Company Name
                    2. Company's Website
                    3. Company's Industry
                    Once I have this information, we can move on to discuss the specific business requirements for the agent.`,
                id:guid()
            },
            {
                role:ROLES.USER,
                content:`The company is Cocacola that is operating in the beverage industry and their website is : https://www.coca-cola.com/ch/fr
The agent should answer any question related to the products from the company.
The agent should avoid any political question and only talk about the quality of the products without saying anything negative.
Process directly.`,
                id:guid(),
            }*/
        ];

        this.sendRequestToLLM(messages);
        
    }

    handleSendClick = () => {
        const { agentBuilder } = store.getState();
        const value = this.template.querySelector('.slds-publisher__input').value;
        const connector = this.connector || this.legacyConnector;

        // Validate Connector
        if(isUndefinedOrNull(connector)){
            this.error_title = 'Error';
            this.error_message = 'Select a valid Salesforce Instance';
            return;
        }

        const messages = this.messages;

        if(!isEmpty(value)){
            //this.isLoading = true;
            messages.push({
                role:ROLES.USER,
                content:value.trim(),
                id:guid()
            });

            // sfdc_ai__DefaultGPT35Turbo ## Will provide possibility to select your model
            //const einsteinApexRequest = chat_template(LATEST_MODEL,this.cleanedMessages);
            //console.log('einsteinApexRequest',einsteinApexRequest);
            this.scrollToBottom();
            this.sendRequestToLLM(messages);
        }
    }

    sendRequestToLLM = (messages) => {
        const agentBuilderPromise = store.dispatch(
            AGENTBUILDER.agentBuilderExecutePrompt({
                messages
            })
        );
        this.template.querySelector('.slds-publisher__input').value  = null; // reset
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

    handleRetryMessage = (e) => {
        
    }
    

    /** Getters **/


    get cleanedMessages(){
        const { agentBuilder } = store.getState();
        const filteredMessages = this.messages.filter(x => !agentBuilder.errorIds.includes(x.id)); // Removing the errors
        const lastTenMessages = filteredMessages.slice(-10); // Taking only the last 10 messages
        return lastTenMessages;
    }

    get formattedMessages(){
        const { agentBuilder } = store.getState();

        return this.messages
        .filter(x => !x.hidden && isNotUndefinedOrNull(x.content))
        .filter(x => x.role != ROLES.TOOL || x.isDeployment)
        .filter(x => x.role != ROLES.SYSTEM)
        .map((x, index, array) => ({
            ...x,
            hasError: agentBuilder.errorIds.includes(x.id),
            deploymentData:x.isDeployment?safeParseJson(x.content):null,
            isLastMessage:index === array.length - 1 // ERROR & LAST MESSAGE from User => hasError (Used for retrial)
        }));
    }

    get isAudioAssistantDisplayed(){
        //console.log('this.openaiKey',this.openaiKey)
        return !isEmpty(this.openaiKey) && !isChromeExtension();
    }

    get isClearButtonDisabled(){
        return this.isLoading || this.messages.length == 0;
    }

    get isSendButtonDisabled(){
        return this.isLoading || isEmpty(this.prompt);
    }

    get isStartButtonDisabled(){
        return this.isLoading; // need to add other logic
    }

    get hasError(){
        return isNotUndefinedOrNull(this.error_message);
    }
    
}