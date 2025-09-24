import { api, track, wire } from 'lwc';
import {
    isEmpty,
    guid,
    isNotUndefinedOrNull,
    classSet
} from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
import { store, connectStore } from 'core/store';
import LOGGER from 'shared/logger';
import OpenAI from 'openai';
//import { tools } from 'agent/tools';
import { NavigationContext } from 'lwr/navigation';
import { CACHE_CONFIG, loadExtensionConfigFromCache, saveSingleExtensionConfigToCache } from 'shared/cacheManager';
const { Agent, Runner, user, system, tool, run, setDefaultOpenAIClient, setOpenAIAPI } = window.OpenAIAgentsBundle.Agents;
import { loggedInAgent, loggedOutAgent } from 'agent/agents';
import { readFileContent, StreamingAgentService, Message, Context } from 'agent/utils';

export default class App extends ToolkitElement {
    navContext;
    @wire(NavigationContext)
    updateNavigationContext(navContext){
        this.navContext = navContext;
        window.navContext = navContext;
    }

    
    @track selectedModel = 'gpt-5-mini';
    @track isSidePanelOpen = false;
    @track conversations = [
        { id: 'default', title: 'Conversation 1', messages: [] }
    ];
    @track activeConversationId = 'default';
    @track isEditingTitle = false;
    @track pendingTitle = '';

    @api connector;
    @api isAudioRecorderDisabled = false;

    // FileTree search config for conversations
    conversationSearchFields = ['name', 'id', 'title', 'keywords', 'searchText'];
    minSearchLengthForConversations = 1;
    hideSearchInputForConversations = false;
    includeFoldersInResultsForConversations = true;


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
    _shouldFocusPublisher = false;

    // Agents
    currentAgent = {};
    isStreamingMap = {};
    isLoadingMap = {};
    streamingAgentService = {};
    @track _messages = {};
    @track _streamingMessage = {};
    _pendingDelta = {};
    _streamingUpdateScheduled = {};
    _chunkBuffer = {};
    _chunkFlushTimer = {};
    _CHUNK_FLUSH_INTERVAL = 80; // ms


    @wire(connectStore, { store })
    storeChange({ application }) {
        this.openaiKey = application.openaiKey;
    }

    async connectedCallback() {
        await this.loadConversationsFromCache();
    }

    async loadConversationsFromCache() {
        LOGGER.log('--> loadConversationsFromCache');
        const config = await loadExtensionConfigFromCache([CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATIONS.key]);
        LOGGER.log('--> loadConversationsFromCache',config);
        const conversations = config[CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATIONS.key];
        if (conversations && Array.isArray(conversations)) {
            this.conversations = conversations;
            if(this.conversations.length === 0) {
                this.createNewConversation();
            } else {
                this.activeConversationId = this.conversations[0].id;
                this._messages[this.activeConversationId] = Message.formatStreamHistory(this.conversations[0].streamHistory) || [];
            }
        }
    }

    async saveConversationsToCache() {
        LOGGER.log('--> saveConversationsToCache',this.conversations);
        await saveSingleExtensionConfigToCache(CACHE_CONFIG.EINSTEIN_AGENT_CONVERSATIONS.key, this.conversations);
    }

    renderedCallback() {
        if (this.isEditingTitle && this.refs && this.refs.titleInput) {
            this.refs.titleInput.focus();
        }
    }

    /** Methods **/

    resetError = () => {
        this.error_title = null;
        this.error_message = null;
    };

    executeAgent = async (prompt, files = [], model = this.selectedModel) => {
        this._executeAgent({prompt, directMessages: [], files, model, currentConversationId: this.activeConversationId});
    }

    executeAgentWithDirectMessages = async (directMessages) => {
        this._executeAgent({prompt: null, directMessages, files: [], currentConversationId: this.activeConversationId});
    }
    

    _executeAgent = async ({prompt, directMessages, files = [], model = this.selectedModel, currentConversationId}) => {
        LOGGER.debug('Executing agent with params',{prompt, directMessages, files, currentConversationId});
        let filesData = [];
        if (files && files.length > 0) {
            filesData = await Promise.all(files.map(readFileContent));
        }
        let baseUrl = store.getState().application?.openaiUrl;
        LOGGER.log('baseUrl ---> ',store.getState());
        const openai = new OpenAI({
            dangerouslyAllowBrowser: true,
            apiKey: this.openaiKey,
            baseURL: baseUrl,
        });
        setDefaultOpenAIClient(openai);
        setOpenAIAPI('responses');
        LOGGER.log('getCurrentApplicationContext',Context.getCurrentApplicationContext(store));
        const _agent = this.isUserLoggedIn ? loggedInAgent : loggedOutAgent;
        this.isLoadingMap[currentConversationId] = true;
        for (const file of filesData) {
            if (file.type && file.type.startsWith('image/') && file.content) {
                // Nothing to do here
            } else if (file.type === 'application/pdf' && file.content) {
                try {
                    const uploadResponse = await openai.files.create({
                        file: new File([await fetch(file.content).then(r => r.arrayBuffer())], file.name, { type: file.type }),
                        purpose: 'user_data'
                    });
                    if (uploadResponse && uploadResponse.id) {
                        file._openaiFileId = uploadResponse.id;
                    }
                } catch (err) {
                    LOGGER.error('PDF upload failed', err);
                }
            }
        }
        // Set initial messages
        if(prompt){
            let uiMessage = user(prompt);
            const messages = [...(this._messages[currentConversationId] || [])];
            this._messages[currentConversationId] = Message.updateOrAppendMessage(messages, Message.formatMessage(uiMessage,filesData));
        } else if(directMessages){
            directMessages.forEach(msg => this._appendMessageIfNotExists(msg, currentConversationId));
        }
        let messages = [...this._messages[currentConversationId]];
        LOGGER.log('##### messages',messages);
        const runner = new Runner({
            model: model || 'gpt-5-mini',
        });
        try{
            let context = `
                Context:
                    ${await Context.getCurrentGlobalContext(store)}
                    ${await Context.getCurrentApplicationContext(store)}
                `;
            LOGGER.log('context',context);
            this._chunkBuffer[currentConversationId] = [];
            this._chunkFlushTimer[currentConversationId] = null;
            this.streamingAgentService[currentConversationId] = new StreamingAgentService(
                runner,
                _agent,
                messages,
                {
                    maxTurns: 25,
                    context,
                    onChunk: (chunk) => {
                        if (chunk.delta !== undefined) {
                            this._bufferChunk(chunk.delta, currentConversationId);
                        } else {
                            this._flushChunkBuffer(currentConversationId);
                            this._streamingMessage[currentConversationId] = { ...chunk };
                            this.isLoadingMap[currentConversationId] = false;
                        }
                    },
                    onToolEvent: (rawItem) => {
                        this._appendMessageIfNotExists(Message.formatMessage(rawItem,[]), currentConversationId);
                    },
                    onStreamEnd: (stream) => {
                        if (this._streamingMessage[currentConversationId]) {
                            this._appendMessageIfNotExists(this._streamingMessage[currentConversationId], currentConversationId);
                            this._streamingMessage[currentConversationId] = null;
                        }
                        this.handleEndOfStream(stream, currentConversationId);
                    },
                    onError: (e) => {
                        LOGGER.error('Error running agent',e);
                        this.isLoadingMap[currentConversationId] = false;
                        this.isStreamingMap[currentConversationId] = false;
                        this.global_handleError(e);
                    }
                }
            );
            await this.streamingAgentService[currentConversationId].startStreaming();
        } catch(e) {
            LOGGER.error('Error running agent',e);
            this.isLoadingMap[currentConversationId] = false;
            this.isStreamingMap[currentConversationId] = false;
            this.global_handleError(e);
        }
    }

    stopAgent = (currentConversationId) => {
        if (this.streamingAgentService[currentConversationId]) {
            this.streamingAgentService[currentConversationId].abort();
            this.streamingAgentService[currentConversationId] = null;
        }
        this.isLoadingMap[currentConversationId] = false;
    };

    /** Agents Helpers **/

    processEndOfStream = async (stream, currentConversationId) => {
        const lastItem = [...stream.newItems].pop();
        const lastOutputName = lastItem.rawItem?.name;
        //let storeHistory = true;
        if(stream.lastAgent.toolUseBehavior?.stopAtToolNames?.includes(lastOutputName)){
            const outputContent = lastItem.output?.content;
            if(outputContent && !lastItem.output?.isError){
                const userMessage = user('');
                userMessage.content = outputContent;
                //storeHistory = false;
                this.executeAgentWithDirectMessages([Message.formatMessage(userMessage,[])]);
            }else if(lastItem.output?.isError){
                this.executeAgentWithDirectMessages([], currentConversationId); // Dry run to process the error (if possible)
            }else{
                LOGGER.error('No output content',lastItem);
            }
        }
        //LOGGER.debug('stream history',JSON.parse(JSON.stringify(this.messages)));
        LOGGER.debug('stream history',JSON.parse(JSON.stringify(stream.history)));
    }

    handleEndOfStream = async (stream, currentConversationId) => {
        await stream.completed;
        LOGGER.log('###### stream completed ######',stream);

        // Reset the current message
        this._streamingMessage[currentConversationId] = null;
        // Reset the streaming state
        this.isStreamingMap[currentConversationId] = false;
        // Set the current agent
        this.currentAgent[currentConversationId] = stream.lastAgent;
        // Store the stream history on the conversation
        const idx = this.conversations.findIndex(c => c.id === this.activeConversationId);
        if (idx !== -1) {
            this.conversations[idx] = { ...this.conversations[idx], streamHistory: stream.history };
            this.conversations = [...this.conversations];
            this.saveConversationsToCache();
        }
        // Store the history
        this.processEndOfStream(stream, currentConversationId);
        this._shouldFocusPublisher = true;
    }

    /** Events **/

    handleStopClick = async e => {
        this.stopAgent(this.activeConversationId);
    };

    handleClearClick = async e => {
        this._messages[this.activeConversationId] = [];
        this.saveConversationsToCache();
    };

    handleSendClick = async (e) => {
        const value = e.detail.prompt;
        const files = e.detail.files || [];
        const model = e.detail.model || this.selectedModel;
        this.selectedModel = model;
        if(isEmpty(this.openaiKey)){
            this.error_title = 'Error';
            this.error_message = 'No OpenAI key found';
            return;
        }
        if (!isEmpty(value) || files.length > 0) {
            this.resetError();
            this.executeAgent(value.trim(), files, model, this.activeConversationId);
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

    handleRetry = (event) => {
        const { item } = event.detail;
        if (item) {
            // Remove the failed message from the list
            this._messages[this.activeConversationId] = this._messages[this.activeConversationId].filter(m => !Message.areMessagesEqual(m, item));
            // Re-send the message (as a direct message)
            this.executeAgentWithDirectMessages([item], this.activeConversationId);
        }
    };

    toggleSidePanel = () => {
        this.isSidePanelOpen = !this.isSidePanelOpen;
    };

    createNewConversation = () => {
        const newId = 'conv_' + Date.now();
        const newTitle = `Conversation ${this.conversations.length + 1}`;
        const newConv = { id: newId, title: newTitle, streamHistory: [] };
        this.conversations = [...this.conversations, newConv];
        this.activeConversationId = newId;
        this._messages[newId] = [];
        this.isSidePanelOpen = false;
        this.saveConversationsToCache();
    };



    handleConversationSelect = (event) => {
        const id = event.detail.item.id;
        if (id && id !== this.activeConversationId) {
            this.activeConversationId = id;
            const conv = this.currentConversation;
            if (conv) {
                if (conv.messages && conv.messages.length > 0) {
                    this._messages[this.activeConversationId] = conv.messages;
                } else if (conv.streamHistory && Array.isArray(conv.streamHistory) && conv.streamHistory.length > 0) {
                    this._messages[this.activeConversationId] = Message.formatStreamHistory(conv.streamHistory);
                } else {
                    this._messages[this.activeConversationId] = [];
                }
            }
        }
        this.isSidePanelOpen = false;
    };

    handleDeleteConversation = (event) => {
        const id = event.detail.item?.id;
        if (id) {
            this.deleteConversation(id);
        }
    }

    getConversationItemClass(id) {
        let base = 'side-panel-list-item slds-p-vertical_x-small';
        if (id === this.activeConversationId) {
            base += ' slds-theme_shade';
        }
        return base;
    }

    startEditingTitle = () => {
        const conv = this.conversations.find(c => c.id === this.activeConversationId);
        this.pendingTitle = conv ? conv.title : '';
        this.isEditingTitle = true;
    };

    handleConversationTitleChange = (event) => {
        this.pendingTitle = event.target.value;
    };

    handleConversationTitleKeydown = (event) => {
        if (event.key === 'Enter') {
            this.saveConversationTitle();
        } else if (event.key === 'Escape') {
            this.cancelEditingTitle();
        }
    };

    saveConversationTitle = () => {
        const idx = this.conversations.findIndex(c => c.id === this.activeConversationId);
        if (idx !== -1 && this.pendingTitle.trim()) {
            this.conversations[idx] = { ...this.conversations[idx], title: this.pendingTitle.trim() };
            this.conversations = [...this.conversations];
            this.saveConversationsToCache();
        }
        this.isEditingTitle = false;
    };

    cancelEditingTitle = () => {
        this.isEditingTitle = false;
    };

    deleteConversation = (id) => {
        let idx = this.conversations.findIndex(c => c.id === id);
        if (idx !== -1) {
            this.conversations.splice(idx, 1);
            if (this.conversations.length === 0) {
                // If all deleted, create a new one
                this.createNewConversation();
            } else {
                // Switch to the first conversation
                this.activeConversationId = this.conversations[0].id;
                this._messages[this.activeConversationId] = this.conversations[0].messages || [];
            }
            this.conversations = [...this.conversations];
            this.saveConversationsToCache();
        }
    }

    // Helper: append message only if not already present (by key)
    _appendMessageIfNotExists = (newMsg, currentConversationId) => {
        this._messages[currentConversationId] = Message.appendMessageIfNotExists(this._messages[currentConversationId], newMsg);
    }

    /** Getters **/

    get legacyConnector() {
        return super.connector;
    }

    get hasError() {
        return isNotUndefinedOrNull(this.error_message);
    }

    get isUserLoggedIn() {
        return isNotUndefinedOrNull(store.getState()?.application?.connector);
    }

    get displayedMessages() {
        return (this._messages[this.activeConversationId] || []).filter(x => x.type !== 'reasoning'); // We don't want to display the reasoning. TODO: Improve this
    }

    get streamingMessage() {
        return this._streamingMessage[this.activeConversationId] || null;
    }

    get conversationTree() {
        return this.conversations.map(conv => {
            const { keywords, searchText } = this._getConversationSearchData(conv);
            return {
                id: conv.id,
                name: conv.title || 'Conversation',
                title: conv.title || 'Conversation',
                icon: 'utility:chat',
                isDeletable: false,
                keywords,
                searchText,
            };
        });
    }

    get conversationTitle() {
        const conv = this.currentConversation;
        return conv ? conv.title : 'New Conversation';
    }

    get currentConversation() {
        return this.conversations.find(c => c.id === this.activeConversationId);
    }

    get inputSectionClass() {
        return classSet('slds-grid slds-grid_vertical-align-center title-input-section')
        .add({
            'input-section': this.isEditingTitle
        })
        .toString();
    }

    get isLoading() {
        return this.isLoadingMap[this.activeConversationId] || false;
    }

    get isStreaming() {
        return this.isStreamingMap[this.activeConversationId] || false;
    }



    _getConversationSearchData(conv) {
        // Keep lightweight for now; can be enhanced later with message snippets/tags
        const keywords = [conv.id].filter(Boolean);
        const searchText = String(conv.title || '');
        return { keywords, searchText };
    }

    /** Buffer Chunk **/
    


    _bufferChunk(delta, currentConversationId) {
        if (!this._chunkBuffer[currentConversationId]) {
            this._chunkBuffer[currentConversationId] = [];
        }
        this._chunkBuffer[currentConversationId].push(delta);
        // Flush immediately if buffer reaches 5 chunks
        if (this._chunkBuffer[currentConversationId].length >= 5) {
            this._flushChunkBuffer(currentConversationId);
            return;
        }
        // Start or reset the timer for this conversation
        if (!this._chunkFlushTimer[currentConversationId]) {
            this._chunkFlushTimer[currentConversationId] = setTimeout(() => {
                this._flushChunkBuffer(currentConversationId);
            }, this._CHUNK_FLUSH_INTERVAL);
        }
    }

    _flushChunkBuffer(currentConversationId) {
        const buffer = this._chunkBuffer[currentConversationId] || [];
        if (buffer.length > 0) {
            if (!this._streamingMessage[currentConversationId]) {
                this._streamingMessage[currentConversationId] = {
                    id: guid(),
                    content: ''
                };
            }
            const combined = buffer.join('');
            this._streamingMessage[currentConversationId] = {
                ...this._streamingMessage[currentConversationId],
                content: (this._streamingMessage[currentConversationId]?.content || '') + combined
            };
            this._chunkBuffer[currentConversationId] = [];
        }
        if (this._chunkFlushTimer[currentConversationId]) {
            clearTimeout(this._chunkFlushTimer[currentConversationId]);
            this._chunkFlushTimer[currentConversationId] = null;
        }
    }
}