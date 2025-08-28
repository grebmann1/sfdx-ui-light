import { LightningElement, api, track, wire } from 'lwc';
import {
    isEmpty,
    guid,
    isNotUndefinedOrNull,
    isUndefinedOrNull,
    safeParseJson,
    isChromeExtension
} from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
import { store, connectStore } from 'core/store';
import LOGGER from 'shared/logger';
import OpenAI from 'openai';
//import { tools } from 'agent/tools';
import { NavigationContext } from 'lwr/navigation';
import { CACHE_CONFIG } from 'shared/cacheManager';
const { Agent, Runner, user, system, tool, run, setDefaultOpenAIClient, setOpenAIAPI } = window.OpenAIAgentsBundle.Agents;
import { loggedInAgent, loggedOutAgent } from 'agent/agents';
import { readFileContent } from 'agent/utils';


export default class App extends ToolkitElement {
    navContext;
    @wire(NavigationContext)
    updateNavigationContext(navContext){
        this.navContext = navContext;
        window.navContext = navContext;
    }

    isLoading = false;
    isStreaming = false;

    @track _messages = [];
    set messages(val) {
        this._messages = val;
        this.scrollToBottom();
    }
    get messages() {
        return this._messages || [];
    }
    @track currentMessage;

    @api connector;
    @api isAudioRecorderDisabled = false;


    // Error
    error_title;
    error_message;
    errorIds;

    openaiKey;

    // Better to use a constant than a getter ! (renderCallback is called too many times)
    welcomeMessage = {
        role: 'assistant',
        content: 'Hello, I am the SF Toolkit Assistant, I can help you interact with Salesforce and Salesforce tools.',
        id: 'WELCOME_MESSAGE_ID',
    };

    // Agents
    currentAgent;

    _shouldFocusPublisher = false;

    currentStream;
    currentAbortController;


    @wire(connectStore, { store })
    storeChange({ application }) {
        this.openaiKey = application.openaiKey;
    }

    renderedCallback() {
        const publisher = this.template.querySelector('agent-publisher');
        if (publisher && this._shouldFocusPublisher) {
            publisher?.focusInput();
            this._shouldFocusPublisher = false;
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
            const messageElements = [...this.template.querySelectorAll('.chat-item')];
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

    /* groupFunctionCalls(messages) {
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
    } */

    getCurrentAlias() {
        // Try to get alias from connector (same as in getCurrentGlobalContext)
        const state = store.getState();
        const connector = state?.application?.connector;
        if (connector?.configuration?.alias) {
            return connector.configuration.alias;
        }
        return null;
    }

    formatMessage = (message,filesData) => {
        /* let result = this.messages.map((x, index, array) => ({
            ...x,
            content: Array.isArray(x.content) ? x.content[0].text : x.content,
            id: x.id === 'FAKE_ID' ? guid() : (x.id || x.callId ),
            isLastMessage: index === array.length - 1,
        }));

        const grouped = this.groupFunctionCalls(result);

        //LOGGER.log('formattedMessages', grouped);
        return grouped; */
        const result = {
            ...message,
            key: (message.id === 'FAKE_ID' ? guid() : (message.key ||message.id || message.callId )) || guid(),
        };

        // Process files and enrich the message with the file informations
        const files = (filesData || []).map(f => ({ name: f.name, type: f.type, size: f.size, _openaiFileId: f._openaiFileId, content: f.content }));
        if(files && files.length > 0){
            files.forEach(async file => {
                if (file.type && file.type.startsWith('image/') && file.content) {
                    result.content.push({
                        type: 'input_image',
                        image: file.content // data URL
                    });
                } else if (file.type === 'application/pdf' && file.content) {
                    // Upload PDF to OpenAI and get file_id
                    LOGGER.log('uploading PDF',file);
                    result.content.push({
                        type: 'input_file',
                        file_id: file._openaiFileId
                    });
                }
            });
        }
        return result;
    }

    executeAgent = async (prompt, files = []) => {
        this._executeAgent({prompt, directMessages: [], files});
    }

    executeAgentWithDirectMessages = async (directMessages) => {
        this._executeAgent({prompt: null, directMessages, files: []});
    }
    

    _executeAgent = async ({prompt, directMessages, files = []}) => {
        LOGGER.debug('Executing agent with params',{prompt, directMessages, files});
        // Helper to read file content (text for text files, base64 for others)
        

        let filesData = [];
        if (files && files.length > 0) {
            filesData = await Promise.all(files.map(readFileContent));
        }

        

        // Get OpenAI baseURL from config/cache, default to https://api.openai.com
        let baseUrl = store.getState().application?.openaiUrl;
        LOGGER.log('baseUrl ---> ',baseUrl);

        const openai = new OpenAI({
            dangerouslyAllowBrowser: true,
            apiKey: this.openaiKey,
            baseURL: baseUrl,
        });
        
        setDefaultOpenAIClient(openai);
        setOpenAIAPI('responses');


        LOGGER.log('getCurrentApplicationContext',this.getCurrentApplicationContext());
        // Use new agent selection
        const _agent = this.isUserLoggedIn ? loggedInAgent : loggedOutAgent;

        // Show loading state while uploading PDFs
        this.isLoading = true;        // Add each image as an input_image message, and each PDF as input_file (after upload)
        for (const file of filesData) {
            if (file.type && file.type.startsWith('image/') && file.content) {
                // Nothing to do here
            } else if (file.type === 'application/pdf' && file.content) {
                // Upload PDF to OpenAI and get file_id
                try {
                    const uploadResponse = await openai.files.create({
                        file: new File([await fetch(file.content).then(r => r.arrayBuffer())], file.name, { type: file.type }),
                        purpose: 'user_data'
                    });
                    if (uploadResponse && uploadResponse.id) {
                        file._openaiFileId = uploadResponse.id;
                    }
                } catch (err) {
                    // Optionally handle upload error
                    LOGGER.error('PDF upload failed', err);
                }
            }
        }
        // Remove this.isLoading = false here (move to after stream end)

        // Add the user message to the UI (for chat display)
        if(prompt){
            let uiMessage = user(prompt);
            this.messages = [...this.messages, this.formatMessage(uiMessage,filesData)];
        } else if(directMessages){
            this.messages = [...this.messages, ...directMessages];
        }

        // Build messages array for the agent
        let messages = [...this.messages]; // previous messages if needed

        LOGGER.log('this.messages',messages);
        // For now, we only use the general agent as the current agent. We might use other agents in the background.
        //const _agent = this.currentAgent || generalAgent;
        const runner = new Runner({
            model: 'gpt-4.1-mini',
        });

        try{
            let context = `
                    Context:
                        ${await this.getCurrentGlobalContext()}
                        ${await this.getCurrentApplicationContext()}
                    `;
            LOGGER.log('context',context);
            this.currentAbortController = new AbortController();
            const stream = await runner.run(
                _agent,
                messages,
                {
                    stream: true,
                    maxTurns: 25,
                    context,
                    signal: this.currentAbortController?.signal,
                }
            );
            LOGGER.log('stream',stream);
            this.currentStream = stream;
            this.isStreaming = true;
            for await (const event of stream) {
                if (event.type === 'raw_model_stream_event') {
                    const data = event.data;
                    if(data.type === 'response_started'){

                    } else if(data.type === 'model') {
                        // Model responses
                        const _event = data.event;
                        // Response is now streaming, we are not loading anymore
                        if(_event.type === 'response.output_item.added'){
                            const item = _event.item;
                            this.currentMessage = {... item};
                            this.isLoading = false; // We are not loading anymore, we are streaming the response
                        }
                    } else if(data.type === 'response_done'){
                        // Nothing to do here
                    }else if(data.type === 'output_text_delta'){
                        //LOGGER.debug('Chunks --> ', event.data.delta);
                        if(isUndefinedOrNull(this.currentMessage)){
                            this.currentMessage = {
                                id: guid(),
                                content: ''
                            };
                        }
                        this.currentMessage.content += data.delta;
                        this.scrollToBottom();
                    }
                }
                if (event.type === 'run_item_stream_event') {
                    // Raw Item is the message from the tool call
                    if (event.item && event.item.rawItem) {
                        this.messages = [...this.messages, this.formatMessage(event.item.rawItem,[])];
                    }
                    LOGGER.debug('Run Item Stream Event -->',JSON.parse(JSON.stringify(event)));
                }
            }
    
            // handle end of stream
            this.handleEndOfStream(stream);
        }catch(e){
            LOGGER.error('Error running agent',e);
            this.isLoading = false;
            this.isStreaming = false;
        } finally {
            this.currentAbortController = null;
        }
    }

    stopAgent = () => {
        if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = null;
        }
        this.isLoading = false;
    };

    /** Agents Helpers **/

    processEndOfStream = async (stream) => {
        const lastItem = [...stream.newItems].pop();
        const lastOutputName = lastItem.rawItem?.name;
        //let storeHistory = true;
        if(stream.lastAgent.toolUseBehavior?.stopAtToolNames?.includes(lastOutputName)){
            const outputContent = lastItem.output?.content;
            if(outputContent && !lastItem.output?.isError){
                const userMessage = user('');
                userMessage.content = outputContent;
                //storeHistory = false;
                this.executeAgentWithDirectMessages([this.formatMessage(userMessage,[])]);
            }else if(lastItem.output?.isError){
                this.executeAgentWithDirectMessages([]); // Dry run to process the error (if possible)
            }else{
                LOGGER.error('No output content',lastItem);
            }
        }
        //LOGGER.debug('stream history',JSON.parse(JSON.stringify(this.messages)));
        LOGGER.debug('stream history',JSON.parse(JSON.stringify(stream.history)));
    }

    handleEndOfStream = async (stream) => {
        await stream.completed;
        LOGGER.log('###### stream completed ######',stream);

        // Reset the current message
        this.currentMessage = null;
        // Reset the streaming state
        this.isStreaming = false;
        // Set the current agent
        this.currentAgent = stream.lastAgent;
        // Store the history
        this.processEndOfStream(stream);
        this._shouldFocusPublisher = true;
    }

    getCurrentGlobalContext = async() => {
        const state = store.getState();
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
        let contextText = `## SF Toolkit (Saleforce Context)`;
        contextText += `\nUser is logged in: ${isLoggedIn}`;
        contextText += `\nUser: ${displayName} (${email})`;
        contextText += `\nOrg Alias: ${alias}`;
        contextText += `\nInstance URL: ${instanceUrl}`;
        contextText += `\nCurrent Application: ${currentApplication}`;

        if(isChromeExtension()){
            contextText += `\n${await this.chromeContext()}`;
        }
        return contextText;
    }

    getCurrentApplicationContext = () => {
        const state = store.getState();
        const currentApplication = state?.application?.currentApplication;
        switch(currentApplication){
            case 'soql/app':
                return this.soqlContext();
            case 'anonymousApex/app':
                return this.apexContext();
            case 'api/app':
                return this.apiContext();
            case 'agent': // Limited mode
                return this.sidePanelContext();
            default:
                return '';
        }
    }

    apexContext = () => {
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

    soqlContext = () => {
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

    apiContext = () => {
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

    sidePanelContext = () => {
        let contextText = 'You are working in the side panel of the Salesforce Toolkit.';
            contextText += `\nYou are working in Limited mode.`;
        return contextText;
    }


    chromeContext = async () => {
        if (!isChromeExtension()) {
            return 'Chrome API is not available in this environment.';
        }
        try {
            // Get current window
            const currentWindow = await window.chrome.windows.getCurrent({ populate: true });
            // Get current tab
            const tabs = await window.chrome.tabs.query({ active: true, currentWindow: true });
            const currentTab = tabs && tabs[0] ? tabs[0] : null;
            let contextText = '## Chrome Context:';
            if (currentWindow) {
                contextText += `\nCurrent Window: ${JSON.stringify(
                    {
                        id: currentWindow.id,
                        incognito: currentWindow.incognito,
                        tabs: currentWindow.tabs.map(
                            t => ({
                                id: t.id,
                                title: t.title,
                                url: t.url,
                                groupId: t.groupId,
                            })
                        ),
                        totalTabs: currentWindow.tabs.length,
                    }
                )}`;
            }
            if (currentTab) {
                contextText += `\nCurrent Tab: ${JSON.stringify(
                    {
                        id: currentTab.id,
                        title: currentTab.title,
                        url: currentTab.url,
                    }
                )}`;
            }
            if (!currentWindow && !currentTab) {
                contextText += '\nNo active window or tab found.';
            }
            return contextText;
        } catch (err) {
            return `Error retrieving Chrome context: ${err.message}`;
        }
    }

    /** Events **/

    handleStopClick = async e => {
        this.stopAgent();
    };

    handleClearClick = async e => {
        this.messages = [];
    };

    handleSendClick = async (e) => {
        const value = e.detail.prompt;
        const files = e.detail.files || [];
        if(isEmpty(this.openaiKey)){
            this.error_title = 'Error';
            this.error_message = 'No OpenAI key found';
            return;
        }
        if (!isEmpty(value) || files.length > 0) {
            this.executeAgent(value.trim(), files);
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