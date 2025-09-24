import { api, track, wire } from 'lwc';
import {
    guid,
    runActionAfterTimeOut,
    lowerCaseKey,
    compareString,
    isEmpty,
    isNotUndefinedOrNull,
    isUndefinedOrNull,
    classSet,
    normalizeString as normalize,
    prettifyXml,
    autoDetectAndFormat
} from 'shared/utils';
import Toast from 'lightning/toast';
import ToolkitElement from 'core/toolkitElement';
import { connectStore, store, API, DOCUMENT, SELECTORS } from 'core/store';
import { CATEGORY_STORAGE } from 'builder/storagePanel';
import {
    DEFAULT,
    VIEWERS,
    METHOD,
    TABS,
    generateDefaultTab,
    formattedContentType,
    formatApiRequest
} from 'api/utils';
import SaveModal from 'builder/saveModal';
import moment from 'moment';
import LightningConfirm from 'lightning/confirm';
import LOGGER from 'shared/logger';
import ApiSchemaImportModal from 'api/apiSchemaImportModal';
import yaml from 'js-yaml';
import { dereference, validate } from 'imported/openapi-parser';
import * as OpenAPISampler from 'openapi-sampler';
import { NavigationContext, navigate } from 'lwr/navigation';
import { CACHE_CONFIG, cacheManager } from 'shared/cacheManager';
import Analytics from 'shared/analytics';

// Utility: Convert OpenAPI schema to apiTreeItems
function openApiToApiTreeItems(openApi) {
    if (!openApi.paths) return [];
    // Helper to insert a path into the tree
    function insertPath(tree, path, pathItem) {
        const segments = path.split('/').filter(Boolean); // remove empty
        let current = tree;
        let fullPath = '';
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            fullPath += '/' + segment;
            let node = current.children.find(child => child.id === fullPath && child.type === 'folder');
            if (!node) {
                node = {
                    id: fullPath,
                    name: segment,
                    title: fullPath,
                    type: 'folder',
                    children: [],
                    extra: i === segments.length - 1 ? pathItem : undefined
                };
                current.children.push(node);
            }
            current = node;
        }
        // Add method nodes as children of the last segment
        Object.entries(pathItem).forEach(([method, operation]) => {
            if (['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'].includes(method)) {
                current.children.push({
                    id: `${path}:${method}`,
                    name: method.toUpperCase(),
                    title: `${path}:${method}`,
                    icon: `api:${method}`,
                    type: 'method',
                    extra: {
                        ...operation,
                        path,
                        method,
                        pathItem,
                    }
                });
            }
        });
    }
    // Root node with API title and servers
    const name = openApi?.info?.title;
    const root = {
        id: (name ? name : guid()).toLowerCase(), // Important to lowercase for Redux !!!!!!
        name: name ? name : 'API',
        type: 'root',
        children: [],
        extra: {
            ...openApi.info,
            servers: openApi.servers || []
        }
    };
    Object.entries(openApi.paths).forEach(([path, pathItem]) => {
        insertPath(root, path, pathItem);
    });
    return [root];
}

export default class App extends ToolkitElement {
    @wire(NavigationContext)
    navContext;

    isLoading = false;
    isDownloading = false;

    @track formattedRequests = [];
    @track endpoint;
    @track method;
    @track variables;
    @api header;
    @api body;

    // Undo/Redo
    @track actions = [];
    actionPointer = 0;
    isEditing = false;

    currentModel;
    responseModel;
    variablesModel;

    // Aborting
    // _abortingMap is now managed in the Redux store
    isApiRunning = false;

    // Changes
    currentFile;
    isDraft = false;

    // Recent & Saved
    @track isRecentToggled = false;
    recentApiItems = [];
    savedApiItems = [];

    // API Tree
    @track isApiTreeToggled = false;
    @track apiTreeItems = [];

    // Content
    @track content;
    @track contentLength;
    @track contentType = 'json';
    @track contentHeaders = [];
    @track statusCode;
    @track executionStartDate;
    @track executionEndDate;
    @track executedFormattedRequest;

    // Viewer
    viewer_value = VIEWERS.PRETTY;
    

    // Tabs
    @track tabs = [];
    currentTab;

    // Viewer Tab
    tab_current = TABS.BODY;
    // request tab
    request_tab_current = TABS.BODY;

    // Interval
    _loadingInterval;
    _loadingMessage;

    @track isApiSplitterHorizontal = false;
    @track isSettingsPanelOpen = false;

    _hasRendered = false;

    // Add after class properties
    @track headerRows = [{ id: guid(), key: '', value: '' }];
    @track selectedServerUrl = '';

    // applicationConfig
    @track applicationConfig = {};
    // openapiSchemaFiles
    @track openapiSchemaFiles = [];

    connectedCallback() {
        Analytics.trackAppOpen('api', { alias: this.alias });
        this.isFieldRendered = true;
        store.dispatch(async (dispatch, getState) => {
            this.applicationConfig = await API.loadCacheSettings(this.alias);
            LOGGER.log('cachedConfig', this.applicationConfig);
            this.processCacheSettings(this.applicationConfig);
            // Update current api version
            await dispatch(
                API.reduxSlice.actions.updateCurrentApiVersion({
                    alias: this.alias,
                    version: this.currentApiVersion,
                })
            );

            // Load Files/history from storage (ASYNC, no need to wait)
            dispatch(
                DOCUMENT.reduxSlices.OPENAPI_SCHEMA_FILE.actions.loadFromStorage({
                    alias: this.alias,
                })
            );
            // Load Files/history from storage
            await dispatch(
                DOCUMENT.reduxSlices.APIFILE.actions.loadFromStorage({
                    alias: this.alias,
                })
            );
            // Load REDUX Cache Settings (Used to init the tabs)
            await dispatch(
                API.reduxSlice.actions.loadCacheSettings({
                    cachedConfig: this.applicationConfig,
                    apiFiles: getState().apiFiles,
                })
            );
            await dispatch(
                API.reduxSlice.actions.initTabs({
                    apiFiles: getState().apiFiles,
                })
            );
        });
    }

    renderedCallback() {
        this._hasRendered = true;

        if (this.refs.resultTab) {
            this.refs.resultTab.activeTabValue = this.tab_current;
        }

        if (this.refs.apiRequestTab) {
            this.refs.apiRequestTab.activeTabValue = this.currentTab?.id;
        }

        if (this.refs.requestTab) {
            this.refs.requestTab.activeTabValue = this.request_tab_current;
        }
    }

    @wire(connectStore, { store })
    storeChange({ application, api, recents, apiFiles, openapiSchemaFiles }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if (!isCurrentApp) return;
        this.tab_current = api.viewerTab;
        this.request_tab_current = api.requestTab;
        this.isRecentToggled = api.recentPanelToggled;
        this.tabs = api.tabs;
        this.currentTab = api.currentTab;
        if (api.currentTab && this._hasRendered) {
            if (this.currentTab.fileId != this.currentFile?.id) {
                this.currentFile = SELECTORS.apiFiles.selectById(
                    { apiFiles },
                    lowerCaseKey(this.currentTab.fileId)
                );
            }
        }
        // Variables (now global)
        if (this.variables != api.variables) {
            this.variables = api.variables;
            this.updateVariablesEditor();
        }
        // Variables (Need to handle some exceptions)
        if (this.body != api.body) {
            this.body = api.body;
            this.updateBodyEditor();
        }
        if (this.method != api.method) {
            this.method = api.method;
            if (this._hasRendered) {
                this.refs.method.value = this.method;
            }
        }
        if (this.header != api.header) {
            this.header = api.header || null;
            //this.headerRows = this.parseHeaderStringToRows(this.header);
            if (this._hasRendered) {
                // No textarea to update
            }
        }
        if (this.endpoint != api.endpoint) {
            this.endpoint = api.endpoint;
            if (this._hasRendered) {
                this.refs.url.value = this.endpoint;
            }
        }

        // Actions
        this.actions = api.actions || [];
        this.actionPointer = api.actionPointer || 0;


        // Api State
        const apiState = SELECTORS.api.selectById({ api }, lowerCaseKey(api.currentTab?.id));
        if (apiState) {
            LOGGER.log('App [apiState]', apiState);
            this.isApiRunning = apiState.isFetching;
            if (this.isApiRunning) {
                this.loading_enableAutoDate(apiState.createdDate);
            } else {
                if (this._loadingInterval) clearInterval(this._loadingInterval);
            }
            if (apiState.error) {
                this.resetResponse();
                ////this.global_handleError(apiState.error)
            } else if (apiState.response) {
                // Reset First
                ////this.resetError();
                ////this.resetEditorError();

                // Assign Data
                this.statusCode = apiState.response.statusCode;
                this.contentType = apiState.response.contentType;
                this.contentHeaders = apiState.response.contentHeaders;
                this.contentLength = apiState.response.contentLength;
                this.executionStartDate = apiState.response.executionStartDate;
                this.executionEndDate = apiState.response.executionEndDate;
                this.executedFormattedRequest = apiState.formattedRequest;
                if (this.content != apiState.response.content) {
                    this.content = apiState.response.content;
                    this.updateResponseEditor();
                }
                ////this.header_formatDate();
                // Handle Error from Salesforce
                if (!apiState.response.statusCode <= 400 /**&& apexState.data.compiled**/) {
                    ////this.handleError(apiState.data);
                }
            } else if (apiState.isFetching) {
                this.resetResponse();
                ////this.resetError();
                ////this.resetEditorError();
            }
        } else {
            this.resetResponse();
            ////this.resetError();
            ////this.resetEditorError();
            this.isLoading = false;
            //if(this._loadingInterval) clearInterval(this._loadingInterval);
        }

        // Recent API
        if (recents && recents.api) {
            this.recentApiItems = recents.api.map((item, index) => {
                return {
                    id: `${index}`,
                    content: `${item.method} • ${item.endpoint}`,
                    extra: item, // see if no conflict with the code builder component
                };
            });
        }

        /** OpenAPI Schema Files */
        if (openapiSchemaFiles) {
            this.openapiSchemaFiles = SELECTORS.openapiSchemaFiles.selectAll({ openapiSchemaFiles });
            this.apiTreeItems = [...this.openapiSchemaFiles].map(file => {
                return openApiToApiTreeItems(file.content)[0];
            });
        }

        /** Saved API */
        if (apiFiles) {
            const entities = SELECTORS.apiFiles.selectAll({ apiFiles });
            this.savedApiItems = entities
                .filter(item => item.isGlobal || item.alias == this.alias)
                .map((item, index) => {
                    return item; // no mutation for now
                });
        }
    }

    /** Methods  **/

    formatRequest = () => {
        const {request,error} = formatApiRequest({
            endpoint: this.endpoint,
            method: this.method,
            body: this.body,
            header: this.header,
            variables: this.variables,
            connector: this.connector,
            replaceVariableValues: this.replaceVariableValues,
        });
        if(error){
            Toast.show({
                label: 'Failed to format request',
                message: error,
                errors: error,
            });
        }
        return request;
    }

    // Execute Action - Execute API Call
    executeAction = () => {
        const _originalRequest = this.currentRequestToStore;
        const _formattedRequest = this.formatRequest();
        LOGGER.log('App [executeAction] _formattedRequest', _formattedRequest);
        if(isUndefinedOrNull(_formattedRequest)) return;

        this.isApiRunning = true;
        try {
            Analytics.trackAction('api', 'execute', {
                alias: this.alias,
                method: _formattedRequest?.method || this.method,
                endpoint: _formattedRequest?.url || this.endpoint,
            });
        } catch (e) {
            // ignore analytics errors
        }
        // Execute
        const apiPromise = store.dispatch(
            API.executeApiRequest({
                connector: this.connector,
                request: _originalRequest,
                formattedRequest: _formattedRequest,
                tabId: this.currentTab.id,
                createdDate: Date.now(),
            })
        );
        // TODO : Investigate if this shouldn't be done in the reducer
        store.dispatch(
            API.reduxSlice.actions.setAbortingPromise({
                tabId: this.currentTab.id,
                promise: apiPromise,
            })
        );
    };

    reassignAction = () => {
        LOGGER.log('App [reassignAction]', this.actions);
        const action = this.actions[this.actionPointer];
        if (action) {
            this.body = action.request.body;
            this.method = action.request.method;
            this.endpoint = action.request.endpoint;
            this.header = action.request.header;
            this.statusCode = action.response.statusCode;
            this.contentType = action.response.contentType;
            this.contentHeaders = action.response.contentHeaders;
            this.executionStartDate = action.response.executionStartDate;
            this.executionEndDate = action.response.executionEndDate;
            this.content = action.response.content;
            this.updateResponseEditor();
        } else {
            this.reset_click();
        }

        // Update fields directly (LWC issues)
        this.forceDomUpdate();
    };

    forceDomUpdate = () => {
        LOGGER.log('App [forceDomUpdate]', {
            method: this.method,
            endpoint: this.endpoint,
            header: this.header,
            body: this.body,
        });
        this.refs.method.value = this.method;
        this.refs.url.value = this.endpoint;
        this.refs.bodyEditor.currentModel.setValue(this.body || '');
        this.refs.bodyEditor.currentMonaco.editor.setModelLanguage(
            this.refs.bodyEditor.currentModel,
            autoDetectAndFormat(this.body, this.header) || 'txt'
        );
        if (this.refs.responseEditor) {
            //this.refs.responseEditor.currentModel.setValue(this.content);
        }
    };

    replaceVariableValues = text => {
        if (!text) return text;
        let result = text;
        let variablesObj = {};
        try {
            variablesObj = JSON.parse(this.variables || '{}');
        } catch (e) {
            // If variables is not valid JSON, skip replacement
            variablesObj = {};
        }
        // Replace all {key} from variables
        Object.keys(variablesObj).forEach(key => {
            const value = variablesObj[key];
            const regex = new RegExp(`\\{${key}\\}`, 'g');
            result = result.replace(regex, value);
        });
        // Always replace {sessionId}
        if (this.connector && this.connector.conn && this.connector.conn.accessToken) {
            result = result.replace(/\{sessionId\}/g, this.connector.conn.accessToken);
        }
        return result;
    };

    decreaseActionPointer = () => {
        store.dispatch(
            API.reduxSlice.actions.decreaseActionPointer({
                tabId: this.currentTab?.id,
                alias: this.alias,
            })
        );
    };

    increaseActionPointer = () => {
        store.dispatch(
            API.reduxSlice.actions.increaseActionPointer({
                tabId: this.currentTab?.id,
                alias: this.alias,
            })
        );
    };

    injectHTML = () => {
        const iframe = this.template.querySelector('iframe');
        const iframeDocument = iframe.contentWindow.document;

        // Check if the content type is an image (e.g., PNG or JPG)
        if (['png', 'jpeg', 'jpg'].includes(formattedContentType(this.contentType))) {
        } else {
            // If it's not an image, inject the content as HTML
            iframeDocument.open();
            iframeDocument.write(this.formattedContent);
            iframeDocument.close();
        }
    };

    // API State Processing
    resetResponse = () => {
        this.content = null;
        this.statusCode = null;
        this.contentHeaders = null;
        this.contentType = null;
        this.executionStartDate = null;
        this.executionEndDate = null;
    };

    updateResponseEditor = () => {
        if (
            !this._hasRendered ||
            !this.refs.responseEditor ||
            isUndefinedOrNull(this.responseModel) ||
            isUndefinedOrNull(this.refs.responseEditor.currentModel)
        )
            return;
        this.refs.responseEditor.currentModel.setValue(this.formattedContent);
        this.refs.responseEditor.currentMonaco.editor.setModelLanguage(
            this.refs.responseEditor.currentModel,
            formattedContentType(this.contentType)
        );
    };

    updateBodyEditor = () => {
        if (!this._hasRendered || !this.refs.bodyEditor || !this.refs.bodyEditor.currentModel) return;
        this.refs.bodyEditor.currentModel.setValue(this.body || '');
        this.refs.bodyEditor.currentMonaco.editor.setModelLanguage(
            this.refs.bodyEditor.currentModel,
            autoDetectAndFormat(this.body, this.header) || 'txt'
        );
    };

    updateVariablesEditor = () => {
        if (!this._hasRendered || !this.refs.variablesEditor || !this.refs.variablesEditor.currentModel) return;
        this.refs.variablesEditor.currentModel.setValue(this.variables || '');
        this.refs.variablesEditor.currentMonaco.editor.setModelLanguage(
            this.refs.variablesEditor.currentModel,
            'json'
        );
    };

    // Loading

    loading_formatDate = createdDate => {
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

    /** Events **/

    initBodyEditor = () => {
        const newModel = this.refs.bodyEditor.createModel({
            body: this.body,
            language: autoDetectAndFormat(this.body, this.header) || 'txt', // Language should be improved in the editor
        });
        this.refs.bodyEditor.displayModel(newModel);
    };

    initResponseEditor = () => {
        if (!this._hasRendered || !this.refs.responseEditor) return;
        //this.isLoading = false;
        this.responseModel = this.refs.responseEditor.createModel({
            body: this.formattedContent,
            language: formattedContentType(this.contentType),
        });
        this.refs.responseEditor.displayModel(this.responseModel);
    };

    viewer_handleChange = e => {
        this.viewer_value = e.detail.value;
    };

    viewer_handleSelectTab = event => {
        store.dispatch(
            API.reduxSlice.actions.updateViewerTab({
                value: event.target.value,
                alias: this.alias,
            })
        );
    };


    request_handleSelectTab = event => {
        store.dispatch(
            API.reduxSlice.actions.updateRequestTab({
                value: event.target.value,
                alias: this.alias,
            })
        );
    };

    undo_click = () => {
        if (this.actions.length > 0 && this.actions.length > this.actionPointer) {
            this.decreaseActionPointer();
            this.reassignAction();
        }
    };

    redo_click = () => {
        if (this.actions.length > 0 && this.actions.length - 1 >= this.actionPointer) {
            this.increaseActionPointer();
            this.reassignAction();
        }
    };

    reset_click = e => {
        store.dispatch(
            API.reduxSlice.actions.resetTab({
                tabId: this.currentTab?.id,
                alias: this.alias,
            })
        );
    };

    updateRequestStates = e => {
        const { api } = store.getState();
        runActionAfterTimeOut(
            e,
            async lastEvent => {

                console.log('App [updateRequestStates]', this.variables);
                const _newDraft =
                    (this.currentFile &&
                        (this.currentFile.extra?.body != this.body ||
                            this.currentFile.extra?.method != this.method ||
                            this.currentFile.extra?.endpoint != this.endpoint ||
                            this.currentFile.extra?.header != this.header)) === true; // variables removed from draft check
                if (
                    this.body !== api.body ||
                    this.method !== api.method ||
                    this.endpoint !== api.endpoint ||
                    this.header !== api.header ||
                    this.draft != _newDraft
                ) {
                    this.draft = _newDraft;
                    store.dispatch(
                        API.reduxSlice.actions.updateRequest({
                            ...this.currentRequestToStore,
                            connector: this.connector,
                            tabId: this.currentTab.id,
                            isDraft: _newDraft, // update the draft status
                        })
                    );
                    // Reset Error
                    /*if(isNotUndefinedOrNull(this.hasEditorError)){
                    this.resetEditorError();
                }*/
                }
            },
            { timeout: 500 }
        );
    };

    header_change = e => {
        this.header = e.detail.value;
        //console.log('App [header_change]', this.header);
        this.updateRequestStates(e);
    };

    endpoint_change = e => {
        LOGGER.log('App [endpoint_change]', e.detail.value);
        this.endpoint = e.detail.value;
        this.updateRequestStates(e);
    };

    method_change = e => {
        this.method = e.detail.value;
        this.updateRequestStates(e);
    };

    body_change = e => {
        if (this.body == e.detail.value) return;
        this.body = e.detail.value;
        this.updateRequestStates(e);
    };

    variables_change = e => {
        if (this.variables == e.detail.value) return;
        this.variables = e.detail.value;
        store.dispatch(
            API.reduxSlice.actions.updateVariables({ variables: this.variables })
        );
    };

    handle_customLinkClick = e => {
        // Assuming it's always GET method
        this.endpoint = e.detail.url;
        this.method = METHOD.GET;
        this.body = DEFAULT.BODY; // Reset Body
        //this.header = DEFAULT.HEADER;

        //this.updateRequestStates(e);
        store.dispatch(
            API.reduxSlice.actions.updateRequest({
                ...this.currentRequestToStore,
                connector: this.connector,
                tabId: this.currentTab?.id,
            })
        );
        //this.forceDomUpdate();
        this.executeAction();
    };

    handle_downloadClick = () => {
        this.isDownloading = true;
        try {
            const blob = new Blob([this.formattedContent], { type: this.contentType });
            const url = URL.createObjectURL(blob);
            const download = document.createElement('a');
            download.href = window.URL.createObjectURL(blob);
            download.download = `${Date.now()}.${formattedContentType(this.contentType)}`;
            download.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            Toast.show({
                label: 'Failed Exporting JSON',
                message: 'Failed Exporting JSON',
                errors: e,
                variant: 'error',
            });
        }
        this.isDownloading = false;
    };

    executeSave = () => {

        const { api } = store.getState();
        const file = api.currentTab.fileId
            ? SELECTORS.apiFiles.selectById(store.getState(), lowerCaseKey(api.currentTab.fileId))
            : null;
        SaveModal.open({
            title: 'Save API Request',
            _file: file,
        }).then(async data => {
            if (isUndefinedOrNull(data)) return;
            const item = this.currentRequestToStore;
            const { name, isGlobal } = data;
            store.dispatch(async (dispatch, getState) => {
                await dispatch(
                    DOCUMENT.reduxSlices.APIFILE.actions.upsertOne({
                        id: name, // generic
                        isGlobal, // generic
                        content: null,
                        alias: this.alias,
                        extra: item,
                    })
                );
                const apiFiles = getState().apiFiles;
                await dispatch(
                    API.reduxSlice.actions.linkFileToTab({
                        fileId: name,
                        alias: this.alias,
                        apiFiles,
                    })
                );
            });

            // Reset draft
        });
    };

    handle_apiTreeToggle = () => {
        this.isApiTreeToggled = !this.isApiTreeToggled;
    };

    handle_apiTreeClose = () => {
        this.isApiTreeToggled = false;
    };

    handle_settingsToggle = () => {
        this.isSettingsPanelOpen = !this.isSettingsPanelOpen;
    };

    handleSettingsPanelClose = () => {
        this.isSettingsPanelOpen = false;
    };

    // When loading an OpenAPI item with parameters, generate sample variables
    handle_apiTreeSelect = (event) => {
        const selectedItem = event.detail?.item;
        const extra = selectedItem.extra;
        if (extra) {
            // If this is a method node, open or update a tab
            if (extra.method && extra.path) {
                // Generate sample body if available
                let sampleBody = '';
                if (extra?.requestBody?.content) {
                    const content = extra.requestBody.content['application/json'] || Object.values(extra.requestBody.content)[0];
                    if (content?.schema) {
                        try {
                            const sample = OpenAPISampler.sample(content.schema, { skipReadOnly: true });
                            sampleBody = JSON.stringify(sample, null, 2);
                        } catch (e) {
                            LOGGER.error('openapi-sampler error:', e);
                            sampleBody = JSON.stringify(content.schema, null, 2);
                        }
                    }
                }
                // Generate sample variables from parameters
                let sampleVariables = {};
                const parameters = extra?.pathItem?.parameters || [];
                if (Array.isArray(parameters) && parameters.length > 0) {
                    parameters.forEach(param => {
                        // Use OpenAPISampler if schema exists, else use a placeholder
                        if (param.schema) {
                            try {
                                sampleVariables[param.name] = OpenAPISampler.sample(param.schema, { skipReadOnly: true });
                            } catch (e) {
                                sampleVariables[param.name] = param.schema.example || '';
                            }
                        } else {
                            sampleVariables[param.name] = '';
                        }
                    });
                }
                const variables = JSON.stringify(sampleVariables, null, 2);
                this.initVariablesEditor();
                // Compose full endpoint with base URL
                const baseUrl = this.selectedServerUrl || '';
                const endpoint = baseUrl.replace(/\/$/, '') + '/' + extra.path.replace(/^\//, '');
                const method = extra.method.toUpperCase();
                // Check if a tab already exists for this method+endpoint+server
                const tabId = selectedItem.id?.toLowerCase();
                const existingTab = this.tabs.find(tab => tab.id === tabId);
                if (existingTab) {
                    store.dispatch(API.reduxSlice.actions.selectionTab({id: tabId}));
                } else {
                    // Create a new tab (variables are set globally)
                    const tab = {
                        ...generateDefaultTab(this.currentApiVersion,tabId),
                        method,
                        endpoint,
                        body: sampleBody,
                        serverUrl: baseUrl,
                    };
                    store.dispatch(API.reduxSlice.actions.addTab({ tab }));
                }
                return;
            }
            // Fallback: if not a method node, just update the body as before
            if (extra?.parameters) {
                this.body = JSON.stringify(extra.parameters, null, 2);
                this.updateBodyEditor();
            } else {
                this.body = JSON.stringify(extra, null, 2);
                this.updateBodyEditor();
            }
        }
    };

    handle_apiTreeUpload = async () => {
        const result = await ApiSchemaImportModal.open({
            title: 'Import API Schema',
            value: '',
        });
        if (result && result.value) {
            let parsedSchema;
            let format = 'json';

            LOGGER.log('handle_apiTreeUpload', result.value);
            try {
                // Try JSON first
                try {
                    parsedSchema = JSON.parse(result.value);
                } catch (jsonErr) {
                    // If not JSON, try YAML
                    parsedSchema = yaml.load(result.value);
                    format = 'yaml';
                }
                // Validate and dereference with Scalar OpenAPIParser
                const dereferenced = await dereference(parsedSchema);
                Toast.show({
                    label: 'OpenAPI schema imported and parsed successfully',
                    message: `OpenAPI schema imported and parsed successfully (${format.toUpperCase()})!`,
                    variant: 'success',
                });
                // You can now use 'dereferenced' as the fully parsed OpenAPI spec
                // eslint-disable-next-line no-console
                LOGGER.log('Dereferenced OpenAPI schema:', dereferenced);
                const newOpenApiTreeItems = openApiToApiTreeItems(dereferenced.schema);
                this.apiTreeItems = [...this.apiTreeItems, ...newOpenApiTreeItems];
                const root = newOpenApiTreeItems.find(item => item.type === 'root');
                if(root){
                    LOGGER.log('Saving OpenAPI schema to document', root.id, dereferenced.schema);
                    store.dispatch(
                        DOCUMENT.reduxSlices.OPENAPI_SCHEMA_FILE.actions.upsertOne({
                            id: root.id,
                            content: dereferenced.schema,
                            isGlobal: true,
                        })
                    );
                }

                
            } catch (err) {
                Toast.show({
                    label: 'Failed to parse OpenAPI schema',
                    message: 'Failed to parse OpenAPI schema: ' + (err.message || err),
                    variant: 'error',
                });
                // eslint-disable-next-line no-console
                LOGGER.error('OpenAPI parse error:', err);
            }
        }
    };

    handleServerUrlChange = (event) => {
        this.selectedServerUrl = event.detail.serverUrl;
        // Optionally, update the endpoint or display the full URL somewhere
        // Example: this.fullUrl = this.selectedServerUrl + this.endpoint;
    }



    handleCancelApiRequest = () => {
        // Try to abort the in-flight API request for the current tab
        const { api } = store.getState();
        const tabId = this.currentTab?.id;
        if (!tabId) return;
        const abortingMap = api.abortingMap || {};
        const promise = abortingMap[tabId];
        if (promise && typeof promise.abort === 'function') {
            promise.abort();
        } else if (promise && typeof promise.cancel === 'function') {
            promise.cancel();
        } else {
            Toast.show({
                label: 'Abort not supported',
                message: 'The current API request cannot be aborted.',
                variant: 'warning',
            });
        }
    };

    handleDeleteApiProject = (event) => {
        LOGGER.log('handleDeleteApiProject', event.detail);
        const item = event.detail.item;
        this.apiTreeItems = this.apiTreeItems.filter(x => x.id !== item.id);
        LOGGER.log('this.apiTreeItems', this.apiTreeItems);
        store.dispatch(DOCUMENT.reduxSlices.OPENAPI_SCHEMA_FILE.actions.removeOne(item.id));
    }

    /** Tabs */

    handleAddTab = e => {
        const tab = generateDefaultTab(this.currentApiVersion);
        store.dispatch(API.reduxSlice.actions.addTab({ tab }));
    };

    handleSelectTab = e => {
        const tabId = e.target.value;
        store.dispatch(API.reduxSlice.actions.selectionTab({ id: tabId, alias: this.alias }));
    };

    handleCloseTab = async e => {
        const tabId = e.detail.value;
        const currentTab = this.tabs.find(x => x.id === tabId);
        const params = {
            variant: 'headerless',
            message: 'This request has unsaved changes ! Do you want delete it ?',
        };
        if (
            !currentTab.isDraft ||
            (currentTab.isDraft && isUndefinedOrNull(currentTab.fileId)) ||
            (currentTab.isDraft && (await LightningConfirm.open(params)))
        ) {
            store.dispatch(API.reduxSlice.actions.removeTab({ id: tabId, alias: this.alias }));
        }
    };

    /** Cached Settings */

    settingsInputfieldChange = (e) => {
        const inputField = e.currentTarget;
        const _config = this.applicationConfig;
        if (inputField.type === 'toggle') {
            _config[inputField.dataset.key] = inputField.checked;
        } else {
            _config[inputField.dataset.key] = inputField.value;
        }
        this.applicationConfig = null;
        this.applicationConfig = _config;
        this.processCacheSettings(this.applicationConfig);

        // Save Config
        const configurationList = Object.values(CACHE_CONFIG);
        const config = {};
        const keyList = Object.keys(this.applicationConfig);
        Object.values(configurationList).filter(item => keyList.includes(item.key)).forEach(item => {
            config[item.key] = this.applicationConfig[item.key];
        });
        // Use the new CacheManager to save config
        LOGGER.log('saving config', config);
        cacheManager.saveConfig(config);
    }



    processCacheSettings = (cachedConfig) => {
        this.isApiSplitterHorizontal = cachedConfig[CACHE_CONFIG.API_SPLITTER_IS_HORIZONTAL.key];
    }

    /** Storage Files */

    handleRecentToggle = () => {
        store.dispatch(
            API.reduxSlice.actions.updateRecentPanel({
                value: !this.isRecentToggled,
                alias: this.alias,
            })
        );
    };

    handleSelectItem = e => {
        e.stopPropagation();
        const { api, apiFiles } = store.getState();
        const { id, content, category, extra } = e.detail;
        // Check if tab is already open with
        if (category === CATEGORY_STORAGE.SAVED) {
            // Check if tab is already open or create new one

            const tabs = api.tabs;
            const existingTab = tabs.find(x => compareString(x.fileId, id));
            if (existingTab) {
                // Existing tab
                store.dispatch(API.reduxSlice.actions.selectionTab(existingTab));
            } else {
                const tab = generateDefaultTab(this.currentApiVersion);
                tab.body = extra.body;
                tab.header = extra.header;
                tab.method = extra.method;
                tab.endpoint = extra.endpoint;
                tab.fileId = id;
                store.dispatch(API.reduxSlice.actions.addTab({ tab, apiFiles }));
            }
        } else if (category === CATEGORY_STORAGE.RECENT) {
            // Open in new tab
            const tab = generateDefaultTab(this.currentApiVersion);
            tab.body = extra.body;
            tab.header = extra.header;
            tab.method = extra.method;
            tab.endpoint = extra.endpoint;
            tab.variables = extra.variables;
            store.dispatch(API.reduxSlice.actions.addTab({ tab }));
        } else {
            console.warn(`${category} not supported !`);
        }
    };

    handleRemoveItem = e => {
        e.stopPropagation();
        const { id } = e.detail;
        store.dispatch(DOCUMENT.reduxSlices.APIFILE.actions.removeOne(id));
    };


    // Editor init and change handlers
    initVariablesEditor = () => {
        if (!this._hasRendered || !this.refs.variablesEditor) return;
        this.variablesModel = this.refs.variablesEditor.createModel({
            body: this.variables,
            language: 'json',
        });
        this.refs.variablesEditor.displayModel(this.variablesModel);
    };

    /** Getters */

    get currentApiVersion() {
        return this.connector.conn.version || '60.0';
    }

    get formattedTabs() {
        return this.tabs.map((x, index) => {
            return {
                ...x,
                name: x.fileId || `Request ${index + 1}`,
                isCloseable: this.tabs.length > 1,
                class: classSet('slds-tabs_scoped__item')
                    .add({ 'slds-is-active': x.path === this.currentFile })
                    .toString(),
            };
        });
    }

    get currentRequestToStore() {
        return {
            endpoint: this.endpoint,
            method: this.method,
            body: this.body,
            header: this.header,
        };
    }

    get currentRequestWithActions() {
        return {
            ...this.currentRequestToStore,
            actions: this.actions,
            actionPointer: this.actionPointer,
        };
    }

    get currentRequestWithContent() {
        return {
            ...this.currentRequestToStore,
            content: this.content,
        };
    }

    get duration() {
        if(this.executionStartDate && this.executionEndDate){
            return moment(this.executionEndDate).diff(moment(this.executionStartDate), 'milliseconds');
        }
        return 0;
    }

    get isUndoDisabled() {
        return this.actionPointer <= 0 || this.isApiRunning;
    }

    get isRedoDisabled() {
        return this.actionPointer >= this.actions.length - 1 || this.isApiRunning;
    }

    get isBodyDisabled() {
        return (
            this.method == METHOD.GET ||
            this.method == METHOD.DELETE ||
            this.isLoading ||
            this.isApiRunning
        );
    }

    get isHeaderDisabled() {
        return this.isLoading || this.isApiRunning;
    }

    get isBodyDisplayed() {
        return this.tab_normalizedCurrent === TABS.BODY;
    }

    get isHeadersDisplayed() {
        return this.tab_normalizedCurrent === TABS.HEADERS;
    }

    get isDetailsDisplayed() {
        return this.tab_normalizedCurrent === TABS.DETAILS;
    }

    get isRequestBodyDisplayed() {
        return this.request_normalizedCurrent === TABS.BODY;
    }

    get isRequestHeadersDisplayed() {
        return this.request_normalizedCurrent === TABS.HEADERS;
    }

    get isRequestVariablesDisplayed() {
        return this.request_normalizedCurrent === TABS.VARIABLES;
    }

    get method_options() {
        return Object.keys(METHOD).map(x => ({ label: x, value: x }));
    }

    get isExecuteApiDisabled() {
        return false;
    }

    get isContentDisplayed() {
        return isNotUndefinedOrNull(this.content);
    }

    get isFormattedContentDisplayed() {
        return this.contentLength < 100000;
    }

    get formattedContent() {
        if (typeof this.content === 'object' && isNotUndefinedOrNull(this.content)) {
            return JSON.stringify(this.content, null, 4);
        } else if (this.formattedContentType === 'xml') {
            return prettifyXml(this.content);
        }
        return this.content;
    }

    get formattedContentType() {
        return formattedContentType(this.contentType);
    }

    get pageClass() {
        return super.pageClass + ' slds-p-around_small';
    }

    get prettyContainerClass() {
        return classSet('slds-full-height slds-scrollable_y')
            .add({ 'slds-hide': !(this.viewer_value === VIEWERS.PRETTY) })
            .toString();
    }

    get workbenchContainerClass() {
        return classSet('slds-fill-height slds-flex-column')
            .add({ 'slds-hide': !(this.viewer_value === VIEWERS.WORKBENCH) })
            .toString();
    }

    get rawContainerClass() {
        return classSet('slds-full-height slds-scrollable_y')
            .add({ 'slds-hide': !(this.viewer_value === VIEWERS.RAW) })
            .toString();
    }

    get previewContainerClass() {
        return classSet('slds-full-height slds-scrollable_y')
            .add({ 'slds-hide': !(this.viewer_value === VIEWERS.PREVIEW) })
            .toString();
    }

    get isPreviewMode() {
        return '';
    }

    get viewer_options() {
        return Object.values(VIEWERS).map(x => ({ value: x, label: x }));
    }

    get tab_normalizedCurrent() {
        return normalize(this.tab_current, {
            fallbackValue: TABS.BODY,
            validValues: [TABS.BODY, TABS.HEADERS, TABS.DETAILS],
            toLowerCase: false,
        });
    }

    get request_normalizedCurrent() {
        return normalize(this.request_tab_current, {
            fallbackValue: TABS.BODY,
            validValues: [TABS.BODY, TABS.HEADERS, TABS.VARIABLES],
            toLowerCase: false,
        });
    }

    get fullEndpoint() {
        // Show the endpoint after variable replacement
        return this.executedFormattedRequest?.url || '';
    }

    // Add to PAGE_CONFIG
    get PAGE_CONFIG() {
        return {
            TABS: {
                ...TABS
            },
        };
    }

    get badgeClass() {
        return this.statusCode < 400 ? 'slds-theme_success' : 'slds-theme_error';
    }

    get isSaveButtonDisabled() {
        return this.isLoading;
    }

    get formattedContentLength() {
        const bytes = (this.contentLength * 3) / 4;

        const mb = bytes / (1024 * 1024); // Convert to MB
        if (mb >= 1) {
            return `${mb.toFixed(2)} MB`;
        }

        const kb = bytes / 1024; // Convert to KB
        return `${kb.toFixed(2)} KB`;
    }

    get formattedZipDownloadLabel() {
        return this.isDownloading
            ? 'Downloading'
            : `Download file (${this.formattedContentLength})`;
    }
}