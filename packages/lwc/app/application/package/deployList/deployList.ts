import { api, track } from 'lwc';
import { isEmpty, runActionAfterTimeOut, checkIfPresent } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
const PAGE_LIST_SIZE = 70;
export default class DeployList extends ToolkitElement {
    isLoading = false;
    isSortedDesc = false;

    @api requests: Array<Record<string, any>> = [];
    @api title: string | null = null;
    @api selectedItem: Record<string, any> | null = null;

    filter: string | null = null;

    // Scrolling
    pageNumber = 1;

    // interval
    refreshInterval = 15;
    timeLeft: number | null = null;
    intervalId: ReturnType<typeof setInterval> | null = null;
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

    handleSearch = (e: any): void => {
        runActionAfterTimeOut(
            e.detail.value,
            (newValue: string) => {
                this.filter = newValue;
            },
            { timeout: 300, key: 'package.deployList.search' }
        );
    };

    handleRefreshClick = (): void => {
        this.timeLeft = this.refreshInterval;
        this.refreshData();
    };

    handleStopAutoRefreshClick = (): void => {
        this.isAutoRefreshDisabled = true;
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    };

    handleStartAutoRefreshClick = (): void => {
        this.isAutoRefreshDisabled = false;
        this.startCountdown();
    };

    handleScroll(event: any): void {
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

    startCountdown = (): void => {
        this.timeLeft = this.refreshInterval;
        this.intervalId = setInterval(() => {
            this.timeLeft--;

            if (this.timeLeft <= 0) {
                this.refreshData();
                this.timeLeft = this.refreshInterval; // Reset the countdown
            }
        }, 1000); // Update every second
    };

    refreshData = (): void => {
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
