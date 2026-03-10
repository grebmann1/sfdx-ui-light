import { LightningElement, api } from 'lwc';
import { Constants } from 'agent/utils';

export default class AgentMessageList extends LightningElement {
    @api welcomeMessage;
    @api displayedMessages = [];

    get showStandaloneWelcome() {
        return false;
    }

    get listMessages() {
        return Array.isArray(this.displayedMessages) ? this.displayedMessages : [];
    }

    _streamingMessage = null;
    _reasoningState = null;
    @api isLoading = false;

    @api
    get reasoningState() {
        return this._reasoningState;
    }
    set reasoningState(val) {
        this._reasoningState = val;
    }

    get hasReasoningState() {
        const r = this._reasoningState;
        if (!r || (r.phase !== 'thinking' && r.phase !== 'done')) return false;
        const list = this.listMessages;
        const last = list.length > 0 ? list[list.length - 1] : null;
        if (last?.type === Constants.MESSAGE_TYPE.REASONING) return false;
        return true;
    }

    _userIsAtBottom = true;
    _scrollThreshold = 40;

    @api
    get streamingMessage() {
        return this._streamingMessage;
    }
    set streamingMessage(val) {
        this._streamingMessage = val;
        requestAnimationFrame(() => this.setLastComponentInView());
    }

    renderedCallback() {
        this._attachScrollListener();
        this.setLastComponentInView();
    }

    connectedCallback() {
        this.addEventListener('retry', this.handleRetryEvent);
    }

    disconnectedCallback() {
        this.removeEventListener('retry', this.handleRetryEvent);
    }

    /** Events **/

    handleRetryEvent = event => {
        event.stopPropagation();
        this.dispatchEvent(new CustomEvent('retry', { detail: event.detail }));
    };
    /** Methods **/

    setLastComponentInView() {
        const chatList = this.template.querySelector('.slds-chat-list');
        if (!chatList) return;
        // Only auto-scroll if user is at bottom (or near)
        if (!this._userIsAtBottom) return;
        requestAnimationFrame(() => {
            // Priority: streaming message, reasoning, loading, last message
            let last = null;
            last = chatList.querySelector('.chat-item.is-current-message');
            if (!last) {
                last = chatList.querySelector('.chat-item.is-reasoning');
            }
            if (!last) {
                const items = chatList.querySelectorAll('li, .chat-item');
                last = items[items.length - 1];
            }
            if (last) {
                last.scrollIntoView({ behavior: 'auto', block: 'start' });
            }
        });
    }

    _attachScrollListener() {
        // Attach scroll event only once
        if (this._scrollListenerAttached) return;
        const chatList = this.template.querySelector('.slds-chat-list');
        if (chatList) {
            chatList.addEventListener('scroll', this._onUserScroll, { passive: true });
            this._scrollListenerAttached = true;
        }
    }

    _onUserScroll = event => {
        const chatList = event.target;
        const { scrollTop, scrollHeight, clientHeight } = chatList;
        // If user is within threshold of the bottom, consider at bottom
        this._userIsAtBottom = scrollHeight - scrollTop - clientHeight <= this._scrollThreshold;
    };

}
