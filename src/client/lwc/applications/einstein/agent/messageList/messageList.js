import { LightningElement, api } from 'lwc';
import { ROLES } from 'shared/utils';
import LOGGER from 'shared/logger';

export default class AgentMessageList extends LightningElement {
    @api welcomeMessage;
    @api displayedMessages = [];

    get showStandaloneWelcome() {
        return false;
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
        return r && (r.phase === 'thinking' || r.phase === 'done');
    }

    /** When phase is 'done', we show "Thought for" above the last message only if that message is the assistant's (so we don't put it above the user's message while streaming). */
    get displayedMessagesForList() {
        const list = Array.isArray(this.displayedMessages) ? this.displayedMessages : [];
        const last = list.length > 0 ? list[list.length - 1] : null;
        if (
            this._reasoningState?.phase === 'done' &&
            list.length > 0 &&
            last?.role === ROLES.ASSISTANT
        ) {
            return list.slice(0, -1);
        }
        return list;
    }

    get lastDisplayedMessageWhenDone() {
        const list = Array.isArray(this.displayedMessages) ? this.displayedMessages : [];
        const last = list.length > 0 ? list[list.length - 1] : null;
        if (
            this._reasoningState?.phase === 'done' &&
            list.length > 0 &&
            last?.role === ROLES.ASSISTANT
        ) {
            return last;
        }
        return null;
    }
    prevMessageCount = 0;
    prevStreamingKey = null;
    _userIsAtBottom = true; // Track if user is at the bottom
    _scrollThreshold = 40; // px, threshold for being considered "at bottom"

    @api
    get streamingMessage() {
        return this._streamingMessage;
    }
    set streamingMessage(val) {
        this._streamingMessage = val;
        //this.setLastComponentInView();
    }

    renderedCallback() {
        this._attachScrollListener();
        this.setLastComponentInView();
        const list = Array.isArray(this.displayedMessages) ? this.displayedMessages : [];
        if (list.length > 0) {
            LOGGER.debug('[agent-messageList] renderedCallback', {
                displayedCount: list.length,
                items: list,
            });
        }
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
                last = chatList.querySelector('.slds-chat-loading');
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

    get showLoadingIndicator() {
        return (
            this.isLoading &&
            this._reasoningState?.phase !== 'thinking' &&
            this._reasoningState?.phase !== 'done'
        );
    }
}
