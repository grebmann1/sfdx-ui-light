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
import ASSISTANTS from 'ai/assistants';
import LOGGER from 'shared/logger';
import OpenAI from 'openai';
/* import { Agent,tool,run,setDefaultOpenAIClient,setOpenAIAPI } from '@openai/agents';
import { z } from 'zod'; */

const LATEST_MODEL_APEX = 'sfdc_ai__DefaultGPT4Omni';


export default class Dialog extends ToolkitElement {
    isLoading = false;

    @track messages = [];

    @api connector;
    @api dialogId;
    @api isMobile = false;
    @api provider = EINSTEIN.PROVIDER_OPTIONS[0].value;
    @api model = EINSTEIN.MODEL_OPTIONS[0].value;

    // prompt
    prompt;

    // File upload state (from publisher)
    selectedFiles = [];
    imagePreviews = {};
    dragActive = false;

    // Error
    error_title;
    error_message;
    errorIds;

    openaiKey;

    connectedCallback() {
        //this.checkForInjected();
        this.loadOpenAIKey();
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
    loadOpenAIKey = async () => {
        const openaiKey = store.getState().application.openaiKey;
        if(isNotUndefinedOrNull(openaiKey)){
            this.openaiKey = openaiKey;
        }
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
                // Autofocus the chat-textarea after update
                setTimeout(() => {
                    const textarea = this.template.querySelector('.chat-textarea');
                    if (textarea) textarea.focus();
                }, 0);
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
            // Find all assistant-message elements
            const messageElements = [...this.template.querySelectorAll('assistant-message')];
            // Scroll to the last message (user or assistant)
            const lastMessage = messageElements[messageElements.length - 1];
            if (lastMessage) {
                lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
        }, 50);
    };

    directUpdateUI = (element,message) => {
        if (element && element.item) {
            element.updateItem(message);
        }
    }
    triggerFileInput = () => {
        const fileInput = this.template.querySelector('.file-input');
        if (fileInput) {
            fileInput.value = '';
            fileInput.click();
        }
    };

    generateImagePreview(file) {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.imagePreviews = { ...this.imagePreviews, [file.name]: e.target.result };
            this.requestUpdate?.();
        };
        reader.readAsDataURL(file);
    }

    removeSelectedFile = (event) => {
        const name = event.target?.dataset?.filename;
        if (!name) return;
        this.selectedFiles = this.selectedFiles.filter(f => f.name !== name);
        const previews = { ...this.imagePreviews };
        delete previews[name];
        this.imagePreviews = previews;
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

    handleSendClick = async () => {
        const { einstein } = store.getState();
        const value = this.template.querySelector('.slds-publisher__input, .chat-textarea')?.value || '';
        const connector = this.connector || this.legacyConnector;

        // Validate Connector
        if (isUndefinedOrNull(connector) && this.provider === 'apex') {
            this.error_title = 'Error';
            this.error_message = 'Select a valid Salesforce Instance';
            return;
        }

        if (!isEmpty(value) || this.selectedFiles.length > 0) {
            this.messages.push({
                role: ROLES.USER,
                content: value.trim(),
                id: guid(),
                files: this.selectedFiles
            });
            LOGGER.debug('handleSendClick', this.provider, this.model);
            if (this.provider === 'apex') {
                const einsteinApexRequest = chat_template(LATEST_MODEL_APEX, this.cleanedMessages);
                this.scrollToBottom();
                store.dispatch(
                    EINSTEIN.einsteinExecuteModel({
                        connector,
                        alias: GLOBAL_EINSTEIN,
                        body: einsteinApexRequest,
                        tabId: einstein.currentDialogId,
                        messages: this.messages,
                        createdDate: Date.now(),
                    })
                );
            } else if (this.provider === 'openai') {
                try {
                    await store.dispatch(
                        EINSTEIN.openaiExecuteModel({
                            messages: this.messages,
                            tabId: einstein.currentDialogId,
                            alias: GLOBAL_EINSTEIN,
                            model: this.model,
                            aiProvider: 'openai',
                            onStream: (message) => {
                                const lastElement = [...this.template.querySelectorAll('assistant-message')].pop();
                                this.scrollToBottom();
                                this.directUpdateUI(lastElement,message);
                            }
                        })
                    );
                } catch (err) {
                    this.error_title = 'OpenAI Error';
                    this.error_message = err.message;
                }
            }
            // Reset input and files
            const input = this.template.querySelector('.slds-publisher__input, .chat-textarea');
            if (input) input.value = null;
            this.selectedFiles = [];
            this.imagePreviews = {};
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
        const einsteinApexRequest = chat_template(LATEST_MODEL_APEX, this.cleanedMessages);

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


    

    handleFileChange = (event) => {
        const files = Array.from(event.target.files || []);
        files.forEach(file => {
            if (!this.selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
                this.selectedFiles = [...this.selectedFiles, file];
                if (file.type && file.type.startsWith('image/')) {
                    this.generateImagePreview(file);
                }
            }
        });
    };

    handleDragOver = (event) => {
        event.preventDefault();
        this.dragActive = true;
        this.template.querySelector('.file-upload-container').classList.add('drag-active');
    };

    handleDragLeave = (event) => {
        event.preventDefault();
        this.dragActive = false;
        this.template.querySelector('.file-upload-container').classList.remove('drag-active');
    };

    handleDrop = (event) => {
        event.preventDefault();
        this.dragActive = false;
        this.template.querySelector('.file-upload-container').classList.remove('drag-active');
        const files = Array.from(event.dataTransfer.files || []);
        files.forEach(file => {
            // Only accept images and PDFs
            if ((file.type && file.type.startsWith('image/')) || file.type === 'application/pdf') {
                if (!this.selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
                    this.selectedFiles = [...this.selectedFiles, file];
                    if (file.type && file.type.startsWith('image/')) {
                        this.generateImagePreview(file);
                    }
                }
            }
        });
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

    get hasFiles() {
        return this.selectedFiles.length > 0;
    }
    get filePills() {
        return this.selectedFiles.map(file => ({
            file,
            isImage: file.type && file.type.startsWith('image/'),
            preview: this.imagePreviews[file.name] || ''
        }));
    }

    get selectedFileName() {
        return this.selectedFiles.length === 1 ? this.selectedFiles[0].name : '';
    }
    get hasImagePreview() {
        return this.selectedFiles.some(f => f.type && f.type.startsWith('image/'));
    }
}
