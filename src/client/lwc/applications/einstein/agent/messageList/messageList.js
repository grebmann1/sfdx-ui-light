import { LightningElement, api } from 'lwc';

export default class AgentMessageList extends LightningElement {
    @api welcomeMessage;
    @api displayedMessages = [];

    get showStandaloneWelcome() {
        return false;
    }

    get listMessages() {
        // Add _key if it doesn't exist
        return Array.isArray(this.displayedMessages)
            ? this.displayedMessages.map(item =>
                  item._key === undefined
                      ? { ...item, _key: item.id }
                      : item
              )
            : [];
    }

    _streamingMessage = null;
    @api isLoading = false;


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
            let last = null;
            last = chatList.querySelector('.chat-item.is-current-message');
            if (!last) {
                last = chatList.querySelector('.chat-item.is-streaming-reasoning');
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
