import { api, track, wire } from 'lwc';
import Toast from 'lightning/toast';
import {
    isEmpty,
    isNotUndefinedOrNull,
    classSet
} from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
import { store, connectStore, AGENT } from 'core/store';
import LOGGER from 'shared/logger';
import { NavigationContext } from 'lwr/navigation';
import { Message } from 'agent/utils';
import Analytics from 'shared/analytics';

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
        { id: 'default', title: 'Conversation 1', streamHistory: [] }
    ];
    @track activeConversationId = 'default';
    @track isEditingTitle = false;
    @track pendingTitle = '';
    @track streamingMessage = null;
    @track isLoading = false;
    @track isStreaming = false;
    @track displayedMessages = [];

    _lastScrolledMessageCount = 0;
    _lastActiveConversationId = null;

    @api connector;
    @api isAudioRecorderDisabled = false;

    // FileTree search config for conversations
    conversationSearchFields = ['name', 'id', 'title', 'keywords', 'searchText'];
    minSearchLengthForConversations = 1;
    hideSearchInputForConversations = false;
    includeFoldersInResultsForConversations = true;


    // Error
    @track error_title;
    @track error_message;
    @track isErrorDetailsOpen = false;
    errorIds;

    openaiKey;

    // Better to use a constant than a getter ! (renderCallback is called too many times)
    welcomeMessage = {
        role: 'assistant',
        content: 'Hello, I am the SF Toolkit Assistant, I can help you interact with Salesforce and Salesforce tools.',
        id: 'WELCOME_MESSAGE_ID',
    };
    _shouldFocusPublisher = false;

    // UI
    @wire(connectStore, { store })
    storeChange({ application, agent }) {
        this._setIfChanged('openaiKey', application.openaiKey);
        if (agent) {
            this._setIfChanged('selectedModel', agent.selectedModel);
            const convs = agent.conversations || [];
            if (this.conversations !== convs) {
                this.conversations = convs;
            }
            if (agent.activeConversationId) {
                this._setIfChanged('activeConversationId', agent.activeConversationId);
            }
            // Loading/Streaming flags for current conversation
            const isLoading = !!(agent.loadingById && agent.loadingById[this.activeConversationId]);
            const isStreaming = !!(agent.streamingById && agent.streamingById[this.activeConversationId]);
            
            const streamMsg = (agent.streamingMessageById && agent.streamingMessageById[this.activeConversationId]) || null;
            this._setIfChanged('isLoading', isLoading);
            this._setIfChanged('isStreaming', isStreaming);
            this._setIfChanged('streamingMessage', streamMsg);

            const rawMessages = (agent.messagesById && agent.messagesById[this.activeConversationId]) || [];
            const displayed = rawMessages.filter(m => m.type !== 'reasoning');
            this._setIfChanged('displayedMessages', displayed);

            const err = agent?.errorById?.[this.activeConversationId];
            this._setIfChanged('error_title', err?.title ?? null);
            this._setIfChanged('error_message', err?.message ?? null);
        }
    }

    connectedCallback() {
        Analytics.trackAppOpen('agent', { alias: this.alias });
        store.dispatch(AGENT.loadCacheSettingsAsync());
    }

    renderedCallback() {
        if (this.isEditingTitle && this.refs && this.refs.titleInput) {
            this.refs.titleInput.focus();
        }
        const messageCount = Array.isArray(this.displayedMessages) ? this.displayedMessages.length : 0;
        if (this._lastActiveConversationId !== this.activeConversationId || messageCount > this._lastScrolledMessageCount) {
            this._scrollChatToBottom();
        }
        this._lastActiveConversationId = this.activeConversationId;
        this._lastScrolledMessageCount = messageCount;
    }

    /** Methods **/

    resetError = () => {
        this.error_title = null;
        this.error_message = null;
        this.isErrorDetailsOpen = false;
        if (this.activeConversationId) {
            store.dispatch(AGENT.reduxSlice.actions.resetError({ id: this.activeConversationId }));
        }
    };

    toggleErrorDetails = () => {
        this.isErrorDetailsOpen = !this.isErrorDetailsOpen;
    };

    copyErrorToClipboard = async () => {
        const text = [this.error_title, this.error_message].filter(Boolean).join(': ');
        if (text && navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                Toast.show({ message: 'Error copied to clipboard', variant: 'success' });
            } catch (_) {
                Toast.show({ message: 'Copy failed', variant: 'error' });
            }
        }
    };

    _scrollChatToBottom = () => {
        const container = this.template && this.template.querySelector('section[data-id="chatSection"]');
        if (!container) {
            return;
        }
        requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
        });
    };

    executeAgent = async (prompt, files = [], model = this.selectedModel) => {
        await store.dispatch(AGENT.executeAgent({ prompt, directMessages: [], files, model, conversationId: this.activeConversationId }));
    }

    executeAgentWithDirectMessages = async (directMessages) => {
        await store.dispatch(AGENT.executeAgent({ prompt: null, directMessages, files: [], conversationId: this.activeConversationId }));
    }
    

    _executeAgent = async () => {}

    /** Agents Helpers **/
    _setIfChanged = (prop, value) => {
        if (this[prop] !== value) {
            this[prop] = value;
        }
    }

    /** Events **/

    handleStopClick = async e => {
        await store.dispatch(AGENT.stopAgent({ id: this.activeConversationId }));
    };

    handleClearClick = async e => {
        store.dispatch(AGENT.reduxSlice.actions.clearMessages({ id: this.activeConversationId }));
        //this.saveConversationsToCache();
    };

    handleSendClick = async (e) => {
        const value = e.detail.prompt;
        const files = e.detail.files || [];
        const model = e.detail.model || this.selectedModel;
        store.dispatch(AGENT.reduxSlice.actions.updateSelectedModel({ model }));
        //await this.saveConversationsToCache();
        if (isEmpty(this.openaiKey)) {
            store.dispatch(
                AGENT.reduxSlice.actions.setError({
                    id: this.activeConversationId,
                    title: 'Error',
                    message: 'No OpenAI key found',
                })
            );
            return;
        }
        if (!isEmpty(value) || files.length > 0) {
            this.resetError();
            this.executeAgent(value.trim(), files, model, this.activeConversationId);
        }
    };

    global_handleError = e => {
        const message = typeof e?.message === 'string' ? e.message : String(e);
        const parts = message.split(':');
        const title = parts.length > 1 ? parts.shift() : 'Error';
        const msg = parts.join(':').trim() || message;
        if (this.activeConversationId) {
            store.dispatch(
                AGENT.reduxSlice.actions.setError({
                    id: this.activeConversationId,
                    title,
                    message: msg,
                })
            );
        }
    };

    handleRetry = (event) => {
        const { item } = event.detail;
        if (item) {
            const list = (store.getState().agent?.messagesById?.[this.activeConversationId] || []).filter(m => !Message.areMessagesEqual(m, item));
            store.dispatch(AGENT.reduxSlice.actions.setMessages({ id: this.activeConversationId, messages: list }));
            this.executeAgentWithDirectMessages([item]);
        }
    };

    toggleSidePanel = () => {
        this.isSidePanelOpen = !this.isSidePanelOpen;
    };

    createNewConversation = async () => {
        const convs = store.getState().agent?.conversations || [];
        const newId = 'conv_' + Date.now();
        const newTitle = `Conversation ${convs.length + 1}`;
        const newConv = { id: newId, title: newTitle, streamHistory: [] };
        await store.dispatch(AGENT.reduxSlice.actions.addConversation({ conversation: newConv }));
        await store.dispatch(AGENT.reduxSlice.actions.setActiveConversationId({ id: newId }));
        this.isSidePanelOpen = false;
        //this.saveConversationsToCache();
    };



    handleConversationSelect = (event) => {
        const id = event.detail.item.id;
        if (id && id !== this.activeConversationId) {
            store.dispatch(AGENT.reduxSlice.actions.setActiveConversationId({ id }));
            //this.saveConversationsToCache();
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
        if (this.pendingTitle.trim()) {
            store.dispatch(AGENT.reduxSlice.actions.updateConversationTitle({ id: this.activeConversationId, title: this.pendingTitle.trim() }));
            //this.saveConversationsToCache();
        }
        this.isEditingTitle = false;
    };

    cancelEditingTitle = () => {
        this.isEditingTitle = false;
    };

    deleteConversation = async (id) => {
        const wasActive = this.activeConversationId === id;
        await store.dispatch(AGENT.reduxSlice.actions.deleteConversation({ id }));
        const convs = store.getState().agent?.conversations || [];
        if (convs.length === 0) {
            this.createNewConversation();
        } else if (wasActive) {
            const newActiveId = convs[0]?.id;
            if (newActiveId) {
                store.dispatch(AGENT.reduxSlice.actions.setActiveConversationId({ id: newActiveId }));
            }
        }
        //this.saveConversationsToCache();
    }

    /** Getters **/

    get legacyConnector() {
        return super.connector;
    }

    get hasError() {
        return isNotUndefinedOrNull(this.error_message);
    }

    get errorDetailsToggleLabel() {
        return this.isErrorDetailsOpen ? 'Hide details' : 'Show details';
    }

    get errorChevronClass() {
        return this.isErrorDetailsOpen ? 'agent-error-chevron-open' : '';
    }

    get isUserLoggedIn() {
        return isNotUndefinedOrNull(store.getState()?.application?.connector);
    }

    

    

    get conversationTree() {
        return this.conversations.map(conv => {
            const { keywords, searchText } = this._getConversationSearchData(conv);
            return {
                id: conv.id,
                name: conv.title || 'Conversation',
                title: conv.title || 'Conversation',
                icon: 'utility:chat',
                isDeletable: true,
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

    



    _getConversationSearchData(conv) {
        // Keep lightweight for now; can be enhanced later with message snippets/tags
        const keywords = [conv.id].filter(Boolean);
        const searchText = String(conv.title || '');
        return { keywords, searchText };
    }

}