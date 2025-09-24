import { LightningElement, api } from 'lwc';
import { Constants } from 'agent/utils';
import LOGGER from 'shared/logger';

export default class AgentMessageList extends LightningElement {
    @api welcomeMessage;
    @api displayedMessages = [];
    _streamingMessage = null;
    @api isLoading = false;
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
        this.setLastComponentInView()
    }

    connectedCallback() {
        this.addEventListener('retry', this.handleRetryEvent);
    }

    disconnectedCallback() {
        this.removeEventListener('retry', this.handleRetryEvent);
    }

    /** Events **/

    handleRetryEvent = (event) => {
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
            // Priority: streaming message, loading, last message
            let last = null;
            // Try streaming message
            last = chatList.querySelector('.chat-item.is-current-message');
            // If not streaming, try loading
            if (!last) {
                last = chatList.querySelector('.slds-chat-loading');
            }
            // If not loading, try last message
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

    _onUserScroll = (event) => {
        const chatList = event.target;
        const { scrollTop, scrollHeight, clientHeight } = chatList;
        // If user is within threshold of the bottom, consider at bottom
        this._userIsAtBottom = (scrollHeight - scrollTop - clientHeight) <= this._scrollThreshold;
    }
}
