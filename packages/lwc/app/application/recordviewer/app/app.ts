import { api, track, wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { CurrentPageReference, NavigationContext, generateUrl, navigate } from 'lwr/navigation';
import {
    isUndefinedOrNull,
    isNotUndefinedOrNull,
    classSet,
    isEmpty,
    runActionAfterTimeOut,
    getRecordId,
    isSalesforceId,
} from 'shared/utils';
import { store, connectStore, RECORDVIEWER, DOCUMENT } from 'core/store';
import moment from 'moment';
import Toast from 'lightning/toast';
import { CATEGORY_STORAGE } from 'builder/storagePanel';

export default class App extends ToolkitElement {
    _hasRendered = false;
    isLoading = false;
    _loadingMessage: string | null = null;
    refreshedDateFormatted: string | null = null;

    // Tabs
    @track tabs: Array<Record<string, any>> = [];
    currentTab: Record<string, any> | null = null;

    // Record
    @track recordId: string | null = null;
    @track record: Record<string, any> | null = null; // value populated by the recordExplorer component
    @track recordType: string | null = null;
    @track refreshedDate: string | number | Date | null = null;
    @track hasError = false;

    // Interval
    _headerInterval: ReturnType<typeof setInterval> | null = null;

    // Search Input
    @track searchInputValue: string | null = null;
    // Filter Input
    @track filterInputValue: string | null = null;

    // Arrow-key history navigation state
    _historyIndex: number = -1;
    _searchDraft: string | null = null;

    // Recent
    @track isRecentToggled = false;
    recentRecordItems: Array<Record<string, any>> = [];

    _pageRef: any;
    @wire(CurrentPageReference)
    handleNavigation(pageRef: any) {
        if (isUndefinedOrNull(pageRef)) return;
        if (JSON.stringify(this._pageRef) == JSON.stringify(pageRef)) return;

        const applicationName = pageRef?.state?.applicationName || '';
        if (applicationName.toLowerCase() == 'recordviewer') {
            this._pageRef = pageRef;
            this.loadFromNavigation(pageRef);
        }
    }

    connectedCallback() {
        //this.isLoading = true;
        this.header_enableAutoDate();
    }

    renderedCallback() {
        this._hasRendered = true;
        if (this.refs.recordViewerTab) {
            this.refs.recordViewerTab.activeTabValue = this.currentTab?.id;
        }
    }

    disconnectedCallback() {
        clearInterval(this._headerInterval);
    }

    @wire(connectStore, { store })
    storeChange({ recordViewer, application, recents }: { recordViewer: any; application: any; recents: any }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if (!isCurrentApp) return;

        this.tabs = recordViewer.tabs;
        this.currentTab = recordViewer.currentTab;
        this.isRecentToggled = recordViewer.recentPanelToggled;
        //this.isLoading = true

        if (isNotUndefinedOrNull(this.currentTab)) {
            this.recordId = this.currentTab.id;
            this.record = this.currentTab.record;
            this.refreshedDate = this.currentTab.refreshedDate;
            this.recordType = this.currentTab.recordType;
            this.header_formatDate();
        } else {
            this.recordId = null;
            this.record = null;
            this.refreshedDate = null;
            this.recordType = null;
        }

        // Recent API
        if (recents && recents.recordViewers) {
            this.recentRecordItems = recents.recordViewers.map((item, index) => {
                return {
                    id: `${index}`,
                    content: `${item.sobjectName} • ${item.recordId}`,
                    extra: item, // see if no conflict with the code builder component
                };
            });
        }
    }

    /** Methods  **/

    loadFromNavigation = ({ state }: { state: any }): void => {
        const { recordId } = state;
        if (isNotUndefinedOrNull(recordId)) {
            this.hasError = false;
            const tab = RECORDVIEWER.formatTab({ id: recordId });
            store.dispatch(RECORDVIEWER.reduxSlice.actions.upsertTab({ tab }));
        }
    };

    header_formatDate = (): void => {
        this.refreshedDateFormatted = this.refreshedDate
            ? moment(this.refreshedDate).fromNow()
            : null;
    };

    header_enableAutoDate = (): void => {
        this.header_formatDate();
        this._headerInterval = setInterval(() => {
            this.header_formatDate();
        }, 30000);
    };

    /** Events **/

    executeSearchClick = (e?: any): void => {
        const rawInput = this.searchInputValue;
        // Extract the record id
        const recordId = isSalesforceId(rawInput) ? rawInput : getRecordId(rawInput);
        if (isUndefinedOrNull(recordId)) {
            Toast.show({
                label: `No valid recordId`,
                variant: 'error',
                mode: 'dismissible',
            });
        } else {
            const tab = RECORDVIEWER.formatTab({ id: recordId });
            store.dispatch(RECORDVIEWER.reduxSlice.actions.upsertTab({ tab }));
            this._historyIndex = -1;
            this._searchDraft = null;
            this.searchInputValue = null; // reset
        }
    };

    _navigateHistory = (direction: number): void => {
        // Use the persisted store list (already deduped by recordId, most-recent first)
        const history = this.recentRecordItems
            .map((item: Record<string, any>) => item.extra?.recordId as string)
            .filter(Boolean);

        if (history.length === 0) return;

        if (this._historyIndex === -1) {
            // Save whatever is currently typed before entering history mode
            this._searchDraft = this.searchInputValue;
        }

        const newIndex = this._historyIndex + direction;

        if (newIndex < 0) {
            // Navigated past the most recent entry → restore draft
            this._historyIndex = -1;
            this.searchInputValue = this._searchDraft;
            this._searchDraft = null;
        } else if (newIndex < history.length) {
            this._historyIndex = newIndex;
            this.searchInputValue = history[newIndex];
        }
        // Beyond the oldest entry: stay put
    };

    searchInput_handleChange = (e: any): void => {
        this.searchInputValue = e.detail.value;
    };

    searchInput_handleKeyDown = (e: any): void => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            this._navigateHistory(1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            this._navigateHistory(-1);
        }
    };

    searchInput_handleKeyUp = (e: any): void => {
        if (e.key === 'Enter' || e.code === 'Enter' || e.keyCode === 13) {
            e.preventDefault();
            this.executeSearchClick();
        } else if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
            // User typed a real character — exit history navigation mode
            this._historyIndex = -1;
        }
    };

    filterInput_handleChange = (e: any): void => {
        this.filterInputValue = e.detail.value;
        runActionAfterTimeOut(
            e.detail.value,
            (newValue: string) => {
                if (this.refs.recordViewerExplorer) {
                    this.refs.recordViewerExplorer.updateFilter(newValue);
                }
            },
            { timeout: 400, key: 'recordviewer.app.filterInput' }
        );
    };

    handleRecordExplorerDataLoad = (e: any): void => {
        const { record, refreshedDate, recordType, success, recordId } = e.detail;
        this.hasError = !success;
        if (this.hasError) return;

        const tab = RECORDVIEWER.formatTab({
            id: recordId,
            record,
            recordType,
            refreshedDate,
        });
        // Add to Recent Panel :
        store.dispatch(
            DOCUMENT.reduxSlices.RECENT.actions.saveRecordViewers({
                item: {
                    recordId: recordId,
                    sobjectName: record?.attributes?.type,
                },
                alias: this.connector.conn.alias,
            })
        );
        store.dispatch(RECORDVIEWER.reduxSlice.actions.upsertTab({ tab }));
    };

    /** Tabs */

    handleSelectTab = (e: any): void => {
        const tabId = e.target.value;
        store.dispatch(
            RECORDVIEWER.reduxSlice.actions.selectionTab({ id: tabId, alias: this.alias })
        );
    };

    handleCloseTab = async (e: any): Promise<void> => {
        const tabId = e.detail.value;
        store.dispatch(RECORDVIEWER.reduxSlice.actions.removeTab({ id: tabId }));
    };

    /** Storage Files */

    handleRecentToggle = () => {
        store.dispatch(
            RECORDVIEWER.reduxSlice.actions.updateRecentPanel({
                value: !this.isRecentToggled,
                alias: this.alias,
            })
        );
    };

    handleSelectItem = (e: any): void => {
        e.stopPropagation();
        const { id, content, category, extra } = e.detail;
        // Check if tab is already open with
        if (category === CATEGORY_STORAGE.RECENT) {
            // Open in new tab
            const tab = RECORDVIEWER.formatTab({ id: extra.recordId });
            store.dispatch(RECORDVIEWER.reduxSlice.actions.upsertTab({ tab }));
        } else {
            console.warn(`${category} not supported !`);
        }
    };

    handleRemoveItem = (e: any): void => {
        e.stopPropagation();
        const { id } = e.detail;
        store.dispatch(DOCUMENT.reduxSlices.APIFILE.actions.removeOne(id));
    };

    /** Getters */

    get isEmptyTab() {
        return this.tabs.length === 0;
    }

    get isSearchButtonDisabled() {
        return isEmpty(this.searchInputValue);
    }

    get isNoRecord() {
        return (
            isUndefinedOrNull(this.record) && isNotUndefinedOrNull(this.recordId) && this.hasError
        );
    }

    get isMetaDisplayed() {
        return isNotUndefinedOrNull(this.record);
    }

    get isViewerDisplayed() {
        return isNotUndefinedOrNull(this.recordId);
    }

    get hasRecordType() {
        return isNotUndefinedOrNull(this.recordType);
    }

    get pageClass() {
        //Overwrite
        return super.pageClass + ' slds-p-around_small';
    }

    get formattedTabs() {
        return this.tabs.map((x, index) => {
            return {
                ...x,
                name: x.record?.Name || x.id,
                class: classSet('slds-tabs_scoped__item')
                    .add({ 'slds-is-active': x.id === this.recordId })
                    .toString(),
            };
        });
    }

    get recordName() {
        return this.record?.Name;
    }
}
