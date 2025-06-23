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

export default class App extends ToolkitElement {
    isLoading = false;
    isDeploymentRunning = false;
    isRetrieveRunning = false;
    currentMethod;

    _deploymentResponse;
    _retrieveResponse;
    //_deploymentRequestId;

    isLeftToggled = false;

    // Metadata Menu
    sobject;
    param1;
    param2;
    label1;
    label2;

    connectedCallback() {
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
    storeChange({ package2, application }) {
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

    setMenuItems = () => {
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

    formatName = x => {
        const name = x.MasterLabel || x.Name || x.DeveloperName || x.Id;
        return x.NamespacePrefix ? `${x.NamespacePrefix}__${name}` : name;
    };

    /** Events **/

    handleItemSelection = e => {
        if (this.refs.retrieve) {
            this.refs.retrieve.toggleMetadata(e.detail);
        }
        //this.load_specificMetadataRecord(e.detail);
    };

    handleSelectAll = e => {
        const { sobject } = e.detail;
        if (this.refs.retrieve) {
            this.refs.retrieve.toggleMetadata({ selectAll: [sobject] });
        }
    };

    handleUnselectAll = e => {
        const { sobject } = e.detail;
        if (this.refs.retrieve) {
            this.refs.retrieve.toggleMetadata({ unselectAll: [sobject] });
        }
    };

    handleLeftToggle = e => {
        store.dispatch(
            PACKAGE.reduxSlice.actions.updateLeftPanel({
                value: !this.isLeftToggled,
                alias: this.alias,
            })
        );
    };

    handleSelectMethod = e => {
        store.dispatch(
            PACKAGE.reduxSlice.actions.updateCurrentMethodPanel({
                alias: this.alias,
                value: e.target.value,
            })
        );
    };

    handleDeploy = e => {
        this.refs.deploy.run();
    };

    handleNewDeployment = e => {
        if (this.currentMethod === super.i18n.TAB_DEPLOY) {
            this.refs.deploy.reset();
        }
    };

    handleRetrieve = e => {
        this.refs.retrieve.run();
    };

    goToUrl = e => {
        e.preventDefault();
        const redirectUrl = e.currentTarget.dataset.url;
        legacyStore.dispatch(store_application.navigate(redirectUrl));
    };

    handleAbort = e => {
        if (this.currentMethod === super.i18n.TAB_RETRIEVE) {
            this.refs.retrieve.abort();
        }
    };

    /** Getters */

    get pageClass() {
        //Overwrite
        return super.pageClass + ' slds-p-around_small';
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

    get deployClass() {
        return `slds-fill-height ${this.isDeployVisible ? 'slds-visible' : 'slds-hide'}`;
    }

    get retrieveClass() {
        return `slds-fill-height ${this.isRetrieveVisible ? 'slds-visible' : 'slds-hide'}`;
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
