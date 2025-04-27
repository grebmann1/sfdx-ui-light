import { LightningElement, api, track, wire } from 'lwc';
import {
    isUndefinedOrNull,
    isEmpty,
    ROLES,
    guid,
    lowerCaseKey,
    isNotUndefinedOrNull,
    isChromeExtension,
} from 'shared/utils';
import { cacheManager, CACHE_CONFIG, loadExtensionConfigFromCache } from 'shared/cacheManager';
import ToolkitElement from 'core/toolkitElement';
import SaveModal from 'assistant/saveModal';
import { GLOBAL_EINSTEIN, chat_template } from 'assistant/utils';
import { store, connectStore, EINSTEIN, SELECTORS } from 'core/store';
const LATEST_MODEL = 'sfdc_ai__DefaultGPT4Omni';
export default class Dialog extends ToolkitElement {
    isLoading = false;

    @track messages = [];

    @api connector;
    @api dialogId;
    @api isMobile = false;

    // prompt
    prompt;

    // Error
    error_title;
    error_message;
    errorIds;

    // openaiKey
    openaiKey;
    isInjected;

    connectedCallback() {
        this.checkForInjected();
        /*this.worker = new Worker(chrome.runtime.getURL('workers/openaiWorker/worker.js'));

        this.worker.addEventListener('message',this.handleMessage);
        this.worker.addEventListener('error', this.handleError);

        this.loadExistingThread();*/
    }

    disconnectedCallback() {
        /*if(this.worker){
            this.worker.removeEventListener('message',this.handleMessage);
            this.worker.removeEventListener('error', this.handleError);
            this.worker.terminate();
        }*/
    }

    /** Actions */
    checkForInjected = async () => {
        /** Deprecated: OpenAI Key is now stored in the store !!!!!  */
        /* let el = document.getElementsByClassName('injected-openai-key');
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
        } */
    };

    @wire(connectStore, { store })
    storeChange({ einstein, application }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if (!isCurrentApp) return;
        const einsteinState = SELECTORS.einstein.selectById(
            { einstein },
            lowerCaseKey(einstein.currentDialogId)
        );
        // Reset First
        this.resetError();
        if (einsteinState) {
            this.dialogId = einstein.currentDialogId;
            this.isLoading = einsteinState.isFetching;
            if (einsteinState.error) {
                //this._abortingMap[apex.currentDialog.id] = null; // Reset the abortingMap
                //this.resetResponse();
                this.global_handleError(einsteinState.error);
            } else if (einsteinState.data) {
                //this.resetEditorError();
                // Assign Data
                this.messages = null;
                this.messages = JSON.parse(JSON.stringify(einsteinState.data));
                //console.log('this.messages',this.messages);
                this.scrollToBottom();
                //this._responseCreatedDate = apexState.createdDate;
                //this._abortingMap[apex.currentDialog.id] = null; // Reset the abortingMap`

                //this.header_formatDate();
            } else if (!einsteinState.isFetching && isUndefinedOrNull(einsteinState.data)) {
                this.isLoading = false;
                this.messages = [];
            }
        } else {
            this.isLoading = false;
            this.messages = [];
        }
    }

    /** Methods **/

    resetError = () => {
        this.error_title = null;
        this.error_message = null;
    };

    scrollToBottom = () => {
        window.setTimeout(() => {
            const messageElements = [...this.template.querySelectorAll('assistant-message')].filter(
                x => x.isUser
            );
            if (this.isLoading) {
                this.template
                    .querySelector('.slds-chat-listitem')
                    .scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                messageElements[messageElements.length - 1].scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                });
            }
        }, 100);
    };

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

    handleInputChange = e => {
        this.prompt = e.target.value;
    };

    handleKeyDown = e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent the default behavior of Enter key
            this.handleSendClick();
        }
    };

    handleClearClick = e => {
        const { einstein } = store.getState();

        store.dispatch(
            EINSTEIN.reduxSlice.actions.clearDialog({
                id: einstein.currentDialogId,
                alias: GLOBAL_EINSTEIN,
            })
        );
    };

    handleSpeechChange = e => {
        const speech = e.detail.value;
        //console.log('speech data',speech);
        this.prompt = speech;
        this.template.querySelector('.slds-publisher__input').value = speech;
    };

    handleSendClick = () => {
        const { einstein } = store.getState();
        const value = this.template.querySelector('.slds-publisher__input').value;
        const connector = this.connector || this.legacyConnector;
        // Validate Connector
        if (isUndefinedOrNull(connector)) {
            this.error_title = 'Error';
            this.error_message = 'Select a valid Salesforce Instance';
            return;
        }

        if (!isEmpty(value)) {
            //this.isLoading = true;
            this.messages.push({
                role: ROLES.USER,
                content: value.trim(),
                id: guid(),
            });

            // sfdc_ai__DefaultGPT35Turbo ## Will provide possibility to select your model
            const einsteinApexRequest = chat_template(LATEST_MODEL, this.cleanedMessages);
            //console.log('einsteinApexRequest',einsteinApexRequest);
            this.scrollToBottom();
            const einsteinPromise = store.dispatch(
                EINSTEIN.einsteinExecuteModel({
                    connector,
                    alias: GLOBAL_EINSTEIN,
                    body: einsteinApexRequest,
                    tabId: einstein.currentDialogId,
                    messages: this.messages,
                    createdDate: Date.now(),
                })
            );
            //this.worker.postMessage(this.generateMessageForWorker(value,null,this.threadId));
            this.template.querySelector('.slds-publisher__input').value = null; // reset
        }
    };

    global_handleError = e => {
        let errors = e.message.split(':');
        if (errors.length > 1) {
            this.error_title = errors.shift();
        } else {
            this.error_title = 'Error';
        }
        this.error_message = errors.join(':');
    };

    handleRetryMessage = e => {
        const { einstein } = store.getState();
        const retryMessage = e.detail;
        const connector = this.connector || this.legacyConnector;
        // Validate Connector
        if (isUndefinedOrNull(connector)) {
            this.error_title = 'Error';
            this.error_message = 'Select a valid Salesforce Instance';
            return;
        }
        /** Retry **/
        this.messages = [].concat(
            this.messages.filter(x => x.id != retryMessage.id),
            [retryMessage]
        );
        const einsteinApexRequest = chat_template(LATEST_MODEL, this.cleanedMessages);

        const einsteinPromise = store.dispatch(
            EINSTEIN.einsteinExecuteModel({
                connector,
                alias: GLOBAL_EINSTEIN,
                body: einsteinApexRequest,
                tabId: einstein.currentDialogId,
                messages: this.messages,
                createdDate: Date.now(),
            })
        );
    };

    /** Getters **/

    get legacyConnector() {
        return super.connector;
    }

    get cleanedMessages() {
        const { einstein } = store.getState();
        const filteredMessages = this.messages.filter(x => !einstein.errorIds.includes(x.id)); // Removing the errors
        const lastTenMessages = filteredMessages.slice(-10); // Taking only the last 10 messages
        return lastTenMessages;
    }

    get formattedMessages() {
        const { einstein } = store.getState();
        return this.messages.map((x, index, array) => ({
            ...x,
            hasError: einstein.errorIds.includes(x.id),
            isLastMessage: index === array.length - 1, // ERROR & LAST MESSAGE from User => hasError (Used for retrial)
        }));
    }

    get isAudioAssistantDisplayed() {
        //console.log('this.openaiKey',this.openaiKey)
        return !isEmpty(this.openaiKey) && !isChromeExtension();
    }

    get isClearButtonDisabled() {
        return this.isLoading || this.messages.length == 0;
    }

    get isSendButtonDisabled() {
        return this.isLoading || isEmpty(this.prompt);
    }

    get hasError() {
        return isNotUndefinedOrNull(this.error_message);
    }
}
