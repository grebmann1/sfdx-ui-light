import { api, track } from 'lwc';
import { isEmpty, runActionAfterTimeOut, checkIfPresent } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
const PAGE_LIST_SIZE = 70;
export default class DeployList extends ToolkitElement {
    isLoading = false;
    isSortedDesc = false;

    @api requests = [];
    @api title;
    @api selectedItem;

    filter;

    // Scrolling
    pageNumber = 1;

    // interval
    refreshInterval = 15;
    timeLeft;
    intervalId;
    isAutoRefreshDisabled = false;

    connectedCallback() {
        this.startCountdown();
    }

    disconnectedCallback() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }

    /** Events **/

    handleSearch = e => {
        runActionAfterTimeOut(
            e.detail.value,
            newValue => {
                this.filter = newValue;
            },
            { timeout: 300, key: 'package.deployList.search' }
        );
    };

    handleRefreshClick = () => {
        this.timeLeft = this.refreshInterval;
        this.refreshData();
    };

    handleStopAutoRefreshClick = () => {
        this.isAutoRefreshDisabled = true;
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    };

    handleStartAutoRefreshClick = () => {
        this.isAutoRefreshDisabled = false;
        this.startCountdown();
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

    startCountdown = () => {
        this.timeLeft = this.refreshInterval;
        this.intervalId = setInterval(() => {
            this.timeLeft--;

            if (this.timeLeft <= 0) {
                this.refreshData();
                this.timeLeft = this.refreshInterval; // Reset the countdown
            }
        }, 1000); // Update every second
    };

    refreshData = () => {
        this.dispatchEvent(
            new CustomEvent('refresh', {
                detail: { includeSpinner: false },
                bubbles: true,
                composed: true,
            })
        );
    };

    /** Getters */

    get selectedItemId() {
        return this.selectedItem?.Id;
    }

    get filteredRequests() {
        if (isEmpty(this.filter)) return this.requests;
        return this.requests.filter(x => checkIfPresent(`${x.Id}`, this.filter));
    }

    get virtualList() {
        // Best UX Improvement !!!!
        return this.filteredRequests.slice(0, this.pageNumber * PAGE_LIST_SIZE);
    }

    get isEmpty() {
        return this.filteredRequests.length == 0;
    }

    get isAutoRefreshMessageDisplayed() {
        return !this.isAutoRefreshDisabled;
    }
}
