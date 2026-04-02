import { wire, api, track } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { CurrentPageReference, NavigationContext, navigate } from 'lwr/navigation';
import { isUndefinedOrNull, isNotUndefinedOrNull } from 'shared/utils';
import { store_application, store as legacyStore } from 'shared/store';
import { connectStore, store, DESCRIBE, SOBJECTEXPLORER } from 'core/store';
import Analytics from 'shared/analytics';

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
    filteredRecords: Array<Record<string, any>> = [];
    menuRecords: Array<Record<string, any>> = [];
    @track formattedMenuItems: Array<Record<string, any>> = [];

    // Filter
    typeFilter_value: string[] = [];
    metadataFilter_value: string[] = [];
    keepFilter = false;

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

    handleItemSelection = async (e: any): Promise<void> => {
        const objectName = e.detail.name;
        // Open or focus tab
        navigate(this.navContext, {
            type: 'application',
            state: {
                applicationName: 'sobject',
                attribute1: objectName,
            },
        });
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
            this.setFormattedMenuItems();
        }, 1);
    };

    metadataFilter_onChange = (e: any): void => {
        this.metadataFilter_value = e.detail.value;
        setTimeout(() => {
            this.filteredRecords = this.filterRecords();
            this.setFormattedMenuItems();
        }, 1);
    };

    /** Methods */

    loadFromNavigation = async ({ state }: { state: any }): Promise<void> => {
        this.keepFilter = false;
        const { applicationName, attribute1 } = state;
        if (applicationName != 'sobject') return;
        if (attribute1) {
            this.keepFilter = true;
            // Open or focus tab
            const tab = SOBJECTEXPLORER.formatTab({ id: attribute1, label: attribute1 });
            store.dispatch(SOBJECTEXPLORER.reduxSlice.actions.upsertTab({ tab }));
        }
        this.setFormattedMenuItems();
    };

    extractCategory = (item: string): string => {
        if (item.endsWith('ChangeEvent')) {
            return 'change';
        } else if (item.endsWith('Feed')) {
            return 'feed';
        } else if (item.endsWith('History')) {
            return 'history';
        } else if (item.endsWith('Share')) {
            return 'share';
        } else if (item.endsWith('__mdt')) {
            return 'metadata';
        }
        return 'object';
    };

    filterRecords = (): Array<Record<string, any>> => {
        if (this.typeFilter_value.length == 0 && this.metadataFilter_value.length == 0)
            return this.records;
        return this.records
            .filter(
                x => this.typeFilter_value.includes(x.category) || this.typeFilter_value.length == 0
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
        this.setFormattedMenuItems();
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

    setFormattedMenuItems = (): void => {
        this.formattedMenuItems = this.filteredRecords
            .map(x => ({
                label: `${x.label}(${x.name})`,
                name: x.name,
                key: x.name,
                isSelected: this.currentTab && this.currentTab.id === x.name,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    };

    /** Getters */

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
