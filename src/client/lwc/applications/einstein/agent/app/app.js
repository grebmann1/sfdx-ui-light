import { LightningElement, api, track, wire } from 'lwc';
import {
    isUndefinedOrNull,
    isEmpty,
    ROLES,
    guid,
    lowerCaseKey,
    isNotUndefinedOrNull,
    isChromeExtension,
    runActionAfterTimeOut
} from 'shared/utils';
import { cacheManager, CACHE_CONFIG, loadExtensionConfigFromCache } from 'shared/cacheManager';
import ToolkitElement from 'core/toolkitElement';
import { GLOBAL_EINSTEIN, chat_template } from 'assistant/utils';
import { store, connectStore, EINSTEIN, SELECTORS } from 'core/store';
import LOGGER from 'shared/logger';
import OpenAI from 'openai';
import { tools } from 'agent/utils';
import { NavigationContext, CurrentPageReference, navigate } from 'lwr/navigation';
const { Agent,tool,run,setDefaultOpenAIClient,setOpenAIAPI } = window.OpenAIAgentsBundle.Agents;
import { agents } from 'agent/utils';

export default class App extends ToolkitElement {
    navContext;
    @wire(NavigationContext)
    updateNavigationContext(navContext){
        this.navContext = navContext;
        window.navContext = navContext;
    }

    isLoading = false;

    @track messages = [];
    @track currentMessage;

    @api connector;


    // Error
    error_title;
    error_message;
    errorIds;

    openaiKey;

    // Better to use a constant than a getter ! (renderCallback is called too many times)
    welcomeMessage = {
        role: 'assistant',
        content: 'Hello, I am the SF Toolkit Assistant, I can help you with your Salesforce data.',
        id: 'WELCOME_MESSAGE_ID',
    };

    // Agents
    currentAgent;



    @wire(connectStore, { store })
    storeChange({ application }) {
        this.openaiKey = application.openaiKey;
    }

    /** Methods **/

    resetError = () => {
        this.error_title = null;
        this.error_message = null;
    };

    scrollToBottom = () => {
        window.setTimeout(() => {
            // Find all assistant-message elements
            const messageElements = [...this.template.querySelectorAll('agent-message')];
            // Scroll to the last message (user or assistant)
            const lastMessage = messageElements[messageElements.length - 1];
            if (lastMessage) {
                lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
        }, 1);
    };

    directUpdateUI = (element,message) => {
        if (element && element.item) {
            element.updateItem(message);
        }
    }

    /** Events **/


    handleClearClick = e => {
        this.messages = [];
        this.scrollToBottom();
    };

    handleSendClick = async (e) => {
        const value = e.detail.prompt;
        if(isEmpty(this.openaiKey)){
            this.error_title = 'Error';
            this.error_message = 'No OpenAI key found';
            return;
        }
        if (!isEmpty(value)) {
            this.executeAgent(value.trim());
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

    formatMessage = (message) => {
        /* let result = this.messages.map((x, index, array) => ({
            ...x,
            content: Array.isArray(x.content) ? x.content[0].text : x.content,
            id: x.id === 'FAKE_ID' ? guid() : (x.id || x.callId ),
            isLastMessage: index === array.length - 1,
        }));

        const grouped = this.groupFunctionCalls(result);

        //LOGGER.log('formattedMessages', grouped);
        return grouped; */
        return {
            ...message,
            key: message.id === 'FAKE_ID' ? guid() : (message.id || message.callId ),
        };
    }
    

    executeAgent = async (prompt) => {

        const storeHistory = async (stream) => {
            
            await stream.completed;
            //LOGGER.debug('stream completed',stream);
            //LOGGER.debug('stream history',JSON.parse(JSON.stringify(this.messages)));
            //this.messages = stream.history;
            LOGGER.debug('stream history',JSON.parse(JSON.stringify(stream.history)));
        }

        const handleEndOfStream = async (stream) => {
            await stream.completed;
            this.currentMessage = null;
            this.currentAgent = stream.lastAgent;
        }

        const getCurrentGlobalContext = () => {
            const state = store.getState();
            LOGGER.log('state',state);
            const connector = state?.application?.connector;
            const currentApplication = state?.application?.currentApplication;
            const isLoggedIn = isNotUndefinedOrNull(connector);
            let email = 'Not available';
            let displayName = 'Not available';
            let instanceUrl = 'Not available';
            let alias = 'Not available';
            if (isLoggedIn && connector?.configuration) {
                const userInfo = connector.configuration.userInfo || {};
                email = userInfo.email || 'Not available';
                displayName = userInfo.display_name || 'Not available';
                instanceUrl = connector.configuration.instanceUrl || 'Not available';
                alias = connector.configuration.alias || 'Not available';
            }
            let contextText = `User is logged in: ${isLoggedIn}`;
            contextText += `\nUser: ${displayName} (${email})`;
            contextText += `\nOrg Alias: ${alias}`;
            contextText += `\nInstance URL: ${instanceUrl}`;
            contextText += `\nCurrent Application: ${currentApplication}`;
            return contextText;
        }

        const getCurrentApplicationContext = () => {
            const state = store.getState();
            const currentApplication = state?.application?.currentApplication;
            switch(currentApplication){
                case 'soql/app':
                    return soqlContext();
                case 'anonymousApex/app':
                    return apexContext();
                case 'api/app':
                    return apiContext();
                default:
                    return '';
            }
        }

        const apexContext = () => {
            const apex = store.getState().apex;
            LOGGER.log('apex',apex);
            const currentTab = apex?.currentTab;
            let contextText = `Current Apex Tab: ${currentTab?.id}`;
            contextText += `\n${JSON.stringify(currentTab)}`;

            // Not sure if we need to add all the tabs to the context
            const tabs = apex?.tabs;
            if(tabs?.length > 0){
                contextText += `\nAll Apex Tabs: ${tabs.length}`;
                contextText += `\n${JSON.stringify(tabs)}`;
            }
            return contextText;
        }

        const soqlContext = () => {
            const soql = store.getState().soql;
            LOGGER.log('soql',soql);
            let contextText = `Current SOQL Tab: ${soql?.currentTab?.id}`;
            contextText += `\n${JSON.stringify(soql?.currentTab)}`;

            // Not sure if we need to add all the tabs to the context
            const tabs = soql?.tabs;
            if(tabs?.length > 0){
                contextText += `\nAll SOQL Tabs: ${tabs.length}`;
                contextText += `\n${JSON.stringify(tabs)}`;
            }
            return contextText;
        }

        const apiContext = () => {
            const api = store.getState().api;
            LOGGER.log('api',api);
            let contextText = `Current API Tab: ${api?.currentTab?.id}`;
            contextText += `\n${JSON.stringify(api?.currentTab)}`;

            // Not sure if we need to add all the tabs to the context
            const tabs = api?.tabs;
            if(tabs?.length > 0){
                contextText += `\nAll API Tabs: ${tabs.length}`;
                contextText += `\n${JSON.stringify(tabs)}`;
            }
            return contextText;
        }

        const openai = new OpenAI({
            dangerouslyAllowBrowser: true,
            apiKey: this.openaiKey,
        });
        
        setDefaultOpenAIClient(openai);
        setOpenAIAPI('chat_completions');

        // all tools
        const _loggedInTools = [
            ...tools.soql, 
            ...tools.apex, 
            ...tools.api,
            ...tools.connections,
            ...tools.general
        ];

        // logged out tools
        const _loggedOutTools = [
            ...tools.connections,
            ...tools.general
        ];
        LOGGER.log('this.isUserLoggedIn',this.isUserLoggedIn);
        LOGGER.log('getCurrentGlobalContext',getCurrentGlobalContext());
        LOGGER.log('getCurrentApplicationContext',getCurrentApplicationContext());
        const _filteredTools = this.isUserLoggedIn ? [..._loggedInTools,..._loggedOutTools] : [..._loggedOutTools];

        // Disable parallel tool calls for now as for the UI, the performance is not good enough
        const generalAgent = agents.general;
            generalAgent.tools = _filteredTools;

        // Array to accumulate messages
        let agentMessage = {
            role: 'user',
            content: prompt,
            id: guid(),
        };

        // Add the user message to the UI
        this.messages.push(this.formatMessage(agentMessage));
        this.scrollToBottom();
        
        LOGGER.log('this.messages',this.messages);
        // For now, we only use the general agent as the current agent. We might use other agents in the background.
        const _agent = this.currentAgent || generalAgent;
        const stream = await run(_agent, this.messages, {
            stream: true,
            context: `
                ${getCurrentGlobalContext()}
                ${getCurrentApplicationContext()}
            `,
        });

        for await (const event of stream) {
            if (event.type === 'raw_model_stream_event') {
                if(event.data.type === 'response_started'){
                    const role = event.data.providerData?.choices[0]?.delta?.role || 'assistant';
                    const hasToolCall = event.data.providerData?.choices[0]?.delta?.tool_calls?.length > 0;
                    if(hasToolCall){
                        const toolCall = event.data.providerData?.choices[0]?.delta?.tool_calls[0];
                        this.currentMessage = {
                            callId: toolCall.id,
                            name: toolCall.name,
                            arguments: toolCall.arguments,
                            type: 'function_call',// this field is used to display the spinner in the UI, it auto disappears when the tool call is done (This status doesn't exist in the OpenAI API !!!)
                        };
                    }else{
                        this.currentMessage = {
                            role,
                            id: event.data.providerData.id,
                            content: ''
                        };
                    }
                } else if(event.data.type === 'response_done'){
                    // Nothing to do here
                }else if(event.data.type === 'output_text_delta'){
                    //LOGGER.debug('Chunks --> ', event.data.delta);
                    this.currentMessage.content += event.data.delta;
                    this.scrollToBottom();
                }
            }
            if (event.type === 'run_item_stream_event') {
                // Raw Item is the message from the tool call
                if (event.item && event.item.rawItem) {
                    //LOGGER.debug(event.item.type,event.item.rawItem);
                    this.messages.push(this.formatMessage(event.item.rawItem));
                    this.scrollToBottom();
                }
                LOGGER.debug('event',JSON.parse(JSON.stringify(event)));
            }
        }
        // Store the history
        storeHistory(stream);

        // handle end of stream
        handleEndOfStream(stream);

        this.scrollToBottom();
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


    /**
     * Groups function_call and function_call_result messages together by callId so they appear consecutively and in order.
     * @param {Array} messages - The array of normalized message objects.
     * @returns {Array} - The grouped messages array.
     */
    groupFunctionCalls(messages) {
        const grouped = [];
        const usedCallIds = new Set();
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            if (
                msg.type === 'function_call' &&
                msg.callId &&
                !usedCallIds.has(msg.callId)
            ) {
                const matchIdx = messages.findIndex(
                    (m, idx) =>
                        idx > i &&
                        m.type === 'function_call_result' &&
                        m.callId === msg.callId
                );
                if (matchIdx !== -1) {
                    grouped.push(msg, messages[matchIdx]);
                    usedCallIds.add(msg.callId);
                    usedCallIds.add(messages[matchIdx].callId);
                    continue;
                }
            }
            if (
                msg.type === 'function_call_result' &&
                msg.callId &&
                usedCallIds.has(msg.callId)
            ) {
                continue;
            }
            grouped.push(msg);
        }
        return grouped;
    }


    get hasError() {
        return isNotUndefinedOrNull(this.error_message);
    }

    get isUserLoggedIn() {
        return isNotUndefinedOrNull(store.getState()?.application?.connector);
    }

    get displayedMessages() {
        const msgs = this.messages;
        return msgs.length > 1 ? msgs.slice(0, -1) : [];
    }
}
