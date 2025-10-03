import { api, wire, track } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import {
    isUndefinedOrNull,
    isNotUndefinedOrNull
} from 'shared/utils';
import { CurrentPageReference, NavigationContext } from 'lwr/navigation';
import { store, connectStore, METADATA } from 'core/store';
// Constants
export default class Menu extends ToolkitElement {
    @wire(NavigationContext) navContext;

    // Trackable Properties
    @track metadata_global = null;
    @track metadata_records = null;
    @track menuItems = [];

    @api sobject;
    @api param1;
    @api param2;
    @api label1;
    @api label2;

    // Internal State
    currentMetadata;
    isLoading = false;
    loadingMessage;
    isGlobalMetadataLoaded = false;
    error;

    // Cache
    _cache = {};
    _bypassCache = false;

    // Page Reference
    @wire(CurrentPageReference)
    handlePageReference(pageRef) {
        if (!isUndefinedOrNull(pageRef) && pageRef?.state?.applicationName === 'metadata') {
            // Check if the new pageRef is different
            if (this._hasRendered) {
                // JSON.stringify(this._pageRef) !== JSON.stringify(pageRef)
                this._pageRef = pageRef;
                this.loadFromNavigation(pageRef);
            }
        }
    }

    @wire(connectStore, { store })
    handleStoreChange({ metadata, application }) {
        if (!this.verifyIsActive(application.currentApplication)) return;
        //Object.assign(this, metadata);
        //this.currentLevel = metadata.currentLevel;
        const _hasParam1Changed = this.param1 != metadata.param1;
        this.param1 = metadata.param1;
        this.label1 = metadata.label1;
        this.sobject = metadata.sobject;
        this.isLoading = metadata.isLoading;
        this.loadingMessage = metadata.loadingMessage;
        this.currentMetadata = metadata.currentMetadata;

        if (JSON.stringify(this.metadata_global) !== JSON.stringify(metadata.metadata_global)) {
            this.metadata_global = metadata.metadata_global;
            this.setMenuItems();
        }
        if (
            JSON.stringify(this.metadata_records) !== JSON.stringify(metadata.metadata_records) ||
            _hasParam1Changed
        ) {
            this.metadata_records = metadata.metadata_records;
            this.forceRefresh = false;
            this.setMenuItems();
        }
    }

    connectedCallback() {
        // Initialization logic here
        store.dispatch(METADATA.fetchGlobalMetadata());
    }

    renderedCallback() {
        if (!this._hasRendered) {
            this._hasRendered = true;
            //this.loadFromNavigation(this._pageRef);
        }
    }

    // Methods

    loadFromNavigation = async ({ state }) => {
        let { applicationName, sobject, param1, label1 } = state;
        if (applicationName != 'metadata') return; // Only for metadata
        store.dispatch(async (dispatch, getState) => {
            await dispatch(METADATA.fetchSpecificMetadata({ sobject, force: true }));
            const params = { sobject, param1, label1 };
            if (isNotUndefinedOrNull(param1) && isNotUndefinedOrNull(label1)) {
                dispatch(METADATA.reduxSlice.actions.setAttributes(params));
                this.dispatchSelectionEvent(params);
            }
        });
        //store.dispatch(METADATA.reduxSlice.actions.setAttributes(state));
    };

    setMenuItems = () => {
        const records = this.metadata_records
            ? this.metadata_records.records
            : this.metadata_global?.records || [];
        this.menuItems =
            records
                .map(record => ({
                    ...record,
                    isSelected: this.selectedItem === record.key,
                }))
                .sort((a, b) => (a.label || '').localeCompare(b.label)) || [];
    };

    dispatchSelectionEvent = detail => {
        this.dispatchEvent(new CustomEvent('select', { detail, bubbles: true, composed: true }));
    };

    /** Events */

    handleMenuSelection = async e => {
        //console.log('e.detail', e.detail);
        const { name, label, _developerName } = e.detail;
        if (this.currentLevel === 0) {
            //this.currentMetadata = name;
            store.dispatch(METADATA.fetchSpecificMetadata({ sobject: name }));
        } else if (this.currentLevel === 1) {
            //this.param1 = name;
            //this.label1 = label;
            const params = {
                sobject: this.currentMetadata,
                param1: name,
                label1: label,
                _developerName,
            };
            await store.dispatch(METADATA.reduxSlice.actions.setAttributes(params));
            this.dispatchSelectionEvent(params);
            /*store.dispatch(METADATA.reduxSlice.actions.setAttributes({
                ...this.attributes,
                param1: name,
                label1: label
            }));*/
        }
    };

    handleMenuBack = () => {
        this.keepFilter = false;
        store.dispatch(METADATA.reduxSlice.actions.goBack());
    };

    // Getters

    get currentLevel() {
        return isNotUndefinedOrNull(this.metadata_records) ? 1 : 0;
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

    get attributes() {
        return {
            sobject: this.sobject,
            param1: this.param1,
            label1: this.label1,
        };
    }

    get isBackDisplayed() {
        return this.currentLevel > 0;
    }

    get selectedItem() {
        return this.currentLevel === 2
            ? this.param2
            : this.currentLevel === 1
              ? this.param1
              : this.currentMetadata;
    }
}
