import LightningModal from 'lightning/modal';
import { api, wire } from 'lwc';
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
import Toast from 'lightning/toast';
import moment from 'moment';
import { VIEWERS } from 'api/utils';

const TESTLEVEL = {
    NoTestRun: 'NoTestRun',
    RunLocalTests: 'RunLocalTests',
    RunAllTestsInOrg: 'RunAllTestsInOrg',
    RunSpecifiedTests: 'RunSpecifiedTests',
};
export default class ModalDeploy extends LightningModal {
    @api connector;

    _response;

    isRunning = false;
    file;
    zip64;

    // Models
    responseModel;

    // Error
    error_title;
    error_message;

    // Interval
    _headerInterval;
    _loadingInterval;

    // loading
    _loadingMessage;

    // Viewer
    viewer_value = VIEWERS.PRETTY;

    // Options
    testLevel_value = TESTLEVEL.NoTestRun;

    @wire(connectStore, { store })
    storeChange({ package2, application }) {
        // Deployment
        const deployState = package2.currentDeploymentJob;
        if (deployState) {
            this.isRunning = deployState.isFetching;
            if (this.isRunning) {
                this.loading_enableAutoDate(deployState.createdDate);
            } else {
                if (this._loadingInterval) clearInterval(this._loadingInterval);
            }

            if (deployState.error) {
                this.global_handleError(deployState.error);
                this.resetResponse();
            } else if (deployState.data) {
                // Reset First
                this.resetError();
                // Assign Data
                this._response = deployState.data;
            } else if (deployState.isFetching) {
                this.resetError();
                this.resetResponse();
            }
        } else {
            this.resetError();
            this.resetResponse();
            if (this._loadingInterval) clearInterval(this._loadingInterval);
        }
    }

    disconnectedCallback() {
        store.dispatch(PACKAGE.reduxSlice.actions.clearCurrentDeploymentJob());
    }

    closeModal() {
        this.close({ action: 'cancel' });
    }

    verifyIsActive = applicationName => {
        return this.applicationName === applicationName;
    };

    /** events **/

    handleFileChange = e => {
        this.file = e.detail.files[0];
        this.processFile();
        this.fetchTaskForWorker();
    };

    handleRemoveFile = e => {
        this.file = null;
    };

    handleResponseLoad = e => {
        this.responseModel = this.refs.response.createModel({
            body: this.formattedResponse,
            language: 'json',
        });
        this.refs.response.displayModel(this.responseModel);
    };

    viewer_handleChange = e => {
        this.viewer_value = e.detail.value;
    };

    handleCloseClick() {
        //this.close('canceled');
        this.close({
            action: 'close',
            recordId: this._response?.id,
        });
    }

    handleCancelClick() {
        //this.close('canceled');
        this.close({ action: 'cancel' });
    }

    handleApplyClick = () => {
        this.run();
    };

    testLevel_change = e => {
        this.testLevel_value = e.detail.value;
    };

    /** Methods **/

    run = () => {
        const request = this.fetchTaskForWorker();
        if (isUndefinedOrNull(request.zip64)) {
            Toast.show({
                label: `Please upload a valid zip file`,
                variant: 'error',
                mode: 'dismissible',
            });
            return;
        }
        store.dispatch(PACKAGE.reduxSlice.actions.clearCurrentDeploymentJob());
        this.deploymentPromise = store.dispatch(
            PACKAGE.executePackageDeploy({
                connector: this.connector,
                zip64: request.zip64,
                options: request.options,
                createdDate: new Date(),
            })
        );
    };

    processFile = () => {
        if (this.file && this.file.type === 'application/zip') {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                //this.deployMetadata(base64, this.file.name);
                this.zip64 = base64; //this.base64ToBlob(base64, 'application/zip');
            };
            reader.readAsDataURL(this.file);
        } else {
            Toast.show({
                label: `Please upload a valid zip file`,
                variant: 'error',
                mode: 'dismissible',
            });
        }
    };

    base64ToBlob = (base64, mime) => {
        const byteChars = atob(base64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
            byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mime });
    };

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
            zip64: this.zip64,
        };
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
    };

    resetResponse = () => {
        this._response = null;
    };

    /** Getter */

    get fileName() {
        return this.file?.name || '';
    }

    get isFileListDisplayed() {
        return isNotUndefinedOrNull(this.file);
    }

    get rightSlotClass() {
        return classSet('slds-full-height slds-full-width slds-flex-column').toString();
    }

    get hasError() {
        return isNotUndefinedOrNull(this.error_message);
    }

    get isResultDisplayed() {
        return isNotUndefinedOrNull(this._response); //return !isEmpty(this.log);
    }

    get isDone() {
        // we consider done if it's done and queued as we want to close the modal
        return this._response?.done || this._response?.state === 'Queued';
    }

    get resultVariant() {
        const isDone = this._response?.done;
        const isSuccess = this._response?.success;
        return (isSuccess && isDone) || !isDone ? 'success' : 'error';
    }

    get resultTitle() {
        return this._response?.status;
    }

    get resultMessage() {
        return `State : ${this._response?.state}`;
    }

    get resultMessageDetails() {
        return this.resultProcessing
            ? `Processing Time : ${this.resultProcessing}, `
            : '' + `DeploymentId : ${this._response?.id} `;
    }

    get resultProcessing() {
        if (this._response?.startDate && this._response?.completedDate) {
            const diff = new moment(this._response?.completedDate).diff(
                new moment(this._response?.startDate)
            );
            return moment.duration(diff).as('seconds') + ' seconds';
        }
        return null;
    }

    get isInputDisabled() {
        return this.isRunning || this.isDone;
    }

    get isRunTestInputDisabled() {
        return this.isInputDisabled || this.testLevel_value !== TESTLEVEL.RunSpecifiedTests;
    }

    get prettyContainerClass() {
        return classSet('slds-full-height slds-scrollable_y')
            .add({ 'slds-hide': !(this.viewer_value === VIEWERS.PRETTY) })
            .toString();
    }

    get rawContainerClass() {
        return classSet('slds-full-height slds-scrollable_y')
            .add({ 'slds-hide': !(this.viewer_value === VIEWERS.RAW) })
            .toString();
    }

    get viewer_options() {
        return [VIEWERS.PRETTY, VIEWERS.RAW].map(x => ({ value: x, label: x }));
    }

    get formattedResponse() {
        return JSON.stringify(this._response, null, 4);
    }

    get testLevel_options() {
        return Object.keys(TESTLEVEL).map(key => ({ value: key, label: TESTLEVEL[key] }));
    }
}
