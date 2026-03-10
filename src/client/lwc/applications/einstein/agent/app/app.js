import { api, track, wire } from 'lwc';
import Toast from 'lightning/toast';
import { isEmpty, isNotUndefinedOrNull, classSet } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
import { reportError, store, connectStore, AGENT } from 'core/store';
import LOGGER from 'shared/logger';
import { NavigationContext } from 'lwr/navigation';
import { Message, DEFAULT_MODEL, DEFAULT_REASONING } from 'agent/utils';
import Analytics from 'shared/analytics';

export default class App extends ToolkitElement {
    navContext;
    @wire(NavigationContext)
    updateNavigationContext(navContext) {
        this.navContext = navContext;
        window.navContext = navContext;
    }

    @track selectedModel = DEFAULT_MODEL;
    @track selectedReasoning = DEFAULT_REASONING;
    @track isSidePanelOpen = false;
    @track conversations = [{ id: 'default', title: 'Conversation 1', streamHistory: [] }];
    @track activeConversationId = 'default';
    @track isEditingTitle = false;
    @track pendingTitle = '';
    @track streamingMessage = null;
    @track reasoningState = null;
    @track isLoading = false;
    @track isStreaming = false;
    @track displayedMessages = [];
    @track isDebugMode = false;
    @track selectedDebugTabId = 'messages';
    @track debugMessages = [];
    @track debugStreamHistory = [];
    debugLastRunDebug = null;

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
    openaiUrl;

    // Better to use a constant than a getter ! (renderCallback is called too many times)
    welcomeMessage = {
        role: 'assistant',
        content:
            'Hello, I am the SF Toolkit Assistant, I can help you interact with Salesforce and Salesforce tools.',
        id: 'WELCOME_MESSAGE_ID',
    };
    _shouldFocusPublisher = false;

    // UI
    @wire(connectStore, { store })
    storeChange({ application, agent }) {
        this._setIfChanged('openaiKey', application.openaiKey);
        this._setIfChanged('openaiUrl', application.openaiUrl);
        if (agent) {
            this._setIfChanged('selectedModel', agent.selectedModel);
            this._setIfChanged('selectedReasoning', agent.selectedReasoning ?? DEFAULT_REASONING);
            const convs = agent.conversations || [];
            if (this.conversations !== convs) {
                this.conversations = convs;
            }
            if (agent.activeConversationId) {
                this._setIfChanged('activeConversationId', agent.activeConversationId);
            }
            // Loading/Streaming flags for current conversation
            const isLoading = !!(agent.loadingById && agent.loadingById[this.activeConversationId]);
            const isStreaming = !!(
                agent.streamingById && agent.streamingById[this.activeConversationId]
            );

            const streamMsg =
                (agent.streamingMessageById &&
                    agent.streamingMessageById[this.activeConversationId]) ||
                null;
            this._setIfChanged('isLoading', isLoading);
            this._setIfChanged('isStreaming', isStreaming);
            this._setIfChanged('streamingMessage', streamMsg);
            const reasoning =
                (agent.reasoningById && agent.reasoningById[this.activeConversationId]) || null;
            this._setIfChanged('reasoningState', reasoning);

            const rawMessages =
                (agent.messagesById && agent.messagesById[this.activeConversationId]) || [];
            this._setIfChanged('displayedMessages', rawMessages);
            LOGGER.debug('[agent-app] syncFromStore: messages for display', {
                activeConversationId: this.activeConversationId,
                count: rawMessages.length,
                roles: rawMessages.map(m => m.role),
                types: rawMessages.map(m => m.type),
            });

            const err = agent?.errorById?.[this.activeConversationId];
            this._setIfChanged('error_title', err?.title ?? null);
            this._setIfChanged('error_message', err?.message ?? null);

            this._setIfChanged('isDebugMode', !!agent.debugMode);
            this._setIfChanged(
                'debugMessages',
                agent.messagesById?.[this.activeConversationId] ?? []
            );
            const conv = (agent.conversations || []).find(c => c.id === this.activeConversationId);
            this._setIfChanged('debugStreamHistory', conv?.streamHistory ?? []);
            this._setIfChanged(
                'debugLastRunDebug',
                agent.lastRunDebugByConversationId?.[this.activeConversationId] ?? null
            );
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
        const messageCount = Array.isArray(this.displayedMessages)
            ? this.displayedMessages.length
            : 0;
        if (
            this._lastActiveConversationId !== this.activeConversationId ||
            messageCount > this._lastScrolledMessageCount
        ) {
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

    toggleDebugMode = () => {
        store.dispatch(AGENT.reduxSlice.actions.setDebugMode({ enabled: !this.isDebugMode }));
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
        const container =
            this.template && this.template.querySelector('section[data-id="chatSection"]');
        if (!container) {
            return;
        }
        requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
        });
    };

    executeAgent = async (prompt, files = [], model = this.selectedModel) => {
        await store.dispatch(
            AGENT.executeAgent({
                prompt,
                directMessages: [],
                files,
                model,
                conversationId: this.activeConversationId,
            })
        );
    };

    executeAgentWithDirectMessages = async directMessages => {
        await store.dispatch(
            AGENT.executeAgent({
                prompt: null,
                directMessages,
                files: [],
                conversationId: this.activeConversationId,
            })
        );
    };

    _executeAgent = async () => {};

    /** Agents Helpers **/
    _setIfChanged = (prop, value) => {
        if (this[prop] !== value) {
            this[prop] = value;
        }
    };

    /** Events **/

    handleStopClick = async e => {
        await store.dispatch(AGENT.stopAgent({ id: this.activeConversationId }));
    };

    handleClearClick = async e => {
        store.dispatch(AGENT.reduxSlice.actions.clearMessages({ id: this.activeConversationId }));
        //this.saveConversationsToCache();
    };

    handleModelChange = e => {
        const model = e.detail?.model;
        if (model) {
            store.dispatch(AGENT.reduxSlice.actions.updateSelectedModel({ model }));
        }
    };

    handleReasoningChange = e => {
        const reasoning = e.detail?.reasoning;
        if (reasoning !== undefined) {
            store.dispatch(AGENT.reduxSlice.actions.setSelectedReasoning({ reasoning }));
        }
    };

    handleSendClick = async e => {
        const value = e.detail.prompt;
        const files = e.detail.files || [];
        const model = e.detail.model ?? this.selectedModel;
        const reasoning = e.detail.reasoning ?? this.selectedReasoning;
        store.dispatch(AGENT.reduxSlice.actions.updateSelectedModel({ model }));
        store.dispatch(AGENT.reduxSlice.actions.setSelectedReasoning({ reasoning }));
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
        reportError(e, { source: 'agent' });
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

    handleRetry = event => {
        const { item } = event.detail;
        if (item) {
            const list = (
                store.getState().agent?.messagesById?.[this.activeConversationId] || []
            ).filter(m => !Message.areMessagesEqual(m, item));
            store.dispatch(
                AGENT.reduxSlice.actions.setMessages({
                    id: this.activeConversationId,
                    messages: list,
                })
            );
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

    handleConversationSelect = event => {
        const id = event.detail.item.id;
        if (id && id !== this.activeConversationId) {
            store.dispatch(AGENT.reduxSlice.actions.setActiveConversationId({ id }));
            //this.saveConversationsToCache();
        }
        this.isSidePanelOpen = false;
    };

    handleDeleteConversation = event => {
        const id = event.detail.item?.id;
        if (id) {
            this.deleteConversation(id);
        }
    };

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

    handleConversationTitleChange = event => {
        this.pendingTitle = event.target.value;
    };

    handleConversationTitleKeydown = event => {
        if (event.key === 'Enter') {
            this.saveConversationTitle();
        } else if (event.key === 'Escape') {
            this.cancelEditingTitle();
        }
    };

    saveConversationTitle = () => {
        if (this.pendingTitle.trim()) {
            store.dispatch(
                AGENT.reduxSlice.actions.updateConversationTitle({
                    id: this.activeConversationId,
                    title: this.pendingTitle.trim(),
                })
            );
            //this.saveConversationsToCache();
        }
        this.isEditingTitle = false;
    };

    cancelEditingTitle = () => {
        this.isEditingTitle = false;
    };

    deleteConversation = async id => {
        const wasActive = this.activeConversationId === id;
        await store.dispatch(AGENT.reduxSlice.actions.deleteConversation({ id }));
        const convs = store.getState().agent?.conversations || [];
        if (convs.length === 0) {
            this.createNewConversation();
        } else if (wasActive) {
            const newActiveId = convs[0]?.id;
            if (newActiveId) {
                store.dispatch(
                    AGENT.reduxSlice.actions.setActiveConversationId({ id: newActiveId })
                );
            }
        }
        //this.saveConversationsToCache();
    };

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
                'input-section': this.isEditingTitle,
            })
            .toString();
    }

    get debugTabs() {
        return [
            { id: 'messages', label: 'Messages' },
            { id: 'streamHistory', label: 'Stream' },
            { id: 'runContext', label: 'Context', visible: !!this.debugRunContextDisplay },
            { id: 'error', label: 'Error', visible: this.hasLastRunError },
            { id: 'messagesSent', label: 'Sent' },
            { id: 'streamSnapshot', label: 'Snapshot' },
            { id: 'rawEvents', label: 'Events' },
        ];
    }

    get visibleDebugTabs() {
        const activeId = this.activeDebugTabId;
        return this.debugTabs
            .filter(t => t.visible !== false)
            .map(t => ({
                ...t,
                isActive: activeId === t.id,
                tabClass:
                    activeId === t.id
                        ? 'agent-debug-tab agent-debug-tab-active'
                        : 'agent-debug-tab',
            }));
    }

    get activeDebugTabLabel() {
        const tab = this.visibleDebugTabs.find(t => t.id === this.activeDebugTabId);
        return tab ? tab.label : 'Messages';
    }

    get activeDebugTabId() {
        const tabs = this.debugTabs.filter(t => t.visible !== false);
        const ids = tabs.map(t => t.id);
        return ids.includes(this.selectedDebugTabId)
            ? this.selectedDebugTabId
            : ids[0] || 'messages';
    }

    get activeDebugTabButtonId() {
        return `agent-debug-tab-${this.activeDebugTabId}`;
    }

    selectDebugTab(event) {
        const tabId = event?.currentTarget?.dataset?.tabId;
        if (tabId) this.selectedDebugTabId = tabId;
    }

    get isDebugTabMessages() {
        return this.activeDebugTabId === 'messages';
    }
    get isDebugTabStreamHistory() {
        return this.activeDebugTabId === 'streamHistory';
    }
    get isDebugTabRunContext() {
        return this.activeDebugTabId === 'runContext';
    }
    get isDebugTabError() {
        return this.activeDebugTabId === 'error';
    }
    get isDebugTabMessagesSent() {
        return this.activeDebugTabId === 'messagesSent';
    }
    get isDebugTabStreamSnapshot() {
        return this.activeDebugTabId === 'streamSnapshot';
    }
    get isDebugTabRawEvents() {
        return this.activeDebugTabId === 'rawEvents';
    }

    _debugJson(x) {
        if (x === undefined || x === null) {
            return '—';
        }
        try {
            return JSON.stringify(x, (_, v) => (typeof v === 'function' ? undefined : v), 2);
        } catch (_) {
            return String(x);
        }
    }

    get debugMessagesJson() {
        return this._debugJson(this.debugMessages);
    }

    get debugStreamHistoryJson() {
        return this._debugJson(this.debugStreamHistory);
    }

    get debugLastRunMessagesSentJson() {
        return this._debugJson(this.debugLastRunDebug?.messagesSent);
    }

    get debugLastRunStreamSnapshotJson() {
        return this._debugJson(this.debugLastRunDebug?.streamSnapshot);
    }

    get debugLastRunRawEventsJson() {
        return this._debugJson(this.debugLastRunDebug?.rawEvents);
    }

    get debugLastRunRunContextJson() {
        return this._debugJson(this.debugLastRunDebug?.runContext);
    }

    get debugLastRunErrorJson() {
        return this._debugJson(this.debugLastRunDebug?.error);
    }

    get hasLastRunError() {
        return !!this.debugLastRunDebug?.error;
    }

    get debugMessageBlocks() {
        const list = Array.isArray(this.debugMessages) ? this.debugMessages : [];
        return list.map((m, i) => {
            const role = (m.role || 'unknown').toLowerCase();
            return {
                key: `msg-${i}-${m.id || ''}`,
                index: i + 1,
                role: m.role || 'unknown',
                roleClass: `agent-debug-block-role-${role}`,
                id: m.id || '—',
                content: this._debugJson(m),
            };
        });
    }

    get debugStreamHistoryBlocks() {
        const list = Array.isArray(this.debugStreamHistory) ? this.debugStreamHistory : [];
        return list.map((item, i) => ({
            key: `sh-${i}`,
            index: i + 1,
            content: this._debugJson(item),
        }));
    }

    get debugRunContextDisplay() {
        const rc = this.debugLastRunDebug?.runContext;
        if (!rc) return null;
        return { model: rc.model ?? '—', timestamp: rc.timestamp ?? '—' };
    }

    get debugErrorDisplay() {
        const err = this.debugLastRunDebug?.error;
        if (!err) return null;
        return { message: err.message ?? '—', name: err.name ?? '—' };
    }

    get debugMessagesSentBlocks() {
        const list = this.debugLastRunDebug?.messagesSent;
        const arr = Array.isArray(list) ? list : [];
        return arr.map((m, i) => {
            const role = (m?.role ?? 'unknown').toLowerCase();
            return {
                key: `sent-${i}`,
                index: i + 1,
                role: m?.role ?? 'unknown',
                roleClass: `agent-debug-block-role-${role}`,
                content: this._debugJson(m),
            };
        });
    }

    get debugStreamSnapshotHistoryBlocks() {
        const history = this.debugLastRunDebug?.streamSnapshot?.history;
        const arr = Array.isArray(history) ? history : [];
        return arr.map((item, i) => ({
            key: `snap-h-${i}`,
            index: i + 1,
            content: this._debugJson(item),
        }));
    }

    get debugStreamSnapshotNewItemsBlocks() {
        const items = this.debugLastRunDebug?.streamSnapshot?.newItems;
        const arr = Array.isArray(items) ? items : [];
        return arr.map((item, i) => ({
            key: `snap-n-${i}`,
            index: i + 1,
            content: this._debugJson(item),
        }));
    }

    get debugLastAgentDisplay() {
        const last = this.debugLastRunDebug?.streamSnapshot?.lastAgent;
        if (!last || typeof last !== 'object') return '—';
        return this._debugJson(last);
    }

    get debugRawEventBlocks() {
        const list = this.debugLastRunDebug?.rawEvents;
        const arr = Array.isArray(list) ? list : [];
        return arr.map((evt, i) => {
            const type = evt?.type ?? 'unknown';
            const typeClass = type.replace(/[^a-z0-9]/gi, '-').toLowerCase();
            return {
                key: `evt-${i}`,
                index: i + 1,
                type,
                typeClass: `agent-debug-event-${typeClass}`,
                content: this._debugJson(evt),
            };
        });
    }

    copyDebugSection(event) {
        event.stopPropagation();
        const key = event?.currentTarget?.dataset?.section || event?.target?.dataset?.section;
        if (!key) return;
        let content = '';
        switch (key) {
            case 'messages':
                content = this.debugMessagesJson;
                break;
            case 'streamHistory':
                content = this.debugStreamHistoryJson;
                break;
            case 'runContext':
                content = this.debugLastRunRunContextJson;
                break;
            case 'error':
                content = this.debugLastRunErrorJson;
                break;
            case 'messagesSent':
                content = this.debugLastRunMessagesSentJson;
                break;
            case 'streamSnapshot':
                content = this.debugLastRunStreamSnapshotJson;
                break;
            case 'rawEvents':
                content = this.debugLastRunRawEventsJson;
                break;
            default:
                return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(content).then(
                () => Toast.show({ message: 'Copied to clipboard', variant: 'success' }),
                () => Toast.show({ message: 'Copy failed', variant: 'error' })
            );
        }
    }

    _getConversationSearchData(conv) {
        // Keep lightweight for now; can be enhanced later with message snippets/tags
        const keywords = [conv.id].filter(Boolean);
        const searchText = String(conv.title || '');
        return { keywords, searchText };
    }
}
