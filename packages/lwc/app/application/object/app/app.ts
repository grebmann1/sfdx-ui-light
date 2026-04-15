import { wire, api, track } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { CurrentPageReference, NavigationContext, navigate } from 'lwr/navigation';
import { isUndefinedOrNull, isNotUndefinedOrNull, lowerCaseKey } from 'shared/utils';
import { store_application, store as legacyStore } from 'shared/store';
import { connectStore, store, DESCRIBE, SOBJECTEXPLORER } from 'core/store';
import Analytics from 'shared/analytics';
import { getCategoryIcon } from './constants';

const TYPEFILTER_OPTIONS = [
    { label: 'Object', value: 'object' },
    { label: 'Change Event', value: 'change' },
    { label: 'Platform Event', value: 'event' },
    { label: 'Custom Metadata', value: 'metadata' },
    { label: 'Feed', value: 'feed' },
    { label: 'History', value: 'history' },
    { label: 'Share', value: 'share' },
];

const METADATAFILTER_OPTIONS = [
    { label: 'Is Searchable', value: 'searchable' },
    { label: 'Is Layoutable', value: 'layoutable' },
    { label: 'Is Queryable', value: 'queryable' },
    { label: 'Is Custom', value: 'custom' },
    { label: 'Is Retrieveable', value: 'retrieveable' },
];

export default class App extends ToolkitElement {
    _hasRendered = false;
    @wire(NavigationContext)
    navContext: any;

    @track tabs: Array<Record<string, any>> = [];
    @track currentTab: Record<string, any> | null = null;

    displayFilter = false;
    records: Array<Record<string, any>> = [];
    @track filteredRecords: Array<Record<string, any>> = [];

    // Filter
    typeFilter_value: string[] = [];
    metadataFilter_value: string[] = [];

    _pageRef: any;
    @wire(CurrentPageReference)
    handleNavigation(pageRef: any) {
        if (isUndefinedOrNull(pageRef)) return;
        if (pageRef?.state?.applicationName == 'sobject') {
            this._pageRef = pageRef;
            this.loadFromNavigation(pageRef);
        }
    }

    @wire(connectStore, { store })
    storeChange({ sobjectExplorer, application }: { sobjectExplorer: any; application: any }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if (!isCurrentApp) return;
        this.tabs = sobjectExplorer.tabs;
        this.currentTab = sobjectExplorer.currentTab;
    }

    connectedCallback() {
        Analytics.trackAppOpen('object', { alias: this.alias });
        this.loadCachedSettings();
        this.loadAlls();
    }

    renderedCallback() {
        this._hasRendered = true;
        if (this.refs.objectTab) {
            this.refs.objectTab.activeTabValue = this.currentTab?.id;
        }
    }

    /** Events */

    goToUrl = (e: any): void => {
        const redirectUrl = e.currentTarget.dataset.url;
        legacyStore.dispatch(store_application.navigate(redirectUrl));
    };

    handleCloseVerticalPanel = (e: any): void => {
        this.displayFilter = false;
    };

    handleTreeSelect = (e: any): void => {
        const item = e.detail?.item;
        if (!item?.rawName) return;
        navigate(this.navContext, {
            type: 'application',
            state: {
                applicationName: 'sobject',
                attribute1: item.rawName,
            },
        });
    };

    handleRefresh = async (): Promise<void> => {
        await this.describeAll();
    };

    handleTabSelect = (e: any): void => {
        const tabId = e.target.value;
        store.dispatch(SOBJECTEXPLORER.reduxSlice.actions.selectTab({ id: tabId }));
    };

    handleTabClose = (e: any): void => {
        const tabId = e.detail.value;
        store.dispatch(SOBJECTEXPLORER.reduxSlice.actions.removeTab({ id: tabId }));
    };

    filtering_handleClick = (e: any): void => {
        this.displayFilter = !this.displayFilter;
    };

    typeFilter_onChange = (e: any): void => {
        this.typeFilter_value = e.detail.value;
        setTimeout(() => {
            this.filteredRecords = this.filterRecords();
        }, 1);
    };

    metadataFilter_onChange = (e: any): void => {
        this.metadataFilter_value = e.detail.value;
        setTimeout(() => {
            this.filteredRecords = this.filterRecords();
        }, 1);
    };

    /** Methods */

    loadFromNavigation = async ({ state }: { state: any }): Promise<void> => {
        const { applicationName, attribute1 } = state;
        if (applicationName != 'sobject') return;
        if (attribute1) {
            const tab = SOBJECTEXPLORER.formatTab({ id: attribute1, label: attribute1 });
            store.dispatch(SOBJECTEXPLORER.reduxSlice.actions.upsertTab({ tab }));
        }
        this.filteredRecords = this.filterRecords();
    };

    extractCategory = (item: string): string => {
        if (item.endsWith('ChangeEvent')) return 'change';
        if (item.endsWith('Feed')) return 'feed';
        if (item.endsWith('History')) return 'history';
        if (item.endsWith('Share')) return 'share';
        if (item.endsWith('__mdt')) return 'metadata';
        if (item.endsWith('__e')) return 'event';
        return 'object';
    };

    filterRecords = (): Array<Record<string, any>> => {
        if (this.typeFilter_value.length == 0 && this.metadataFilter_value.length == 0)
            return this.records;
        return this.records
            .filter(
                x =>
                    this.typeFilter_value.includes(x.category) || this.typeFilter_value.length == 0
            )
            .filter(
                x =>
                    this.metadataFilter_value.reduce((acc, y) => {
                        return acc && x[y];
                    }, true) || this.metadataFilter_value.length == 0
            );
    };

    loadAlls = async (): Promise<void> => {
        await this.describeAll();
    };

    load_describeGlobal = async (): Promise<Array<Record<string, any>>> => {
        const { standard, tooling } = (
            await store.dispatch(
                DESCRIBE.describeSObjects({
                    connector: this.connector.conn,
                })
            )
        ).payload;
        return standard?.sobjects || [];
    };

    describeAll = async (): Promise<void> => {
        this.isLoading = true;
        try {
            const records = (await this.load_describeGlobal()) || [];
            this.records = records.map(x => ({ ...x, category: this.extractCategory(x.name) }));
            this.filteredRecords = this.filterRecords();
        } catch (e) {
            console.error(e);
        }
        this.isLoading = false;
    };

    loadCachedSettings = (): void => {
        if (isNotUndefinedOrNull(this.connector.configuration.alias)) {
            // Optionally load filter settings
        }
    };

    /** Getters */

    get computedTree() {
        return this.filteredRecords
            .map(x => ({
                id: lowerCaseKey(x.name),
                name: `${x.name} / ${x.label}`,
                title: `${x.name} / ${x.label}`,
                rawName: x.name,
                icon: getCategoryIcon(x.category, x.custom),
            }))
            .sort((a, b) => a.rawName.localeCompare(b.rawName));
    }

    get selectedId() {
        return this.currentTab?.id ? lowerCaseKey(this.currentTab.id) : '';
    }

    get sobjectCount() {
        return this.filteredRecords.length;
    }

    get panelTitle() {
        return this.isLoading ? 'SObjects' : `SObjects (${this.sobjectCount})`;
    }

    get searchFields() {
        return ['name', 'id'];
    }

    get typeFilter_options() {
        return TYPEFILTER_OPTIONS;
    }

    get metadataFilter_options() {
        return METADATAFILTER_OPTIONS;
    }

    get filtering_variant() {
        return this.displayFilter ? 'brand' : 'border-filled';
    }

    get pageClass() {
        return super.pageClass + ' slds-p-around_small';
    }

    get formattedTabs() {
        return this.tabs.map(tab => ({
            ...tab,
            name: tab.label || tab.id,
        }));
    }

    get activeTabId() {
        return this.currentTab?.id;
    }

    get isViewerDisplayed() {
        return isNotUndefinedOrNull(this.currentTab);
    }
}
