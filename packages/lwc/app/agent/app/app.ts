import { api, track, wire } from 'lwc';
import Toast from 'lightning/toast';
import { isEmpty, isNotUndefinedOrNull, classSet } from 'shared/utils';
import {
    buildAvailableAgentModelOptions,
    getProviderForModel,
    getProviderLabel,
    isInternalProviderBaseUrl,
    normalizeLlmProvider,
} from 'shared/llm';
import { CACHE_CONFIG, saveSingleExtensionConfigToCache } from 'shared/cacheManager';
import ToolkitElement from 'core/toolkitElement';
import { reportError, store, connectStore, AGENT, APPLICATION } from 'core/store';
import LOGGER from 'shared/logger';
import { NavigationContext } from 'lwr/navigation';
import {
    Constants,
    Message,
    DEFAULT_MODEL,
    DEFAULT_REASONING,
    getDefaultModelForAgentProvider,
    readFileContent,
} from 'agent/utils';
import Analytics from 'shared/analytics';
import type { ConnectorLike } from 'core/connector';
import { createUserModelMessage } from 'agent/utils';
import { persistPromptImageFiles } from 'agent/utils';
import { getIndexedDbFileSystem } from 'core/fs';
import { Agent } from 'agent/Agent';
import { browserAgentInstructions } from 'agent/agents';
import type { ModelMessage, UIMessage } from 'ai';

export default class App extends ToolkitElement {
    quickPromptSuggestions = [
        {
            key: 'soql-opportunities',
            label: 'Write a SOQL query for QTD opportunities',
            prompt: 'Write a SOQL query to list open Opportunities closing this quarter with Amount, StageName, Owner.Name, and Account.Name.',
        },
        {
            key: 'apex-debug',
            label: 'Help debug an Apex test failure',
            prompt: 'I have a failing Apex test. Explain common root causes, what logs I should inspect first, and propose a step-by-step debug checklist.',
        },
        {
            key: 'deploy-plan',
            label: 'Create a safe metadata deployment plan',
            prompt: 'Create a Salesforce deployment plan for metadata changes from sandbox to production, including validation, test strategy, rollback, and post-deploy checks.',
        },
    ];

    navContext: any;
    refs: Record<string, HTMLElement> | undefined;
    @wire(NavigationContext)
    updateNavigationContext(navContext) {
        this.navContext = navContext;
        window.navContext = navContext;
    }

    @track selectedModel = DEFAULT_MODEL;
    @track selectedReasoning = DEFAULT_REASONING;
    @track availableModels = [];
    @track isSidePanelOpen = false;
    @track conversations = [{ id: 'default', title: 'Conversation 1', streamHistory: [] }];
    @track activeConversationId = 'default';
    @track isEditingTitle = false;
    @track pendingTitle = '';
    @track streamingMessage = null;
    @track isLoading = false;
    @track isStreaming = false;
    @track loadingStatus = '';
    @track displayedMessages = [];
    @track isDebugMode = false;
    @track selectedDebugTabId = 'messages';
    @track debugMessages = [];
    @track debugStreamHistory = [];
    debugLastRunDebug = null;

    _lastScrolledMessageCount = 0;
    _lastActiveConversationId = null;
    _streamingUnsubscribe = null;
    _streamingConversationId = null;

    @api connector: ConnectorLike | null = null;
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

    aiProvider;
    activeProvider;
    activeProviderApiKey;
    activeProviderBaseUrl;
    isInternal;

    // Better to use a constant than a getter ! (renderCallback is called too many times)
    welcomeMessage = Constants.WELCOME_MESSAGE;
    _shouldFocusPublisher = false;

    // UI
    @wire(connectStore, { store })
    storeChange({ application, agent }) {
        this._setIfChanged('aiProvider', application.aiProvider);
        const nextAvailableModels = buildAvailableAgentModelOptions({
            availableModelsByProvider: application?.availableModelsByProvider,
            providerConfigs: application?.providerConfigs,
        }).map(model => ({
            label: model.label,
            value: model.value,
            provider: model.provider,
        }));
        this._setIfChanged('availableModels', nextAvailableModels);
        const activeProvider = getProviderForModel(agent?.selectedModel, nextAvailableModels);
        const activeProviderConfig = application?.providerConfigs?.[activeProvider];
        this._setIfChanged('activeProvider', activeProvider);
        this._setIfChanged('activeProviderApiKey', activeProviderConfig?.apiKey || null);
        this._setIfChanged('activeProviderBaseUrl', activeProviderConfig?.baseUrl || null);
        this._setIfChanged(
            'isInternal',
            activeProvider === 'openai' && isInternalProviderBaseUrl(activeProviderConfig?.baseUrl)
        );
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
            const isSummarizing = !!(
                agent.summarizingById && agent.summarizingById[this.activeConversationId]
            );

            this._setIfChanged('isLoading', isLoading);
            this._setIfChanged('isStreaming', isStreaming);
            this._setIfChanged('loadingStatus', isSummarizing ? 'Summarizing conversation...' : '');
            const rawMessages =
                (agent.messagesById && agent.messagesById[this.activeConversationId]) || [];
            this._setIfChanged('displayedMessages', rawMessages);

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
            this._syncStreamingSubscription();
        }
    }

    connectedCallback() {
        Analytics.trackAppOpen('agent', { alias: this.alias });
        store.dispatch(AGENT.loadCacheSettingsAsync());
        store.dispatch(AGENT.loadConversationsFromCache());
    }

    disconnectedCallback() {
        this._teardownStreamingSubscription();
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
        const messageList = this.template?.querySelector('agent-message-list');
        if (messageList && typeof messageList.scrollToBottom === 'function') {
            requestAnimationFrame(() => {
                messageList.scrollToBottom();
            });
            return;
        }
        const container = this.template?.querySelector('section[data-id="chatSection"]');
        if (!container) return;
        requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
        });
    };

    buildAgentExecutionContext(model = this.selectedModel) {
        const conversationId = this.activeConversationId;
        const state = store.getState();
        const activeProvider = getProviderForModel(model, this.availableModels);
        const activeProviderConfig = state.application?.providerConfigs?.[activeProvider];
        const isInternal =
            activeProvider === 'openai' && isInternalProviderBaseUrl(activeProviderConfig?.baseUrl);
        const currentMessages = Array.isArray(state.agent?.messagesById?.[conversationId])
            ? state.agent.messagesById[conversationId]
            : [];

        return {
            conversationId,
            currentMessages,
            settings: {
                provider: activeProvider,
                apiKey: activeProviderConfig?.apiKey ?? '',
                baseUrl: activeProviderConfig?.baseUrl,
                isInternal,
                selectedModel:
                    model ||
                    state.agent?.selectedModel ||
                    getDefaultModelForAgentProvider(activeProvider, isInternal),
                selectedReasoning: state.agent?.selectedReasoning ?? DEFAULT_REASONING,
                systemPrompt: browserAgentInstructions,
                isStoreEnabled: true,
                store,
            },
        };
    }

    executeAgent = async (prompt, files = [], model = this.selectedModel) => {
        console.log('executeAgent', prompt, files, model);
        const { conversationId, currentMessages, settings } = this.buildAgentExecutionContext(model);
        const fs = getIndexedDbFileSystem();
        let filesData = [];
        if (files && files.length > 0) {
            filesData = await Promise.all(files.map(readFileContent));
            filesData = await persistPromptImageFiles(filesData, fs, conversationId, LOGGER);
        }

        console.log('### currentMessages', {
            original: currentMessages,
            current: currentMessages,
        });

        const userMessages = [createUserModelMessage({ text: prompt, filesData })];

        const agent = await Agent.create({
            messages: currentMessages as ModelMessage[],
            conversationId,
            settings,
        });

        await store.dispatch(
            AGENT.executeAgent({
                userMessages,
                agent,
            })
        );
    };

    executeAgentWithDirectMessages = async (
        directMessages: ModelMessage[],
        model = this.selectedModel
    ) => {
        console.log('executeAgentWithDirectMessages', directMessages);
        const { conversationId, currentMessages, settings } = this.buildAgentExecutionContext(model);
        const agent = await Agent.create({
            messages: currentMessages as ModelMessage[],
            conversationId,
            settings,
        });

        await store.dispatch(
            AGENT.executeAgent({
                messages: directMessages,
                agent,
            })
        );
    };

    /** Agents Helpers **/

    _setIfChanged = (prop, value) => {
        if (this[prop] !== value) {
            this[prop] = value;
        }
    };

    _teardownStreamingSubscription = () => {
        if (typeof this._streamingUnsubscribe === 'function') {
            this._streamingUnsubscribe();
        }
        this._streamingUnsubscribe = null;
        this._streamingConversationId = null;
    };

    _syncStreamingSubscription = () => {
        const conversationId = this.activeConversationId;
        if (!conversationId) {
            this._teardownStreamingSubscription();
            this._setIfChanged('streamingMessage', null);
            return;
        }
        if (this._streamingConversationId === conversationId) {
            return;
        }
        this._teardownStreamingSubscription();
        this._setIfChanged('streamingMessage', null);
        this._streamingConversationId = conversationId;
        this._streamingUnsubscribe = Agent.subscribeStreamingMessage(conversationId, message => {
            if (this.activeConversationId !== conversationId) {
                return;
            }
            this._setIfChanged('streamingMessage', message || null);
        });
    };

    /** Events **/

    handleStopClick = async e => {
        const id = this.activeConversationId;
        Agent.stopAgent(id);
        store.dispatch(AGENT.reduxSlice.actions.stopLoading({ id }));
        store.dispatch(AGENT.reduxSlice.actions.stopStreaming({ id }));
    };

    handleClearClick = async e => {
        store.dispatch(AGENT.reduxSlice.actions.clearMessages({ id: this.activeConversationId }));
        //this.saveConversationsToCache();
    };

    handleModelChange = e => {
        const model = e.detail?.model;
        if (model) {
            const provider = getProviderForModel(model, this.availableModels);
            LOGGER.debug('[agent-app] publisher modelchange', {
                model,
                provider,
                activeConversationId: this.activeConversationId,
            });
            store.dispatch(AGENT.reduxSlice.actions.updateSelectedModel({ model }));
            if (provider !== normalizeLlmProvider(this.aiProvider)) {
                store.dispatch(
                    APPLICATION.reduxSlice.actions.updateAiProvider({ aiProvider: provider })
                );
                void saveSingleExtensionConfigToCache(CACHE_CONFIG.AI_PROVIDER.key, provider);
            }
        }
    };

    handleReasoningChange = e => {
        const reasoning = e.detail?.reasoning;
        if (reasoning !== undefined) {
            LOGGER.debug('[agent-app] publisher reasoningchange', {
                reasoning,
                activeConversationId: this.activeConversationId,
            });
            store.dispatch(AGENT.reduxSlice.actions.setSelectedReasoning({ reasoning }));
        }
    };

    handleSendClick = async e => {
        const value = e.detail.prompt;
        const files = e.detail.files || [];
        const model = e.detail.model ?? this.selectedModel;
        const reasoning = e.detail.reasoning ?? this.selectedReasoning;
        const { settings } = this.buildAgentExecutionContext(model);
        const activeProvider = normalizeLlmProvider(settings.provider);
        const activeProviderLabel = getProviderLabel(activeProvider);
        const isProviderConfigured = !isEmpty(settings.apiKey);
        store.dispatch(AGENT.reduxSlice.actions.updateSelectedModel({ model }));
        store.dispatch(AGENT.reduxSlice.actions.setSelectedReasoning({ reasoning }));
        if (!isProviderConfigured) {
            store.dispatch(
                AGENT.reduxSlice.actions.setError({
                    id: this.activeConversationId,
                    title: 'Error',
                    message: `No ${activeProviderLabel} API key found`,
                })
            );
            return;
        }
        if (!isEmpty(value) || files.length > 0) {
            this.resetError();
            this.executeAgent(value.trim(), files, model);
        }
    };

    handleQuickPromptClick = event => {
        const prompt = event?.currentTarget?.dataset?.prompt;
        if (isEmpty(prompt)) {
            return;
        }

        if (!this.isAiProviderConfigured) {
            store.dispatch(
                AGENT.reduxSlice.actions.setError({
                    id: this.activeConversationId,
                    title: 'Error',
                    message: `No ${this.activeProviderLabel} API key found`,
                })
            );
            return;
        }
        this.resetError();
        this.executeAgent(prompt.trim(), [], this.selectedModel);
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
        Agent.cleanupConversationResources(id);
        try {
            const fs = getIndexedDbFileSystem();
            await fs.rm(`/workspace/tmp/${id}`, { recursive: true });
        } catch (_) {
            // Directory may not exist — best effort cleanup.
        }
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

    get isQuickPromptDisplayed() {
        return (
            !this.isLoading &&
            !this.isStreaming &&
            Array.isArray(this.displayedMessages) &&
            this.displayedMessages.length === 0
        );
    }

    get isAiProviderConfigured() {
        return !isEmpty(this.activeProviderApiKey);
    }

    get activeProviderLabel() {
        return getProviderLabel(this.activeProvider);
    }

    get inputSectionClass() {
        return classSet('slds-grid slds-grid_vertical-align-center title-input-section')
            .add({
                'input-section': this.isEditingTitle,
            })
            .toString();
    }

    get debugTabs() {
        return [{ id: 'messages', label: 'Messages' }];
    }

    get visibleDebugTabs() {
        const activeId = this.activeDebugTabId;
        return this.debugTabs
            .filter(t => t.visible !== false)
            .map(t => ({
                ...t,
                domId: `agent-debug-tab-${t.id}`,
                isActive: activeId === t.id,
                tabClass:
                    activeId === t.id
                        ? 'agent-debug-tab agent-debug-tab-active'
                        : 'agent-debug-tab',
            }));
    }

    get hasMultipleDebugTabs() {
        return this.visibleDebugTabs.length > 1;
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
