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
    prettifyXml,
    isElectronApp,
    isChromeExtension,
    API as API_UTILS,
} from 'shared/utils';
import { store, connectStore, PACKAGE, SELECTORS } from 'core/store';
import Toast from 'lightning/toast';
import moment from 'moment';
import { TEMPLATE } from 'package/utils';
import xml2js from 'xml2js';

const TESTLEVEL = {
    NoTestRun: 'NoTestRun',
    RunLocalTests: 'RunLocalTests',
    RunAllTestsInOrg: 'RunAllTestsInOrg',
    RunSpecifiedTests: 'RunSpecifiedTests',
};

export default class Retrieve extends ToolkitElement {
    isRunning = false;
    file;

    _response;

    // Error
    error_title;
    error_message;

    // Interval
    _headerInterval;
    _loadingInterval;

    // loading
    _loadingMessage;

    // Models
    responseModel;
    manifestModel;

    // Viewer
    viewer_value = API_UTILS.VIEWERS.PRETTY;

    // Retrieve Promise
    retrievePromise;

    isDownloading = false;

    get body() {
        return this._body;
    }

    set body(value) {
        if (this._hasRendered) {
            const inputEl = this.refs?.manifest?.currentModel;
            if (inputEl && this._body != value) {
                inputEl.setValue(isUndefinedOrNull(value) ? '' : value);
            }
        }
        this._body = value;
    }

    connectedCallback() {
        this.body = prettifyXml(TEMPLATE.BASIC.replace('{0}', this.currentApiVersion));
    }

    renderedCallback() {
        this._hasRendered = true;
    }

    @wire(connectStore, { store })
    storeChange({ package2, application }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if (!isCurrentApp) return;

        // Retrieve
        const retrieveState = package2.currentRetrieveJob;
        if (retrieveState) {
            this.isRunning = retrieveState.isFetching;
            if (this.isRunning) {
                this.loading_enableAutoDate(retrieveState.createdDate);
            } else {
                if (this._loadingInterval) clearInterval(this._loadingInterval);
            }

            if (retrieveState.error) {
                this.global_handleError(retrieveState.error);
                this.resetResponse();
            } else if (retrieveState.data) {
                // Reset First
                this.resetError();
                // Assign Data
                this._response = retrieveState.data;
            } else if (retrieveState.isFetching) {
                this.resetError();
                this.resetResponse();
            }
        } else {
            this.resetError();
            this.resetResponse();
            if (this._loadingInterval) clearInterval(this._loadingInterval);
        }
    }

    /** Methods  **/

    @api
    toggleMetadata = async param => {
        const { sobject, label, _developerName, selectAll, unselectAll } = param;
        const membersToAdd = {};
        if (sobject && _developerName) {
            membersToAdd[sobject] = [_developerName];
        }
        const manifestXml = this.refs.manifest.currentModel.getValue();

        this.updateManifest(manifestXml, membersToAdd, selectAll || [], unselectAll || [])
            .then(newManifest => {
                this.refs.manifest.currentModel.setValue(newManifest);
            })
            .catch(e => {
                console.error(e);
            });
    };

    updateManifest = async (xml, membersToToggle, selectAll, unselectAll) => {
        const parser = new xml2js.Parser();
        const builder = new xml2js.Builder();

        try {
            // Parse the XML
            const parsedData = await parser.parseStringPromise(xml);

            // Ensure Package and types array exist
            if (!parsedData.Package) parsedData.Package = {};
            if (!parsedData.Package.types) parsedData.Package.types = [];

            // Convert types array to a map for easy lookup
            const typesMap = {};
            parsedData.Package.types.forEach(type => {
                typesMap[type.name[0]] = type;
            });

            // Process each type in membersToToggle
            for (const [typeName, newMembers] of Object.entries(membersToToggle)) {
                let type = typesMap[typeName];

                if (!type) {
                    // If type doesn't exist, create a new type object and add to the types array
                    type = { members: [], name: [typeName] };
                    parsedData.Package.types.push(type);
                }

                // Get existing members, remove '*' if present
                let existingMembers = type.members || [];
                existingMembers = existingMembers.filter(member => member !== '*');

                // Add new members that are not already in the list
                newMembers.forEach(newMember => {
                    if (!existingMembers.includes(newMember)) {
                        existingMembers.push(newMember);
                    } else {
                        existingMembers = existingMembers.filter(member => member !== newMember);
                    }
                });

                // Update the members in the object
                type.members = existingMembers;
            }

            // Process select all
            selectAll.forEach(typeName => {
                let type = typesMap[typeName];

                if (!type) {
                    // If type doesn't exist, create a new type object and add to the types array
                    type = { members: [], name: [typeName] };
                    parsedData.Package.types.push(type);
                }
                type.members = ['*'];
            });
            // Process unselect all
            parsedData.Package.types = parsedData.Package.types.filter(
                type => !unselectAll.includes(type.name[0])
            );

            // Filter and sort
            parsedData.Package.types = parsedData.Package.types
                .filter(type => type.members.length > 0)
                .sort((a, b) => a.name[0].localeCompare(b.name[0]));
            // Build the modified XML back into a string
            const updatedXml = builder.buildObject(parsedData);
            return updatedXml;
        } catch (err) {
            console.error('Error processing XML:', err);
        }
    };

    @api
    run = async () => {
        const request = this.fetchTaskForWorker();
        const manifestXml = this.refs.manifest.currentModel.getValue();

        try {
            const jsonFormatted = await xml2js.parseStringPromise(manifestXml, {
                explicitArray: false,
            });
            const _request = {
                unpackaged: {
                    types: jsonFormatted.hasOwnProperty('Package')
                        ? jsonFormatted.Package.types
                        : jsonFormatted.types,
                },
                apiVersion:
                    (jsonFormatted.hasOwnProperty('Package')
                        ? jsonFormatted.Package.version
                        : jsonFormatted.version) || this.currentApiVersion,
                singlePackage: request.options.singlePackage || false,
            };

            this.retrievePromise = store.dispatch(
                PACKAGE.executePackageRetrieve({
                    connector: this.connector,
                    request: _request,
                    createdDate: new Date(),
                    proxyUrl: isElectronApp() || isChromeExtension() ? null : window.jsforceSettings.proxyUrl,
                })
            );
        } catch (e) {
            Toast.show({
                label: `Error while retrieving`,
                description: e.message,
                variant: 'error',
                mode: 'dismissible',
            });
        }
    };

    @api
    abort = async () => {
        // cancelDeploy
        try {
            if (this.retrievePromise) {
                this.retrievePromise.abort();
            }
        } catch (e) {
            // handle error here
            console.error(e);
        }
    };

    @api
    reset = () => {};

    fetchTaskForWorker = () => {
        const options = {};
        let inputFields = this.template.querySelectorAll('.deployment-option');
        inputFields.forEach(inputField => {
            if (inputField.type === 'checkbox') {
                options[inputField.name] = inputField.checked;
            } else {
                // Avoid empty value
                if (!isEmpty(inputField.value)) {
                    options[inputField.name] = inputField.value;
                }
            }
        });

        return {
            options,
        };
    };

    base64ToBlob = (base64, mime) => {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mime });
    };

    downloadBlob = (blob, filename) => {
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    };

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

    processFile() {
        if (this.file && this.file.type === 'text/xml') {
            const reader = new FileReader();
            reader.onload = () => {
                const textXml = reader.result;
                this.body = prettifyXml(textXml);
            };
            reader.readAsText(this.file);
        } else {
            Toast.show({
                label: `Please upload a valid xml file`,
                variant: 'error',
                mode: 'dismissible',
            });
        }
    }

    resetResponse = () => {
        this._response = null;
        this.isDownloading = false;
    };

    // Errors

    global_handleError = e => {
        let errors = e.message.split(':');
        if (errors.length > 1) {
            this.error_title = errors.shift();
        } else {
            this.error_title = 'Error';
        }
        this.error_message = errors.join(':');
    };

    resetError = () => {
        this.error_title = null;
        this.error_message = null;
        this.isDownloading = false;
    };

    /** Events **/

    handle_downloadClick = e => {
        this.isDownloading = true;
        setTimeout(() => {
            if (this._response?.zipFile) {
                const zipFileBase64 = this._response?.zipFile;
                const blob = this.base64ToBlob(zipFileBase64, 'application/zip');
                this.downloadBlob(blob, `retrieve_${this._response.id}.zip`);
                this.isDownloading = false;
            }
        }, 1);
    };

    handleFileChange = e => {
        this.file = e.detail.files[0];
        this.processFile();
        this.fetchTaskForWorker();
    };

    handleRemoveFile = e => {
        this.file = null;
        this.body = prettifyXml(TEMPLATE.BASIC.replace('{0}', this.currentApiVersion));
    };

    handleResponseLoad = e => {
        this.responseModel = this.refs.response.createModel({
            body: this.formattedResponse,
            language: 'json',
        });
        this.refs.response.displayModel(this.responseModel);
    };

    handleManifestLoad = () => {
        this.manifestModel = this.refs.manifest.createModel({
            body: this.body,
            language: 'xml',
        });
        this.refs.manifest.displayModel(this.manifestModel);
    };

    viewer_handleChange = e => {
        this.viewer_value = e.detail.value;
    };

    testLevel_change = e => {
        this.testLevel_value = e.detail.value;
    };

    /** Getters **/

    get currentApiVersion() {
        return this.connector.conn.version || '60.0';
    }

    get fileName() {
        return this.file?.name || '';
    }

    get isFileListDisplayed() {
        return isNotUndefinedOrNull(this.file);
    }

    get rightSlotClass() {
        return classSet('slds-full-height slds-full-width slds-flex-column')
            .add({
                'apex-illustration': !this.isRunning,
            })
            .toString();
    }

    get hasError() {
        return isNotUndefinedOrNull(this.error_message);
    }

    get isResultDisplayed() {
        return isNotUndefinedOrNull(this._response); //return !isEmpty(this.log);
    }

    get resultTitle() {
        return this._response?.status;
    }

    get resultId() {
        return this._response?.id;
    }

    get resultVariant() {
        return this._response?.success ? 'success' : 'error';
    }

    get resultMessage() {
        return `${this._response?.success ? 'Successfull' : 'Failed'} retrieval.`;
    }

    @api
    get isInputDisabled() {
        return this.isRunning;
    }

    get prettyContainerClass() {
        return classSet('slds-full-height slds-scrollable_y')
            .add({ 'slds-hide': !(this.viewer_value === API_UTILS.VIEWERS.PRETTY) })
            .toString();
    }

    get rawContainerClass() {
        return classSet('slds-full-height slds-scrollable_y')
            .add({ 'slds-hide': !(this.viewer_value === API_UTILS.VIEWERS.RAW) })
            .toString();
    }

    get viewer_options() {
        return [API_UTILS.VIEWERS.PRETTY, API_UTILS.VIEWERS.RAW].map(x => ({ value: x, label: x }));
    }

    get formattedResponse() {
        return JSON.stringify(this._response, null, 4);
    }

    get contentLength() {
        if (isUndefinedOrNull(this._response)) return 0;
        //5726285
        return new TextEncoder().encode(this._response.zipFile).length;
    }

    get isFormattedContentDisplayed() {
        return this.contentLength < 100000;
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
