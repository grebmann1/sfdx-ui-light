import { api, track, wire } from 'lwc';
import { isEmpty, runActionAfterTimeOut, checkIfPresent } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
import { connectStore, store, EVENT } from 'core/store';
import Toast from 'lightning/toast';
const PAGE_LIST_SIZE = 70;

const FILTER_MODES = {
    ID: 'id',
    UUID: 'uuid',
    PAYLOAD_CONTAINS: 'contains',
    JSON_PATH: 'jsonpath',
};
export default class MessageList extends ToolkitElement {
    isLoading = false;
    isPaused = false;
    isSortedDesc = false;
    isFilterPanelOpen = false;
    isSettingsPanelOpen = false;

    @api messages = [];
    pausedMessages = [];
    @api title;
    @api selectedEventItem;

    filterMode = FILTER_MODES.ID;
    filter;

    // Scrolling
    pageNumber = 1;

    maxMessagesPerChannel = 500;

    @wire(connectStore, { store })
    storeChange({ platformEvent, application }) {
        const isCurrentApp = this.verifyIsActive(application?.currentApplication);
        if (!isCurrentApp) return;
        if (platformEvent) {
            this.maxMessagesPerChannel = platformEvent.maxMessagesPerChannel || 500;
        }
    }

    connectedCallback() {}

    /** Events **/

    handleSearch = e => {
        runActionAfterTimeOut(
            e.detail.value,
            newValue => {
                this.filter = newValue;
            },
            { timeout: 300, key: 'platformevent.messageList.search' }
        );
    };

    handleFilterModeChange = (e) => {
        this.filterMode = e.detail.value;
        this.pageNumber = 1;
    };

    toggleFilterPanel = () => {
        this.isFilterPanelOpen = !this.isFilterPanelOpen;
        if (this.isFilterPanelOpen) {
            this.isSettingsPanelOpen = false;
        }
    };

    toggleSettingsPanel = () => {
        this.isSettingsPanelOpen = !this.isSettingsPanelOpen;
        if (this.isSettingsPanelOpen) {
            this.isFilterPanelOpen = false;
        }
    };

    handleMaxMessagesChange = (e) => {
        const value = e.detail.value;
        store.dispatch(
            EVENT.reduxSlice.actions.updateMaxMessagesPerChannel({
                value,
                alias: this.alias,
            })
        );
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

    exportVisibleAsJson = async () => {
        try {
            const payload = this.virtualList.map((m) => m.content || m);
            const text = JSON.stringify(payload, null, 2);
            await navigator.clipboard.writeText(text);
            Toast.show({ label: 'Copied', message: 'Visible messages copied as JSON', variant: 'success' });
        } catch (e) {
            Toast.show({ label: 'Copy failed', message: e?.message || 'Unable to copy', variant: 'warning' });
        }
    };

    downloadVisibleAsJson = () => {
        try {
            const payload = this.virtualList.map((m) => m.content || m);
            const text = JSON.stringify(payload, null, 2);
            const blob = new Blob([text], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `event-messages-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            Toast.show({ label: 'Download failed', message: e?.message || 'Unable to download', variant: 'warning' });
        }
    };

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

        const needle = `${this.filter}`.trim();
        if (!needle) return this.bufferMessages;

        if (this.filterMode === FILTER_MODES.ID) {
            return this.bufferMessages.filter((x) => {
                const replayId = x?.content?.data?.event?.replayId;
                return checkIfPresent(`${x.id}`, needle) || checkIfPresent(`${replayId}`, needle);
            });
        }

        if (this.filterMode === FILTER_MODES.UUID) {
            return this.bufferMessages.filter((x) =>
                checkIfPresent(`${x?.content?.data?.event?.EventUuid || ''}`, needle)
            );
        }

        if (this.filterMode === FILTER_MODES.PAYLOAD_CONTAINS) {
            return this.bufferMessages.filter((x) => {
                const searchText =
                    x?._searchText ||
                    (() => {
                        try {
                            return JSON.stringify(x?.content || x);
                        } catch {
                            return '';
                        }
                    })();
                return checkIfPresent(searchText, needle);
            });
        }

        if (this.filterMode === FILTER_MODES.JSON_PATH) {
            const [rawPath, rawExpected] = needle.split(/[:=]/, 2);
            const path = (rawPath || '').trim();
            const expected = (rawExpected || '').trim();
            if (!path) return this.bufferMessages;
            return this.bufferMessages.filter((x) => {
                const value = this.getValueByPath(x?.content || x, path);
                if (expected) {
                    return checkIfPresent(`${value}`, expected);
                }
                return value !== undefined && value !== null && `${value}` !== '';
            });
        }

        return this.bufferMessages;
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

    get filterModeOptions() {
        return [
            { label: 'Id / ReplayId', value: FILTER_MODES.ID },
            { label: 'EventUuid', value: FILTER_MODES.UUID },
            { label: 'Payload contains', value: FILTER_MODES.PAYLOAD_CONTAINS },
            { label: 'JSON path', value: FILTER_MODES.JSON_PATH },
        ];
    }

    get isFilterSelected() {
        return !isEmpty(`${this.filter || ''}`.trim());
    }

    get filterButtonTitle() {
        return this.isFilterPanelOpen ? 'Hide filters' : 'Show filters';
    }

    get isFilterPanelVisible() {
        return this.isFilterPanelOpen === true;
    }

    get isSettingsPanelVisible() {
        return this.isSettingsPanelOpen === true;
    }

    get filterPlaceholder() {
        if (this.filterMode === FILTER_MODES.JSON_PATH) return 'path:value (e.g. data.event.replayId:123)';
        if (this.filterMode === FILTER_MODES.PAYLOAD_CONTAINS) return 'Search within payload JSON';
        if (this.filterMode === FILTER_MODES.UUID) return 'Search by EventUuid';
        return 'Search by Id or ReplayId';
    }

    get maxMessagesHelpText() {
        return 'Max messages kept per channel (oldest are trimmed).';
    }

    getValueByPath(obj, path) {
        try {
            const parts = `${path}`
                .replace(/\[(\d+)\]/g, '.$1')
                .split('.')
                .filter(Boolean);
            let cur = obj;
            for (const p of parts) {
                if (cur == null) return undefined;
                cur = cur[p];
            }
            return cur;
        } catch {
            return undefined;
        }
    }
}
