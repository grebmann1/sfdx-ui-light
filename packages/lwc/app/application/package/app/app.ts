import { api, track, wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import {
    lowerCaseKey,
    isUndefinedOrNull,
    isNotUndefinedOrNull,
    isEmpty,
    guid,
    classSet,
    runActionAfterTimeOut,
    compareString,
    splitTextByTimestamp,
} from 'shared/utils';
import { store, connectStore, PACKAGE, SELECTORS } from 'core/store';
import { store_application, store as legacyStore } from 'shared/store';
import Toast from 'lightning/toast';
import Analytics from 'shared/analytics';

type AnyRecord = Record<string, any>;

export default class App extends ToolkitElement {
    isLoading = false;
    isDeploymentRunning = false;
    isRetrieveRunning = false;
    currentMethod: string | null = null;

    _deploymentResponse: AnyRecord | null = null;
    _retrieveResponse: AnyRecord | null = null;
    //_deploymentRequestId;

    isLeftToggled = false;

    // Metadata Menu
    sobject: string | null = null;
    param1: AnyRecord | null = null;
    param2: AnyRecord | null = null;
    label1: string | null = null;
    label2: string | null = null;
    metadata: AnyRecord[] = [];
    menuItems: AnyRecord[] = [];
    currentLevel = 0;
    currentMetadata: string | null = null;

    connectedCallback() {
        Analytics.trackAppOpen('package', { alias: this.alias });
        //this.isLoading = true;

        store.dispatch((dispatch, getState) => {
            dispatch(
                PACKAGE.reduxSlice.actions.loadCacheSettings({
                    alias: this.alias,
                    apexFiles: getState().apexFiles,
                })
            );
        });
    }

    @wire(connectStore, { store })
    storeChange({ package2, application }: { package2: AnyRecord; application: AnyRecord }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if (!isCurrentApp) return;

        this.currentMethod = package2.currentMethod || super.i18n.TAB_DEPLOY; // Default to TAB_DEPLOY
        this.isLeftToggled =
            package2.leftPanelToggled && this.currentMethod === super.i18n.TAB_RETRIEVE;

        // Deployment
        const deployState = package2.currentDeploymentJob;
        if (deployState) {
            this.isDeploymentRunning = deployState.isFetching;
            //this._deploymentRequestId = deployState.id;
            if (deployState.error) {
                this._deploymentResponse = null;
            } else if (deployState.data) {
                // Assign Data
                this._deploymentResponse = deployState.data;
            } else if (deployState.isFetching) {
                this._deploymentResponse = null;
            }
        } else {
            this._deploymentResponse = null;
        }

        // Retrieve
        const retrieveState = package2.currentRetrieveJob;
        if (retrieveState) {
            this.isRetrieveRunning = retrieveState.isFetching;
            if (retrieveState.error) {
                this._retrieveResponse = null;
            } else if (retrieveState.data) {
                // Assign Data
                this._retrieveResponse = retrieveState.data;
            } else if (retrieveState.isFetching) {
                this._retrieveResponse = null;
            }
        } else {
            this._retrieveResponse = null;
        }
    }

    /** Methods  **/

    setMenuItems = (): void => {
        // Doesn't work all the time if param1 isn't the recordId !!! (Example LWC)
        //console.log('this.metadata',this.metadata);
        if (this.metadata.length == 0) {
            this.menuItems = [];
        } else {
            this.menuItems = this.metadata[this.metadata.length - 1].records.map(x => ({
                ...x,
                isSelected: this.selectedItem == x.key,
            }));
        }
    };

    formatName = (x: AnyRecord): string => {
        const name = x.MasterLabel || x.Name || x.DeveloperName || x.Id;
        return x.NamespacePrefix ? `${x.NamespacePrefix}__${name}` : name;
    };

    /** Events **/

    handleItemSelection = (e: any): void => {
        if (this.refs.retrieve) {
            this.refs.retrieve.toggleMetadata(e.detail);
        }
        //this.load_specificMetadataRecord(e.detail);
    };

    handleSelectAll = (e: any): void => {
        const { sobject } = e.detail;
        if (this.refs.retrieve) {
            this.refs.retrieve.toggleMetadata({ selectAll: [sobject] });
        }
    };

    handleUnselectAll = (e: any): void => {
        const { sobject } = e.detail;
        if (this.refs.retrieve) {
            this.refs.retrieve.toggleMetadata({ unselectAll: [sobject] });
        }
    };

    handleLeftToggle = (e: any): void => {
        store.dispatch(
            PACKAGE.reduxSlice.actions.updateLeftPanel({
                value: !this.isLeftToggled,
                alias: this.alias,
            })
        );
    };

    handleMethodTabActive = (e: any): void => {
        const value = e.target.value;
        if (value) {
            store.dispatch(
                PACKAGE.reduxSlice.actions.updateCurrentMethodPanel({
                    alias: this.alias,
                    value,
                })
            );
        }
    };

    handleDeploy = (e: any): void => {
        this.refs.deploy.run();
    };

    handleNewDeployment = (e: any): void => {
        if (this.currentMethod === super.i18n.TAB_DEPLOY) {
            this.refs.deploy.reset();
        }
    };

    handleRetrieve = (e: any): void => {
        this.refs.retrieve.run();
    };

    goToUrl = (e: any): void => {
        e.preventDefault();
        const redirectUrl = e.currentTarget.dataset.url;
        legacyStore.dispatch(store_application.navigate(redirectUrl));
    };

    handleAbort = (e: any): void => {
        if (this.currentMethod === super.i18n.TAB_RETRIEVE) {
            this.refs.retrieve.abort();
        }
    };

    /** Getters */

    get pageClass() {
        //Overwrite
        return super.pageClass;
    }

    get isDeployVisible() {
        return this.currentMethod === super.i18n.TAB_DEPLOY;
    }

    get isRetrieveVisible() {
        return this.currentMethod === super.i18n.TAB_RETRIEVE;
    }

    get isNewDeploymentButtonDisplayed() {
        return this._deploymentResponse?.success;
    }

    get noRecordMessage() {
        return `This record wasn't found in your metadata.`;
    }

    get isCatalogDisabled() {
        return !this.isRetrieveVisible;
    }

    get isRefreshButtonDisplayed() {
        return this.currentLevel === 1;
    }

    get selectedItem() {
        if (this.currentLevel == 2) {
            return this.param2;
        } else if (this.currentLevel == 1) {
            return this.param1;
        } else if (this.currentLevel == 0) {
            return this.currentMetadata;
        } else {
            return null;
        }
    }

    get menuBackTitle() {
        if (this.currentLevel == 2) {
            return this.label1;
        } else if (this.currentLevel == 1) {
            return this.currentMetadata;
        } else if (this.currentLevel == 0) {
            return '';
        }
    }

    get isBackDisplayed() {
        return this.currentLevel > 0;
    }
}
