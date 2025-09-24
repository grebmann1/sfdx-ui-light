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

    // Error
    error_title;
    error_message;
    errorIds;

    openaiKey;

    connectedCallback() {x
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
            if(einsteinState.isFetching){
                // Scroll to the bottom when the dialog is fetching
                this.scrollToBottom();
            }
         
            if (einsteinState.error) {
                //this._abortingMap[apex.currentDialog.id] = null; // Reset the abortingMap
                //this.resetResponse();
                this.global_handleError(einsteinState.error);
                this.scrollToBottom();
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
            // Find all assistant-message elements
            const messageElements = [...this.template.querySelectorAll('assistant-message'),...this.template.querySelectorAll('.slds-chat-listitem')];
            // Scroll to the last message (user or assistant)
            const lastMessage = messageElements[messageElements.length - 1];
            if (lastMessage) {
                lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
        }, 50);
    };

    directUpdateUI = (element,message) => {
        LOGGER.log('directUpdateUI --> ',element,message);
        if (element && element.item) {
            element.updateItem(message);
        }
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

    test = async () => {
        /* const openai = new OpenAI({
            dangerouslyAllowBrowser:true,
            apiKey: this.openaiKey, // defaults to process.env["OPENAI_API_KEY"]
        });
        setDefaultOpenAIClient(openai);
        setOpenAIAPI('chat_completions');
        const historyFunFact = tool({
            // The name of the tool will be used by the agent to tell what tool to use.
            name: 'history_fun_fact',
            // The description is used to describe **when** to use the tool by telling it **what** it does.
            description: 'Give a fun fact about a historical event',
            // This tool takes no parameters, so we provide an empty Zod Object.
            parameters: z.object({}),
            execute: async () => {
                // The output will be returned back to the Agent to use
                return 'Sharks are older than trees.';
            },
        });
        const agent = new Agent({
            name: 'History Tutor',
            instructions:
                'You provide assistance with historical queries. Explain important events and context clearly.',
            // Adding the tool to the agent
            tools: [historyFunFact],
        });

        const result = await run(agent, 'What is the capital of France? Give me a fun fact about the history of France.',{
            stream: true,
        });
        for await (const event of result) {
            // these are the raw events from the model
            if (event.type === 'raw_model_stream_event') {
              console.log(`${event.type} %o`, event.data);
            }
            // agent updated events
            if (event.type === 'agent_updated_stream_event') {
              console.log(`${event.type} %s`, event.agent.name);
            }
            // Agent SDK specific events
            if (event.type === 'run_item_stream_event') {
              console.log(`${event.type} %o`, event.item);
            }
        } */
    }

    handleSendClick = async () => {
        const { einstein } = store.getState();
        const value = this.template.querySelector('.slds-publisher__input').value;
        const connector = this.connector || this.legacyConnector;

        // Validate Connector
        if (isUndefinedOrNull(connector) && this.provider === 'apex') {
            this.error_title = 'Error';
            this.error_message = 'Select a valid Salesforce Instance';
            return;
        }

        if (!isEmpty(value)) {
            this.messages.push({
                role: ROLES.USER,
                content: value.trim(),
                id: guid(),
            });
            LOGGER.debug('handleSendClick', this.provider, this.model);
            if (this.provider === 'apex') {
                // Existing Apex flow
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
                // OpenAI flow using Redux thunk with streaming
                LOGGER.debug('handleSendClick', this.provider, this.model);
                try {
                    await store.dispatch(
                        EINSTEIN.openaiExecuteModel({
                            messages: this.messages,
                            tabId: einstein.currentDialogId,
                            alias: GLOBAL_EINSTEIN,
                            model: this.model,
                            aiProvider: 'openai',
                            onStream: (message) => {
                                LOGGER.log('message --> ',message);
                                const lastElement = [...this.template.querySelectorAll('assistant-message')].pop();
                                // Optionally force re-render if needed
                                this.scrollToBottom();
                                this.directUpdateUI(lastElement,message);
                            }
                        })
                    );
                } catch (err) {
                    LOGGER.error('###### Error in openaiExecuteModel:', err);
                    this.error_title = 'OpenAI Error';
                    this.error_message = err.message;
                }
            }
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

    handleRetryMessage = async e => {
        const { einstein } = store.getState();
        const retryMessage = e.detail;
        const connector = this.connector || this.legacyConnector;
        // Validate Connector
        if (isUndefinedOrNull(connector) && this.provider === 'apex') {
            this.error_title = 'Error';
            this.error_message = 'Select a valid Salesforce Instance';
            this.scrollToBottom();
            return;
        }
        // Replace the retried message in the messages array
        this.messages = [].concat(
            this.messages.filter(x => x.id != retryMessage.id),
            [retryMessage]
        );
        this.scrollToBottom();
        if (this.provider === 'apex') {
            const einsteinApexRequest = chat_template(LATEST_MODEL_APEX, this.cleanedMessages);
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
                            this.directUpdateUI(lastElement, message);
                        }
                    })
                );
            } catch (err) {
                this.error_title = 'OpenAI Error';
                this.error_message = err.message;
                this.scrollToBottom();
            }
        }
    }

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
}
