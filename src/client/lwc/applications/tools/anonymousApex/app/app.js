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
import {
    store,
    connectStore,
    SELECTORS,
    DESCRIBE,
    UI,
    APEX,
    DOCUMENT,
    APPLICATION,
} from 'core/store';
import { CATEGORY_STORAGE } from 'builder/storagePanel';
import SaveModal from 'builder/saveModal';
import moment from 'moment';
import LightningConfirm from 'lightning/confirm';
import Analytics from 'shared/analytics';

export default class App extends ToolkitElement {
    _hasRendered = false;
    isLoading = false;
    _loadingMessage;
    isFilterUserDebugEnabled = false;

    isRecentToggled = false;
    recentApexItems = [];
    savedApexItems = [];

    // Error
    error_title;
    error_message;
    hasEditorError = false;

    // Current
    apexScript; // ='CCR_TaskNotification__e event = new CCR_TaskNotification__e();\n// Publish the event\nDatabase.SaveResult result = EventBus.publish(event);';
    _response;
    _responseCreatedDate;
    _responseCreatedDateFormatted;

    // Changes
    currentFile;
    isDraft = false;

    // Models
    _body = "System.debug('Hello the world');";
    currentModel;
    currentLogModel;

    // Tabs
    @track tabs = [];
    currentTab;

    // Debug
    isDebugLogToggle = false;
    _log;
    _cacheFiles = [];

    isApexRunning = false;

    // Interval
    _headerInterval;
    _loadingInterval;

    get body() {
        return this._body;
    }

    set body(value) {
        if (this._hasRendered) {
            const inputEl = this.refs?.editor?.currentModel;
            if (inputEl && this._body != value) {
                inputEl.setValue(isUndefinedOrNull(value) ? '' : value);
            }
        }
        this._body = value;
    }

    get log() {
        return this._log;
    }

    set log(value) {
        if (this._hasRendered) {
            const inputEl = this.refs?.apexLog?.currentModel;
            if (inputEl && this._log != value) {
                inputEl.setValue(isUndefinedOrNull(value) ? '' : value);
            }
        }
        this._log = value;
    }

    connectedCallback() {
        Analytics.trackAppOpen('anonymousApex', { alias: this.alias });
        this.isLoading = true;
        store.dispatch(async (dispatch, getState) => {
            await dispatch(
                APEX.reduxSlice.actions.loadCacheSettings({
                    alias: this.alias,
                    apexFiles: getState().apexFiles,
                })
            );
            await dispatch(
                DOCUMENT.reduxSlices.APEXFILE.actions.loadFromStorage({
                    alias: this.alias,
                })
            );
            await dispatch(
                APEX.reduxSlice.actions.initTabs({
                    apexFiles: getState().apexFiles,
                })
            );
        });
        this.header_enableAutoDate();
    }

    renderedCallback() {
        this._hasRendered = true;
        if (this.refs.apexTab) {
            this.refs.apexTab.activeTabValue = this.currentTab?.id;
        }
    }

    disconnectedCallback() {
        clearInterval(this._headerInterval);
    }

    @wire(connectStore, { store })
    storeChange({ apex, recents, apexFiles, application }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if (!isCurrentApp) return;

        this.isFilterUserDebugEnabled = apex.isFilterDebugEnabled;
        this.isRecentToggled = apex.recentPanelToggled;
        this.tabs = apex.tabs;
        if (this.currentTab?.id != apex.currentTab?.id) {
            this.currentTab = apex.currentTab;
            if (this._hasRendered) {
                this.refs?.editor?.resetPromptWidget();
            }
        }

        if (apex.currentTab && this._hasRendered) {
            //this.currentTab = apex.currentTab;
            if (this.currentTab.fileId != this.currentFile?.id) {
                this.currentFile = SELECTORS.apexFiles.selectById(
                    { apexFiles },
                    lowerCaseKey(this.currentTab.fileId)
                );
            }
        }

        // Body
        if (this.body != apex.body) {
            this.body = apex.body;
        }

        // Apex State
        const apexState = SELECTORS.apex.selectById({ apex }, lowerCaseKey(apex.currentTab?.id));
        if (apexState) {
            this.isApexRunning = apexState.isFetching;
            if (this.isApexRunning) {
                this.loading_enableAutoDate(apexState.createdDate);
            } else {
                if (this._loadingInterval) clearInterval(this._loadingInterval);
            }

            if (apexState.error) {
                //this._abortingMap[apex.currentTab.id] = null; // Reset the abortingMap
                this.resetResponse();
                this.global_handleError(apexState.error);
            } else if (apexState.data) {
                // Reset First
                this.resetError();
                this.resetEditorError();
                // Assign Data
                this._response = apexState.data;
                this._responseCreatedDate = apexState.createdDate;
                //this._abortingMap[apex.currentTab.id] = null; // Reset the abortingMap`
                // Update log
                this.log = this.formatFilterLog(this._response?.debugLog || '');
                this.header_formatDate();
                // Handle Error from Salesforce
                //console.log('this.handleError',!apexState.data.success && !apexState.data.compiled)
                if (!apexState.data.success /**&& apexState.data.compiled**/) {
                    this.handleError(apexState.data);
                }
            } else if (apexState.isFetching) {
                this.resetResponse();
                this.resetError();
                this.resetEditorError();
            }
        } else {
            this.resetResponse();
            this.resetError();
            this.resetEditorError();
            this.isLoading = false;
            if (this._loadingInterval) clearInterval(this._loadingInterval);
        }

        // Recent Apex
        if (recents && recents.apex) {
            this.recentApexItems = recents.apex.map((body, index) => {
                return { id: `${index}`, content: body };
            });
        }

        /** Saved Apex */
        if (apexFiles) {
            const entities = SELECTORS.apexFiles.selectAll({ apexFiles });
            this.savedApexItems = entities
                .filter(item => item.isGlobal || item.alias == this.alias)
                .map((item, index) => {
                    return item; // no mutation for now
                });
        }
    }

    /** Methods  **/

    header_formatDate = () => {
        this._responseCreatedDateFormatted = this._responseCreatedDate
            ? moment(this._responseCreatedDate).fromNow()
            : null;
    };

    header_enableAutoDate = () => {
        this.header_formatDate();
        this._headerInterval = setInterval(() => {
            this.header_formatDate();
        }, 30000);
    };

    loading_formatDate = createdDate => {
        //console.log('formatDate');
        this._loadingMessage = `Running for ${moment().diff(
            moment(createdDate),
            'seconds'
        )} seconds`;
    };

    loading_enableAutoDate = createdDate => {
        if (this._loadingInterval) clearInterval(this._loadingInterval);
        this.loading_formatDate(createdDate);
        this._loadingInterval = setInterval(() => {
            this.loading_formatDate(createdDate);
        }, 1000);
    };

    resetResponse = () => {
        this._response = null;
        this._responseCreatedDate = null;
        this.log = null;
    };

    /** Events **/

    handleBodyChange = e => {
        //this.storeToCache();
        runActionAfterTimeOut(
            e,
            async lastEvent => {
                const { value } = lastEvent.detail;
                const _newDraft = (this.currentFile && this.currentFile.content != value) === true; // enforce boolean
                if (this._body !== value || this.draft != _newDraft) {
                    this._body = value;
                    this.draft = _newDraft;
                    store.dispatch(
                        APEX.reduxSlice.actions.updateBody({
                            connector: this.connector,
                            body: value,
                            isDraft: _newDraft,
                        })
                    );
                    // Reset Error
                    if (isNotUndefinedOrNull(this.hasEditorError)) {
                        this.resetEditorError();
                    }
                }
            },
            { timeout: 20, key: 'anonymousApex.app.handleBodyChange' }
        );
    };

    /*handleAddTab = (e) => {
        this.refs.editor.addFiles([this.generateEmptyFile()]);
    }*/

    debug_handleChange = e => {
        //this.debug[e.currentTarget.dataset.key] = e.detail.value;
        //let key = `${this.connector.configuration.alias}-debuglog`;
        //window.defaultStore.setItem(key,JSON.stringify(this.debug));
        store.dispatch(
            APEX.reduxSlice.actions.updateDebug({
                key: e.currentTarget.dataset.key,
                value: e.detail.value,
                alias: this.alias,
            })
        );
    };

    toggle_debugLog = () => {
        this.isDebugLogToggle = !this.isDebugLogToggle;
    };

    toggle_filterUserDebug = e => {
        store.dispatch(
            APEX.reduxSlice.actions.updateFilterDebug({
                value: !this.isFilterUserDebugEnabled,
                alias: this.alias,
            })
        );
    };

    handleMonacoLoaded = e => {
        this.isLoading = false;
        this.currentModel = this.refs.editor.createModel({
            body: this.body,
            language: 'apex',
        });
        this.refs.editor.displayModel(this.currentModel);
    };

    handleLogLoaded = e => {
        this.currentLogModel = this.refs.apexLog.createModel({
            body: this.log,
            language: 'apexLog',
        });
        this.refs.apexLog.displayModel(this.currentLogModel);
    };

    handleAbort = () => {
        const { ui } = store.getState();
        const apexPromise = store.getState().apex.abortingMap[ui.currentTab.id];
        if (apexPromise) {
            apexPromise.abort();
        }
    };

    executeSave = () => {
        //console.log('---> executeSave');
        const { apex } = store.getState();
        const file = apex.currentTab.fileId
            ? SELECTORS.apexFiles.selectById(store.getState(), lowerCaseKey(apex.currentTab.fileId))
            : null;

        if (isNotUndefinedOrNull(file)) {
            // Existing file
            store.dispatch(async (dispatch, getState) => {
                await dispatch(
                    DOCUMENT.reduxSlices.APEXFILE.actions.upsertOne({
                        ...file,
                        content: this.body,
                    })
                );
                await dispatch(
                    APEX.reduxSlice.actions.linkFileToTab({
                        fileId: file.id,
                        alias: this.alias,
                        apexFiles: getState().apexFiles,
                    })
                );
            });
        } else {
            // Create new file
            SaveModal.open({
                title: 'Save Apex Script',
                _file: file,
            }).then(async data => {
                //console.log('Save Apex Script', data);
                if (isUndefinedOrNull(data)) return;

                const { name, isGlobal } = data;
                store.dispatch(async (dispatch, getState) => {
                    await dispatch(
                        DOCUMENT.reduxSlices.APEXFILE.actions.upsertOne({
                            id: name, // generic
                            isGlobal, // generic
                            content: this.body,
                            alias: this.alias,
                            extra: {
                                //useToolingApi:this._useToolingApi === true, // Needed for queries
                            },
                        })
                    );
                    await dispatch(
                        APEX.reduxSlice.actions.linkFileToTab({
                            fileId: name,
                            alias: this.alias,
                            apexFiles: getState().apexFiles,
                        })
                    );
                });
                // Reset draft
            });
        }
    };

    // Execute Action : Execute Apex script
    executeAction = async e => {
        this.isApexRunning = true;
        try {
            const bodyLength = this.refs?.editor?.currentModel?.getValue()?.length || 0;
            Analytics.trackAction('anonymousApex', 'execute', { alias: this.alias, body_length: bodyLength });
        } catch (e) {
            // ignore analytics errors
        }
        // Execute
        const apexPromise = store.dispatch(
            APEX.executeApexAnonymous({
                connector: this.connector,
                body: this.refs.editor.currentModel.getValue(),
                tabId: this.currentTab.id,
                createdDate: Date.now(),
            })
        );

        store.dispatch(
            APEX.reduxSlice.actions.setAbortingPromise({
                tabId: this.currentTab.id,
                promise: apexPromise,
            })
        );
    };

    /** Methods  **/

    formatFilterLog = log => {
        return splitTextByTimestamp(log)
            .filter(x => this.filterLog(x))
            .join('\n');
    };

    generateEmptyFile = () => {
        const _uid = guid();
        return {
            id: _uid,
            path: _uid,
            name: 'Script',
            apiVersion: 60,
            body: `System.debug('Hello the world');`,
            language: 'apex',
        };
    };

    initEditor = () => {
        //console.log('initEditor');
        // Load from cache
        const initFiles = this._cacheFiles || [];
        if (initFiles.length == 0) {
            initFiles.push(this.generateEmptyFile());
        }
        // init by default
        this.refs.editor.displayFiles('ApexClass', initFiles);
    };

    filterLog = item => {
        return (
            item.startsWith('Execute Anonymous') ||
            (this.isFilterUserDebugEnabled && item.includes('|USER_DEBUG|')) ||
            !this.isFilterUserDebugEnabled
        ); // User Debug Filter
    };

    /** Errors */

    global_handleError = e => {
        let errors = e.message.split(':');
        if (errors.length > 1) {
            this.error_title = errors.shift();
        } else {
            this.error_title = 'Error';
        }
        this.error_message = errors.join(':');
    };

    handleError = data => {
        if (!this.refs.editor) return;

        const _model = this.refs.editor.currentModel;
        this.hasEditorError = true;
        this.refs.editor.resetMarkers();
        if (data.line) {
            try {
                this.refs.editor.addMarkers([
                    {
                        startLineNumber: data.line,
                        endLineNumber: data.line,
                        startColumn: 1,
                        endColumn: _model.getLineLength(data.line),
                        message: data.compileProblem,
                        severity: this.refs.editor.currentMonaco.MarkerSeverity.Error,
                    },
                ]);
            } catch (e) {
                console.error(e);
            }
        }

        this.error_title = data.exceptionMessage ? 'Exception Error' : 'Compilation Error';
        this.error_message = data.exceptionMessage
            ? `${data.exceptionMessage} | ${data.exceptionStackTrace}`
            : data.compileProblem;
    };

    resetEditorError = () => {
        if (this.hasEditorError && this._hasRendered && this.refs.editor) {
            //console.log('clear Error');
            this.refs.editor.resetMarkers();
            this.hasEditorError = false;
        }
    };

    resetError = () => {
        this.error_title = null;
        this.error_message = null;
    };

    /** Storage Files */

    handleRecentToggle = () => {
        store.dispatch(
            APEX.reduxSlice.actions.updateRecentPanel({
                value: !this.isRecentToggled,
                alias: this.alias,
            })
        );
    };

    handleSelectItem = e => {
        e.stopPropagation();
        const { apex, apexFiles } = store.getState();
        const { id, content, category, extra } = e.detail;
        // Check if tab is already open with
        if (category === CATEGORY_STORAGE.SAVED) {
            // Check if tab is already open or create new one

            const tabs = apex.tabs;
            const existingTab = tabs.find(x => compareString(x.fileId, id));
            if (existingTab) {
                // Existing tab
                store.dispatch(APEX.reduxSlice.actions.selectionTab(existingTab));
            } else {
                store.dispatch(
                    APEX.reduxSlice.actions.addTab({
                        tab: {
                            id: guid(),
                            body: content,
                            fileId: id,
                        },
                        apexFiles,
                    })
                );
            }
        } else if (category === CATEGORY_STORAGE.RECENT) {
            // Open in existing tab
            if (apex.currentTab.fileId) {
                store.dispatch(
                    APEX.reduxSlice.actions.addTab({
                        tab: {
                            id: guid(),
                            body: content,
                        },
                    })
                );
            } else {
                store.dispatch(
                    APEX.reduxSlice.actions.updateBody({
                        connector: this.connector,
                        body: content,
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
        store.dispatch(DOCUMENT.reduxSlices.APEXFILE.actions.removeOne(id));
    };

    /** Tabs */

    handleAddTab = e => {
        store.dispatch(
            APEX.reduxSlice.actions.addTab({
                tab: {
                    id: guid(),
                    body: "System.debug('Hello the world');",
                },
            })
        );
    };

    handleSelectTab = e => {
        const tabId = e.target.value;
        store.dispatch(APEX.reduxSlice.actions.selectionTab({ id: tabId, alias: this.alias }));
    };

    handleCloseTab = async e => {
        const tabId = e.detail.value;
        const currentTab = this.tabs.find(x => x.id === tabId);
        const params = {
            variant: 'headerless',
            message: 'This script has unsaved changes ! Do you want delete it ?',
        };
        if (
            !currentTab.isDraft ||
            (currentTab.isDraft && isUndefinedOrNull(currentTab.fileId)) ||
            (currentTab.isDraft && (await LightningConfirm.open(params)))
        ) {
            store.dispatch(APEX.reduxSlice.actions.removeTab({ id: tabId, alias: this.alias }));
        }
    };

    /** Getters */

    get pageClass() {
        //Overwrite
        return super.pageClass + ' slds-p-around_small';
    }

    get hasError() {
        return isNotUndefinedOrNull(this.error_message);
    }

    get isExecuteButtonDisplayed() {
        return !this.isApexRunning;
    }

    get isExecuteButtonDisabled() {
        return isEmpty(this.body);
    }

    get isLogDisplayed() {
        return isNotUndefinedOrNull(this._response); //return !isEmpty(this.log);
    }

    get isMetaDisplayed() {
        return isNotUndefinedOrNull(this._response);
    }

    get debug_db() {
        return store.getState().apex?.debug_db;
    }

    get debug_callout() {
        return store.getState().apex?.debug_callout;
    }

    get debug_apexCode() {
        return store.getState().apex?.debug_apexCode;
    }

    get debug_validation() {
        return store.getState().apex?.debug_validation;
    }

    get debug_profiling() {
        return store.getState().apex?.debug_profiling;
    }

    get debug_system() {
        return store.getState().apex?.debug_system;
    }

    get debug_db_options() {
        return [
            { value: 'NONE', label: 'None' },
            { value: 'INFO', label: 'Info' },
            { value: 'FINEST', label: 'Finest' },
        ];
    }

    get debug_apexCode_options() {
        return [
            { value: 'NONE', label: 'None' },
            { value: 'ERROR', label: 'Error' },
            { value: 'WARN', label: 'Warn' },
            { value: 'INFO', label: 'Info' },
            { value: 'DEBUG', label: 'Debug' },
            { value: 'FINE', label: 'Fine' },
            { value: 'FINER', label: 'Finer' },
            { value: 'FINEST', label: 'Finest' },
        ];
    }

    get debug_validation_options() {
        return [
            { value: 'NONE', label: 'None' },
            { value: 'INFO', label: 'Info' },
        ];
    }

    get debug_callout_options() {
        return [
            { value: 'NONE', label: 'None' },
            { value: 'INFO', label: 'Info' },
            { value: 'FINEST', label: 'Finest' },
        ];
    }

    get debug_profiling_options() {
        return [
            { value: 'NONE', label: 'None' },
            { value: 'INFO', label: 'Info' },
            { value: 'FINE', label: 'Fine' },
            { value: 'FINEST', label: 'Finest' },
        ];
    }

    get debug_system_options() {
        return [
            { value: 'NONE', label: 'None' },
            { value: 'INFO', label: 'Info' },
            { value: 'DEBUG', label: 'Debug' },
            { value: 'FINE', label: 'Fine' },
        ];
    }

    get formattedTabs() {
        return this.tabs.map((x, index) => {
            return {
                ...x,
                name: x.fileId || `Script ${index + 1}`,
                isCloseable: this.tabs.length > 1,
                class: classSet('slds-tabs_scoped__item')
                    .add({ 'slds-is-active': x.path === this.currentFile })
                    .toString(),
            };
        });
    }

    get rightSlotClass() {
        return classSet('slds-full-height slds-full-width slds-flex-column')
            .add({
                'apex-illustration': !this.isLogDisplayed,
            })
            .toString();
    }
}
