import { LightningElement, api } from 'lwc';

export default class AgentMessageList extends LightningElement {
    @api welcomeMessage: string | undefined;
    @api displayedMessages: any[] = [];
    @api loadingStatus = '';

    get showStandaloneWelcome() {
        return false;
    }

    get listMessages() {
        const list = Array.isArray(this.displayedMessages) ? this.displayedMessages : [];
        const merged = [];
        list.forEach(message => {
            if (!message || typeof message !== 'object') return;
            if (message.role === 'system') return;
            if (message.role === 'tool') {
                const toolPart = this._toToolResultPart(message);
                if (!toolPart) return;
                const matchIndex = this._findAssistantWithToolCall(
                    merged,
                    toolPart?.toolCallId
                );
                if (matchIndex !== -1) {
                    const target = merged[matchIndex];
                    const { field, parts } = this._extractParts(target);
                    merged[matchIndex] = { ...target, [field]: [...parts, toolPart] };
                    return;
                }
            }
            merged.push(message);
        });

        return merged.map((message, index) => ({
            key: message?.id || `msg-${index}`,
            message,
        }));
    }

    get visibleStreamingMessage() {
        if (!this.streamingMessage || this.streamingMessage.role === 'system') {
            return null;
        }
        return this.streamingMessage;
    }

    get hasLoadingStatus() {
        return typeof this.loadingStatus === 'string' && this.loadingStatus.trim().length > 0;
    }

    _streamingMessage: any = null;
    @api isLoading = false;

    _userIsAtBottom = true;
    _scrollThreshold = 80;
    _scrollPending = false;
    _scrollContainer: Element | null = null;
    _scrollListenerAttached = false;

    @api
    scrollToBottom() {
        const container = this._getScrollContainer();
        if (!container) return;
        this._userIsAtBottom = true;
        container.scrollTop = container.scrollHeight - container.clientHeight;
    }

    get showScrollToBottomButton() {
        return !this._userIsAtBottom;
    }

    @api
    get streamingMessage() {
        return this._streamingMessage;
    }
    set streamingMessage(val) {
        this._streamingMessage = val;
        this._scheduleScrollToBottom();
    }

    renderedCallback() {
        this._attachScrollListener();
        this._updateIsAtBottomFromContainer();
        if (!this.streamingMessage) {
            requestAnimationFrame(() => this._scrollToBottomIfAtBottom());
        }
    }

    connectedCallback() {
        this.addEventListener('retry', this.handleRetryEvent);
    }

    disconnectedCallback() {
        this.removeEventListener('retry', this.handleRetryEvent);
        if (this._scrollContainer) {
            this._scrollContainer.removeEventListener('scroll', this._onUserScroll);
            this._scrollContainer = null;
        }
        this._scrollListenerAttached = false;
    }

    /** Events **/

    handleRetryEvent = event => {
        event.stopPropagation();
        this.dispatchEvent(new CustomEvent('retry', { detail: event.detail }));
    };
    /** Methods **/

    _extractParts(message) {
        if (Array.isArray(message?.parts)) {
            return { field: 'parts', parts: message.parts.map(part => ({ ...(part || {}) })) };
        }
        if (Array.isArray(message?.content)) {
            return { field: 'content', parts: message.content.map(part => ({ ...(part || {}) })) };
        }
        if (typeof message?.content === 'string' && message.content.trim()) {
            return { field: 'content', parts: [{ type: 'text', text: message.content }] };
        }
        return { field: 'content', parts: [] };
    }

    _findAssistantWithToolCall(messages, toolCallId) {
        if (!toolCallId) return -1;
        for (let i = messages.length - 1; i >= 0; i -= 1) {
            const msg = messages[i];
            if (!msg || msg.role !== 'assistant') continue;
            const { parts } = this._extractParts(msg);
            const toolCallIds = parts
                .filter(part => part?.type === 'tool-call')
                .map(part => part.toolCallId || part.callId || part.call_id || part.id || null)
                .filter(Boolean);
            const hasMatch = parts.some(part => {
                if (!part || typeof part !== 'object') return false;
                if (part.type !== 'tool-call') return false;
                const id =
                    part.toolCallId ||
                    part.callId ||
                    part.call_id ||
                    part.id ||
                    null;
                return id === toolCallId;
            });
            if (hasMatch) return i;
        }
        return -1;
    }

    _toToolResultPart(message) {
        if (Array.isArray(message?.content)) {
            const toolPart = message.content.find(part => part?.type === 'tool-result') || null;
            if (!toolPart) return null;
            return {
                ...toolPart,
                type: 'tool-result',
                toolCallId:
                    toolPart.toolCallId ||
                    toolPart.callId ||
                    toolPart.call_id ||
                    toolPart.id ||
                    null,
                toolName: toolPart.toolName || toolPart.name || null,
                result: toolPart.result ?? toolPart.output ?? toolPart.content,
            };
        }
        const toolCallId =
            message?.toolCallId ||
            message?.tool_call_id ||
            message?.callId ||
            message?.id ||
            null;
        const toolName = message?.name || message?.toolName || null;
        const content = message?.content;
        const output = typeof content === 'string' ? content : content ?? null;
        return {
            type: 'tool-result',
            toolCallId,
            toolName,
            output,
            result: message?.result ?? message?.output ?? output,
        };
    }

    _getScrollContainer() {
        const section = this.template.host?.closest?.('section[data-id="chatSection"]');
        if (section) return section;
        return this.template.querySelector('.slds-chat-list') || null;
    }

    _updateIsAtBottomFromContainer() {
        const container = this._getScrollContainer();
        if (!container) return;
        const { scrollTop, scrollHeight, clientHeight } = container;
        const atBottom =
            scrollHeight - scrollTop - clientHeight <= this._scrollThreshold;
        if (this._userIsAtBottom !== atBottom) {
            this._userIsAtBottom = atBottom;
        }
    }

    _scheduleScrollToBottom() {
        if (this._scrollPending) return;
        this._scrollPending = true;
        requestAnimationFrame(() => {
            this._scrollPending = false;
            this._scrollToBottomIfAtBottom();
        });
    }

    _scrollToBottomIfAtBottom() {
        const container = this._getScrollContainer();
        if (!container) return;
        if (!this._userIsAtBottom) return;
        const { scrollTop, scrollHeight, clientHeight } = container;
        const atBottom =
            scrollHeight - scrollTop - clientHeight <= this._scrollThreshold;
        if (!atBottom) return;
        container.scrollTop = scrollHeight - clientHeight;
    }

    _attachScrollListener() {
        if (this._scrollListenerAttached) return;
        const container = this._getScrollContainer();
        if (container) {
            this._scrollContainer = container;
            container.addEventListener('scroll', this._onUserScroll, { passive: true });
            this._scrollListenerAttached = true;
        }
    }

    _onUserScroll = event => {
        const container = event.target;
        const { scrollTop, scrollHeight, clientHeight } = container;
        this._userIsAtBottom =
            scrollHeight - scrollTop - clientHeight <= this._scrollThreshold;
    };

    handleScrollToBottom = () => {
        this.scrollToBottom();
    };
}
