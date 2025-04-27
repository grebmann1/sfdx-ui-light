import { api, track } from 'lwc';
import { isEmpty, runActionAfterTimeOut, checkIfPresent } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
const PAGE_LIST_SIZE = 70;
export default class MessageList extends ToolkitElement {
    isLoading = false;
    isPaused = false;
    isSortedDesc = false;

    @api messages = [];
    pausedMessages = [];
    @api title;
    @api selectedEventItem;

    filter;

    // Scrolling
    pageNumber = 1;

    connectedCallback() {}

    /** Events **/

    handleSearch = e => {
        runActionAfterTimeOut(e.detail.value, newValue => {
            this.filter = newValue;
        });
    };

    selectPlatformEvent = () => {};

    handleEmptyMessages = e => {
        this.dispatchEvent(
            new CustomEvent('empty', {
                bubbles: true,
                composed: true,
            })
        );
        this.pausedMessages = [];
    };

    handlePauseButtonClick = e => {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            this.pausedMessages = [...this.messages];
        }
    };

    handleSortButtonClick = () => {
        this.isSortedDesc = !this.isSortedDesc;
    };

    handleScroll(event) {
        //console.log('handleScroll');
        const target = event.target;
        const scrollDiff = Math.abs(target.clientHeight - (target.scrollHeight - target.scrollTop));
        const isScrolledToBottom = scrollDiff < 5; //5px of buffer
        if (isScrolledToBottom) {
            // Fetch more data when user scrolls to the bottom
            this.pageNumber++;
        }
    }

    /** Methods  **/

    /** Getters */

    get iconPauseButton() {
        return this.isPaused ? 'utility:play' : 'utility:pause';
    }

    get iconPauseButtonVariant() {
        return this.isPaused ? 'brand' : 'default';
    }

    get selectedItemId() {
        return this.selectedEventItem?.id;
    }

    get bufferMessages() {
        return this.isPaused ? this.pausedMessages : this.messages;
    }

    get filteredMessages() {
        if (isEmpty(this.filter)) return this.bufferMessages;
        return this.bufferMessages.filter(x => checkIfPresent(`${x.id}`, this.filter));
    }

    get sortedFilteredMessages() {
        return [...this.filteredMessages].sort((a, b) =>
            this.isSortedDesc ? b.id - a.id : a.id - b.id
        );
    }

    get virtualList() {
        // Best UX Improvement !!!!
        return this.sortedFilteredMessages.slice(0, this.pageNumber * PAGE_LIST_SIZE);
    }

    get isEmpty() {
        return this.filteredMessages.length == 0;
    }
}
