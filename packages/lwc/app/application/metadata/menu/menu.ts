import { api, wire, track } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { isUndefinedOrNull, isNotUndefinedOrNull } from 'shared/utils';
import { CurrentPageReference, NavigationContext } from 'lwr/navigation';
import { store, connectStore, METADATA } from 'core/store';
import { getMetadataTypeIcon, METADATA_RECORD_ICON } from './constants';

export default class Menu extends ToolkitElement {
    @wire(NavigationContext) navContext;

    @track metadata_global = null;
    @track metadata_records = null;

    @api sobject;
    @api param1;
    @api param2;
    @api label1;
    @api label2;

    currentMetadata;
    isLoading = false;
    loadingMessage;
    isGlobalMetadataLoaded = false;
    error;

    _cache = {};
    _bypassCache = false;

    @wire(CurrentPageReference)
    handlePageReference(pageRef) {
        if (!isUndefinedOrNull(pageRef) && pageRef?.state?.applicationName === 'metadata') {
            if (this._hasRendered) {
                this._pageRef = pageRef;
                this.loadFromNavigation(pageRef);
            }
        }
    }

    @wire(connectStore, { store })
    handleStoreChange({ metadata, application }) {
        if (!this.verifyIsActive(application.currentApplication)) return;

        const _hasParam1Changed = this.param1 != metadata.param1;
        this.param1 = metadata.param1;
        this.label1 = metadata.label1;
        this.sobject = metadata.sobject;
        this.isLoading = metadata.isLoading;
        this.loadingMessage = metadata.loadingMessage;
        this.currentMetadata = metadata.currentMetadata;

        if (JSON.stringify(this.metadata_global) !== JSON.stringify(metadata.metadata_global)) {
            this.metadata_global = metadata.metadata_global;
        }
        if (
            JSON.stringify(this.metadata_records) !== JSON.stringify(metadata.metadata_records) ||
            _hasParam1Changed
        ) {
            this.metadata_records = metadata.metadata_records;
        }
    }

    connectedCallback() {
        store.dispatch(METADATA.fetchGlobalMetadata());
    }

    renderedCallback() {
        if (!this._hasRendered) {
            this._hasRendered = true;
        }
    }

    loadFromNavigation = async ({ state }) => {
        let { applicationName, sobject, param1, label1 } = state;
        if (applicationName != 'metadata') return;
        store.dispatch(async (dispatch, getState) => {
            await dispatch(METADATA.fetchSpecificMetadata({ sobject, force: true }));
            const params = { sobject, param1, label1 };
            if (isNotUndefinedOrNull(param1) && isNotUndefinedOrNull(label1)) {
                dispatch(METADATA.reduxSlice.actions.setAttributes(params));
                this.dispatchSelectionEvent(params);
            }
        });
    };

    dispatchSelectionEvent = detail => {
        this.dispatchEvent(new CustomEvent('select', { detail, bubbles: true, composed: true }));
    };

    /** Events */

    handleTypeSelect = event => {
        const item = event.detail?.item;
        if (!item?.rawName) return;
        store.dispatch(METADATA.fetchSpecificMetadata({ sobject: item.rawName }));
    };

    handleRecordSelect = async event => {
        const item = event.detail?.item;
        if (!item) return;
        const { rawName: name, label, _developerName } = item;
        const params = {
            sobject: this.currentMetadata,
            param1: name,
            label1: label || name,
            _developerName,
        };
        await store.dispatch(METADATA.reduxSlice.actions.setAttributes(params));
        this.dispatchSelectionEvent(params);
    };

    handleRefresh = () => {
        store.dispatch(METADATA.fetchGlobalMetadata());
    };

    handleGoBack = () => {
        store.dispatch(METADATA.reduxSlice.actions.goBack());
    };

    /** Getters */

    get computedTypesTree() {
        const records = this.metadata_global?.records || [];
        return records
            .map(record => ({
                id: record.key || record.name,
                name: record.label || record.name,
                title: record.label || record.name,
                rawName: record.name,
                icon: getMetadataTypeIcon(record.name),
            }))
            .sort((a, b) => (a.name || '').localeCompare(b.name));
    }

    get computedRecordsTree() {
        const records = this.metadata_records?.records || [];
        return records
            .map(record => ({
                id: record.key || record.name,
                name: record.label || record.name,
                title: record.label || record.name,
                rawName: record.name,
                label: record.label || record.name,
                _developerName: record._developerName,
                icon: METADATA_RECORD_ICON,
            }))
            .sort((a, b) => (a.name || '').localeCompare(b.name));
    }

    get selectedTypeId() {
        return this.currentMetadata || '';
    }

    get selectedRecordId() {
        return this.param1 || '';
    }

    get isRecordsPanelVisible() {
        return isNotUndefinedOrNull(this.metadata_records);
    }

    get recordCount() {
        return this.metadata_records?.records?.length ?? 0;
    }

    get recordsPanelTitle() {
        return this.isLoading
            ? this.currentMetadata
            : `${this.currentMetadata} (${this.recordCount})`;
    }

    get isLoadingTypes() {
        return this.isLoading && !this.isRecordsPanelVisible;
    }

    get isLoadingRecords() {
        return this.isLoading && this.isRecordsPanelVisible;
    }

    get searchFields() {
        return ['name', 'id'];
    }

    get attributes() {
        return {
            sobject: this.sobject,
            param1: this.param1,
            label1: this.label1,
        };
    }
}
