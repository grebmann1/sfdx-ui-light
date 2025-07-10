import { api, wire, track } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { CurrentPageReference, NavigationContext, generateUrl, navigate } from 'lwr/navigation';
import LightningConfirm from 'lightning/confirm';
import Toast from 'lightning/toast';
import SaveModal from 'builder/saveModal';
import PerformanceModal from 'soql/performanceModal';
import {
    store,
    connectStore,
    SELECTORS,
    DESCRIBE,
    UI,
    QUERY,
    DOCUMENT,
    APPLICATION,
} from 'core/store';
import {
    guid,
    guidFromHash,
    isNotUndefinedOrNull,
    isUndefinedOrNull,
    fullApiName,
    compareString,
    lowerCaseKey,
    getFieldValue,
    isObject,
    arrayToMap,
    extractErrorDetailsFromQuery,
    shortFormatter,
    isEmpty,
} from 'shared/utils';
import { CATEGORY_STORAGE } from 'builder/storagePanel';
import moment from 'moment';
import { escapeCsvValue, formatQueryWithComment } from './util.js';
import LOGGER from 'shared/logger';

export default class App extends ToolkitElement {
    // used to controle store of childs
    isActive;
    isLoading = false;
    isDownloading = false;
    isDownloadCanceled = false;

    @track selectedSObject;
    @track isLeftToggled = true;
    @track isRecentToggled = false;
    @api namespace;

    @track recentQueries = [];
    @track savedQueries = [];

    @track selectedRecords = [];
    @track selectedChildRecords = [];

    soql;
    _useToolingApi;
    sobjectPrefixMapping;

    // Response
    _response;
    _responseCreatedDate;
    _responseCreatedDateFormatted;
    _responseNextRecordsUrl;
    _responseRows;
    _sobject;
    _interval;

    // Aborting
    _abortingMap = {};
    _displayStopButton = false;

    //
    querySet = new Set();

    connectedCallback() {
        store.dispatch(
            DESCRIBE.describeSObjects({
                connector: this.connector.conn,
            })
        );
        //this.sobjectPrefixMapping = this.generatePrefixMapping();
        //store.dispatch(QUERY.reduxSlice.actions.dummyData());

        if (this.alias) {
            store.dispatch((dispatch, getState) => {
                dispatch(
                    DOCUMENT.reduxSlices.QUERYFILE.actions.loadFromStorage({
                        alias: this.alias,
                    })
                );
                dispatch(
                    UI.reduxSlice.actions.loadCacheSettings({
                        alias: this.alias,
                        queryFiles: getState().queryFiles,
                    })
                );
            });
        }
        this.enableAutoDate();
    }

    disconnectedCallback() {
        clearInterval(this._interval);
    }

    _hasRendered = false;
    renderedCallback() {
        if (!this._hasRendered) {
            this._hasRendered = true;
            this.loadFromNavigation(this._pageRef);
        }
    }

    _pageRef;
    @wire(CurrentPageReference)
    handleNavigation(pageRef) {
        if (isUndefinedOrNull(pageRef)) return;
        if (JSON.stringify(this._pageRef) == JSON.stringify(pageRef)) return;

        this._pageRef = pageRef;
        if (this._hasRendered) {
            this.loadFromNavigation(pageRef);
            
        }
        //  this.loadFromNavigation(pageRef);
        //('this._hasRendered',this._hasRendered);
    }

    loadFromNavigation = async (pageRef) => {
        const { state } = pageRef;
        // Use state.query to force a specific query to be loaded !
        if (isNotUndefinedOrNull(state.query)) {
            const _guid = guidFromHash(state.query);
            const { ui } = store.getState();
            const existingTab = ui.tabs.find(x => x.id === _guid);
            if (existingTab) {
                store.dispatch(UI.reduxSlice.actions.selectionTab(existingTab));
            } else {
                store.dispatch(
                    UI.reduxSlice.actions.addTab({
                        tab: {
                            id: _guid,
                            body: state.query,
                        },
                    })
                );
            }

            // Remove query from url
            const searchParams = new URLSearchParams(window.location.search);
            searchParams.delete('query'); // Remove the 'query' parameter
            // Update the URL without reloading the page
            window.history.replaceState(
                {},
                '',
                `${window.location.origin}${window.location.pathname}?${searchParams.toString()}`
            );
        }
    };

    @wire(connectStore, { store })
    storeChange({ query, ui, describe, queryFiles, recents, application }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if (!isCurrentApp) return;

        if (ui && this._useToolingApi != ui.useToolingApi) {
            this._useToolingApi = ui.useToolingApi;
        }
        this.isLeftToggled = ui.leftPanelToggled;
        this.isRecentToggled = ui.recentPanelToggled;
        this.soql = ui.soql;

        const fullSObjectName = ui.selectedSObject
            ? lowerCaseKey(fullApiName(ui.selectedSObject, this.namespace))
            : null;
        if (fullSObjectName && describe.nameMap && describe.nameMap[fullSObjectName]) {
            this.selectedSObject = fullSObjectName;
        } else {
            this.selectedSObject = null;
        }
        /** Responses */

        const queryState = SELECTORS.queries.selectById({ query }, lowerCaseKey(ui.currentTab?.id));
        if (queryState) {
            if (queryState.error) {
                this._abortingMap[ui.currentTab.id] = null; // Reset the abortingMap
                this._displayStopButton = false;
                this.resetResponse();
            } else if (queryState.data) {
                this._response = queryState.data;
                this._responseCreatedDate = queryState.createdDate;
                this._responseNextRecordsUrl = queryState.data.nextRecordsUrl;
                this._responseRows = queryState.data.records;
                this._abortingMap[ui.currentTab.id] = null; // Reset the abortingMap
                this._displayStopButton = false;
                this._sobject = describe.nameMap[queryState.sobjectName];
                this.formatDate();
            } else if (queryState.isFetching) {
                this._displayStopButton = true;
                this.resetResponse();
            } else {
                // For queryExplain as i am reusing the same redux and it doesn't contain any data
                // TODO: Improve this for performances
                this._displayStopButton = false;
            }
        } else {
            this.resetResponse();
        }

        /** Recent Queries */
        if (recents && recents.queries) {
            this.recentQueries = recents.queries.map((query, index) => {
                return { id: `${index}`, content: query };
            });
        }

        /** Saved Queries */
        if (queryFiles) {
            const entities = SELECTORS.queryFiles.selectAll({ queryFiles });
            this.savedQueries = entities
                .filter(item => item.isGlobal || item.alias == this.alias)
                .map((item, index) => {
                    return item; // no mutation for now
                });
        }
    }

    resetResponse = () => {
        this._response = null;
        this._responseCreatedDate = null;
        this._responseNextRecordsUrl = null;
        this._responseRows = null;
        this._sobject = null;
    };

    formatDate = () => {
        this._responseCreatedDateFormatted = this._responseCreatedDate
            ? moment(this._responseCreatedDate).fromNow()
            : null;
    };

    enableAutoDate = () => {
        this.formatDate();
        this._interval = setInterval(() => {
            this.formatDate();
        }, 30000);
    };

    deleteRecords = async (sobject, records) => {
        if (isUndefinedOrNull(sobject)) return;
        const connector = sobject.useToolingApi ? this.connector.conn.tooling : this.connector.conn;
        const rets = await connector.sobject(sobject.name).delete(records.map(x => x.Id));
        return rets;
    };

    /** Events **/

    handleLeftToggle = e => {
        store.dispatch(
            UI.reduxSlice.actions.updateLeftPanel({
                value: !this.isLeftToggled,
                alias: this.alias,
            })
        );
    };

    handleRecentToggle = e => {
        store.dispatch(
            UI.reduxSlice.actions.updateRecentPanel({
                value: !this.isRecentToggled,
                alias: this.alias,
            })
        );
    };

    handlePerformanceCheckClick = async e => {
        try {
            const { ui, describe } = store.getState();
            //this.isLoading = true;
            const result = await store
                .dispatch(
                    QUERY.explainQuery({
                        connector: this.connector,
                        soql: formatQueryWithComment(this.soql),
                        tabId: ui.currentTab.id,
                        useToolingApi:
                            describe.nameMap[lowerCaseKey(this.selectedSObject)]?.useToolingApi,
                    })
                )
                .unwrap();
            //this.isLoading = false;
            const plans = result.data.plans;
            PerformanceModal.open({ plans });
        } catch (e) {
            // handle error here
            console.error('error', e);

            //this.isLoading = false;
        }
    };

    executeAction = e => {
        const isAllRows = false;
        const inputEl = this.refs?.editor?.editor?.currentModel;
        if (!inputEl) return;
        let query = inputEl.getValue();
        if (!query) return;

        const { ui, describe } = store.getState();
        store.dispatch(UI.reduxSlice.actions.deselectChildRelationship());
        const queryPromise = store.dispatch(
            QUERY.executeQuery({
                connector: this.connector,
                soql: formatQueryWithComment(query),
                tabId: ui.currentTab.id,
                sobjectName: this.selectedSObject,
                isAllRows,
                createdDate: Date.now(),
                useToolingApi: describe.nameMap[lowerCaseKey(this.selectedSObject)]?.useToolingApi,
                includeDeletedRecords: ui.includeDeletedRecords || false,
            })
        );
        this._abortingMap[ui.currentTab.id] = queryPromise;
    };

    handleAbortClick = e => {
        const { ui } = store.getState();
        const queryPromise = this._abortingMap[ui.currentTab.id];
        if (queryPromise) {
            queryPromise.abort();
        }
    };

    handleSaveClick = () => {
        const { ui } = store.getState();
        const file = ui.currentTab.fileId
            ? SELECTORS.queryFiles.selectById(store.getState(), lowerCaseKey(ui.currentTab.fileId))
            : null;
        SaveModal.open({
            title: 'Save Query',
            _file: file,
        }).then(async data => {
            if (isUndefinedOrNull(data)) return;

            const { name, isGlobal } = data;
            store.dispatch(async (dispatch, getState) => {
                await dispatch(
                    DOCUMENT.reduxSlices.QUERYFILE.actions.upsertOne({
                        id: name, // generic
                        isGlobal, // generic
                        content: this.soql,
                        alias: this.alias,
                        extra: {
                            useToolingApi: this._useToolingApi === true, // Needed for queries
                        },
                    })
                );
                await dispatch(
                    UI.reduxSlice.actions.linkFileToTab({
                        fileId: name,
                        alias: this.alias,
                        queryFiles: getState().queryFiles,
                    })
                );
            });

            // Reset draft
        });
    };

    handleClearTabs = () => {
        store.dispatch(
            UI.reduxSlice.actions.clearTabs({
                alias: this.alias,
            })
        );
    };

    handleCancelDownloadClick = () => {
        this.isDownloadCanceled = true;
    };

    executeSave = e => {
        e.stopPropagation();
        const { ui } = store.getState();
        const file = ui.currentTab.fileId
            ? SELECTORS.queryFiles.selectById(store.getState(), lowerCaseKey(ui.currentTab.fileId))
            : null;
        if (isNotUndefinedOrNull(file)) {
            // Existing file
            store.dispatch(async (dispatch, getState) => {
                await dispatch(
                    DOCUMENT.reduxSlices.QUERYFILE.actions.upsertOne({
                        ...file,
                        content: this.soql,
                    })
                );
                await dispatch(
                    UI.reduxSlice.actions.linkFileToTab({
                        fileId: file.id,
                        alias: file.alias,
                        queryFiles: getState().queryFiles,
                    })
                );
            });
        } else {
            // New File
            this.handleSaveClick();
        }
    };

    handleRowSelection = e => {
        const { rows, isChildTable } = e.detail;
        if (isChildTable) {
            this.selectedChildRecords = rows;
        } else {
            this.selectedRecords = rows;
        }
    };

    deleteSelectedRecords = async e => {
        const { describe, ui } = store.getState();
        const customMessages = [];
        let _sobject, _sobjectChild;
        if (this.selectedRecords.length > 0) {
            const _item = this.selectedRecords[0];
            // Verify if the Id is included
            if (isUndefinedOrNull(_item.Id)) {
                Toast.show({
                    label: 'Error during deletion',
                    message: 'You need to provide the Record Id',
                    variant: 'error',
                    mode: 'sticky',
                });
                return;
            }
            _sobject = describe.prefixMap[_item.Id.substr(0, 3)];
            if (_sobject) {
                customMessages.push(
                    `${this.selectedRecords.length} ${
                        this.selectedRecords.length == 1 ? _sobject.label : _sobject.labelPlural
                    }`
                );
            }
        }
        /*if(this.selectedChildRecords.length > 0){
            const _item = this.selectedChildRecords[0];
            _sobjectChild = describe.prefixMap[_item.Id.substr(0,3)];
            if(_sobjectChild){
                customMessages.push(`${this.selectedChildRecords.length} ${this.selectedChildRecords.length == 1 ? _sobjectChild.label:_sobjectChild.labelPlural}`)
            }
        }*/
        const params = {
            variant: 'header',
            theme: 'error',
            message: `Are you sure you want to delete the selected records (${customMessages.join(
                ' & '
            )})? This action cannot be undone.`,
            label: 'Confirm Deletion',
        };
        if (!(await LightningConfirm.open(params))) return;
        store.dispatch(APPLICATION.reduxSlice.actions.startLoading());

        // Child
        //const retChild  = await this.deleteRecords(_sobjectChild,this.selectedChildRecords) || [];
        // Parent
        const retParent = (await this.deleteRecords(_sobject, this.selectedRecords)) || [];
        const deletedRecordIds = new Set();
        const errorMessages = [];
        for (const ret of [...retParent]) {
            // ...retChild,
            if (ret.success) {
                console.log(`Deleted Successfully : ${ret.id}`);
                deletedRecordIds.add(ret.id);
            } else {
                errorMessages.push(
                    ret.errors.length > 0
                        ? ret.errors[0].content
                        : 'Undefined error, please try again.'
                );
            }
        }
        // Error
        if (errorMessages.length > 0) {
            Toast.show({
                label: 'Error during deletion',
                message: errorMessages[0],
                variant: 'error',
                mode: 'sticky',
            });
        }
        // Success
        if (deletedRecordIds.size > 0) {
            Toast.show({
                label: 'Successfull Deletion',
                message: `${deletedRecordIds.size} record(s) were deleted successfully.`,
                variant: 'success',
                mode: 'dismissible',
            });
        }
        store.dispatch(
            QUERY.reduxSlice.actions.deleteRecords({
                deletedRecordIds: [...deletedRecordIds],
                tabId: ui.currentTab.id,
            })
        );
        store.dispatch(APPLICATION.reduxSlice.actions.stopLoading());
    };

    /** Copy & Download */

    copyCSV = async e => {
        this.isDownloading = true;
        this.isDownloadCanceled = false;
        try {
            const data = await this.generateCsv();
            navigator.clipboard.writeText(data);
            Toast.show({
                label: `CSV exported to your clipboard`,
                variant: 'success',
            });
        } catch (e) {
            console.error(e);
            Toast.show({
                label: this.i18n.OUTPUT_PANEL_FAILED_EXPORT_CSV,
                errors: e,
                variant: 'error',
                mode: 'dismissible',
            });
        }
        this.isDownloading = false;
    };

    copyExcel = async e => {
        this.isDownloading = true;
        this.isDownloadCanceled = false;
        try {
            const data = await this.generateCsv('\t');
            navigator.clipboard.writeText(data);
            Toast.show({
                label: `Excel exported to your clipboard`,
                variant: 'success',
            });
            this.isDownloading = false;
        } catch (e) {
            console.error(e);
            Toast.show({
                label: this.i18n.OUTPUT_PANEL_FAILED_EXPORT_EXCEL,
                errors: e,
                variant: 'error',
                mode: 'dismissible',
            });
        }
    };

    copyJSON = async e => {
        this.isDownloading = true;
        this.isDownloadCanceled = false;
        try {
            await this._fetchSubsequentRecords(this._responseNextRecordsUrl);
            navigator.clipboard.writeText(JSON.stringify(this._responseRows, null, 4));
            Toast.show({
                label: `JSON exported to your clipboard`,
                variant: 'success',
            });
        } catch (e) {
            console.error(e);
            Toast.show({
                label: this.i18n.OUTPUT_PANEL_FAILED_EXPORT_JSON,
                errors: e,
                variant: 'error',
                mode: 'dismissible',
            });
        }
        this.isDownloading = false;
    };

    downloadCSV = async e => {
        this.isDownloading = true;
        this.isDownloadCanceled = false;
        try {
            const data = await this.generateCsv(',');
            const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
            const blob = new Blob([bom, data], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const download = document.createElement('a');
            download.href = window.URL.createObjectURL(blob);
            download.download = `${this.sobjectPlurialLabel}.csv`;
            download.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            Toast.show({
                label: this.i18n.OUTPUT_PANEL_FAILED_EXPORT_CSV,
                errors: e,
                variant: 'error',
                mode: 'dismissible',
            });
        }
        this.isDownloading = false;
    };

    downloadJSON = async e => {
        this.isDownloading = true;
        this.isDownloadCanceled = false;
        try {
            await this._fetchSubsequentRecords(this._responseNextRecordsUrl);
            const blob = new Blob([JSON.stringify(this._responseRows, null, 4)], {
                type: 'application/json',
            });
            const url = URL.createObjectURL(blob);
            const download = document.createElement('a');
            download.href = window.URL.createObjectURL(blob);
            download.download = `${this.sobjectPlurialLabel}.json`;
            download.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            Toast.show({
                label: this.i18n.OUTPUT_PANEL_FAILED_EXPORT_JSON,
                errors: e,
                variant: 'error',
                mode: 'dismissible',
            });
        }
        this.isDownloading = false;
    };

    async generateCsv(separator) {
        await this._fetchSubsequentRecords(this._responseNextRecordsUrl);
        const header = this.refs.output.columns.join(separator);
        const data = this._responseRows
            .map(row => {
                return this.refs.output.columns
                    .map(column => {
                        const value = getFieldValue(column, row);
                        const processedValue = isObject(value)
                            ? JSON.stringify(value.records)
                            : value;
                        return escapeCsvValue(separator, processedValue);
                    })
                    .join(separator);
            })
            .join('\n');
        return `${header}\n${data}`;
    }

    async _fetchNextRecords(nextRecordsUrl) {
        if (!nextRecordsUrl) return;
        const res = await this.connector.conn.request({
            method: 'GET',
            url: nextRecordsUrl,
            //headers: salesforce.getQueryHeaders()
        });
        this._responseNextRecordsUrl = res.nextRecordsUrl;
        this._responseRows = [...this._responseRows, ...res.records];
    }

    async _fetchSubsequentRecords(nextRecordsUrl) {
        await this._fetchNextRecords(nextRecordsUrl);
        if (this._responseNextRecordsUrl && !this.isDownloadCanceled) {
            await this._fetchSubsequentRecords(this._responseNextRecordsUrl);
        }
    }

    /** Storage Files  **/

    handleSelectItem = e => {
        e.stopPropagation();
        const { ui, queryFiles } = store.getState();
        const { id, content, category, extra } = e.detail;
        // Check if tab is already open with
        if (category === CATEGORY_STORAGE.SAVED) {
            // Check if tab is already open or create new one

            const tabs = ui.tabs;
            const existingTab = tabs.find(x => compareString(x.fileId, id));
            if (existingTab) {
                // Existing tab
                store.dispatch(UI.reduxSlice.actions.selectionTab(existingTab));
            } else {
                store.dispatch(
                    UI.reduxSlice.actions.addTab({
                        tab: {
                            id: guid(),
                            body: content,
                            fileId: id,
                        },
                        queryFiles,
                    })
                );
            }
        } else if (category === CATEGORY_STORAGE.RECENT) {
            // Open in existing tab
            if (ui.currentTab.fileId) {
                store.dispatch(
                    UI.reduxSlice.actions.addTab({
                        tab: {
                            id: guid(),
                            body: content,
                        },
                    })
                );
            } else {
                store.dispatch(
                    UI.reduxSlice.actions.updateSoql({
                        connector: this.connector,
                        soql: content,
                    })
                );
            }
        } else {
            console.warn(`${category} not supported !`);
        }
    };

    handleRemoveItem = e => {
        e.stopPropagation();
        const { id } = e.detail;
        store.dispatch(DOCUMENT.reduxSlices.QUERYFILE.actions.removeOne(id));
    };

    handleTableSearchChange = (event) => {
        store.dispatch(
            UI.reduxSlice.actions.updateTabTableSearch({ value: event.target.value })
        );
    };

    /** Getters **/

    get isLoadingAdvanced() {
        return this.isLoading || this.isDownloading;
    }

    get loadingMessage() {
        // this._responseRows
        return this.isDownloading
            ? `Preparing the file. Might take a few seconds. ${this.currentRecordsFormatted}/${this.totalRecordsFormatted} records.`
            : 'Loading';
    }

    get pageClass() {
        //Overwrite
        return super.pageClass + ' slds-p-around_small';
    }

    get sobjectsPanelClass() {
        return this.selectedSObject ? 'slds-hide' : '';
    }

    get isRunButtonDisplayed() {
        return !this._displayStopButton;
    }

    get isRunButtonDisabled() {
        return this.isLoading || isEmpty(this.soql);
    }

    get isSaveButtonDisabled() {
        return this.isLoading || isEmpty(this.soql);
    }

    get isFieldsPanelDisplayed() {
        return isNotUndefinedOrNull(this.selectedSObject);
    }

    get toggleLeftIconName() {
        return this.isLeftToggled ? 'utility:toggle_panel_right' : 'utility:toggle_panel_left';
    }

    get toggleRecentVariant() {
        return this.isRecentToggled ? 'brand' : 'bare';
    }

    get isMetaDisplayed() {
        return isNotUndefinedOrNull(this._response);
    }

    get totalRecords() {
        return this._response?.totalSize || 0;
    }

    get currentRecordsFormatted() {
        return shortFormatter.format(this._responseRows?.length || 0);
    }

    get totalRecordsFormatted() {
        return shortFormatter.format(this.totalRecords);
    }

    get sobjectPlurialLabel() {
        return this._sobject?.labelPlural;
    }

    get isDownloadDisabled() {
        return isUndefinedOrNull(this._response);
    }

    get isDeleteDisabled() {
        return this.selectedRecords.length == 0 && this.selectedChildRecords.length == 0;
    }

    get currentTabTableSearch() {
        const { ui } = store.getState();
        return ui.currentTab?.tableSearch || '';
    }
}
