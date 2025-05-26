import Toast from 'lightning/toast';
import LightningAlert from 'lightning/alert';
import LightningModal from 'lightning/modal';
import { api, track } from 'lwc';
import { isNotUndefinedOrNull } from 'shared/utils';
import {
    extractConfig,
    credentialStrategies,
    notificationService,
    validateInputs,
} from 'connection/utils';
const { showToast, handleError } = notificationService;

export default class ConnectionImportModal extends LightningModal {
    @api newAlias;
    @api oldAlias;
    @api username;
    @api existingConnections = [];

    originalSize = 0;

    @track newConnections = [];

    @track list_new = [];

    isLoading = false;

    /** Methods  **/

    extractConfig = value => {
        const textAreaCmp = this.template.querySelector('lightning-textarea');
        textAreaCmp.setCustomValidity('');

        try {
            const config = JSON.parse(value);
            // Setup
            this.newConnections = [];
            this.originalSize = config.length;
            // Processing
            config.forEach(item => {
                const params = extractConfig(item.sfdxAuthUrl);
                if (!params.instanceUrl.startsWith('http')) {
                    params.instanceUrl = `https://${params.instanceUrl}`;
                }
                const newConn = {
                    ...params,
                    alias: item.alias,
                };
                if (newConn.alias && newConn.refreshToken && newConn.instanceUrl) {
                    this.newConnections.push(newConn);
                }
            });
        } catch (e) {
            handleError(e, 'Extract Config Error');
            textAreaCmp.setCustomValidity(e.name);
        }

        textAreaCmp.reportValidity();
    };

    getOauthForNewConnections = async () => {
        return await Promise.all(
            this.newConnections
                .filter(x => this.list_new.includes(x.alias))
                .map(async settings => {
                    try {
                        // Assume OAuth for imported connections
                        const connector = await credentialStrategies.OAUTH.connect({
                            alias: settings.alias,
                            loginUrl: settings.instanceUrl,
                        });
                        return connector;
                    } catch (e) {
                        handleError(e, 'Import OAuth Connect Error');
                        return null;
                    }
                })
        );
    };

    /** events **/
    inputChange = e => {
        //console.log('inputChange',e.target.files);
        this.refs.uploader.handleDrop(e);
    };

    handleFileChange = e => {
        this.newConnections = [];
        const config = JSON.parse(e.detail.value);
        // Processing
        config.forEach(item => {
            const params = extractConfig(item.sfdxAuthUrl);
            if (!params.instanceUrl.startsWith('http')) {
                params.instanceUrl = `https://${params.instanceUrl}`;
            }
            const newConn = {
                ...params,
                alias: item.alias,
            };
            if (newConn.alias && newConn.refreshToken && newConn.instanceUrl) {
                this.newConnections.push(newConn);
            }
        });
        // We filter between existing and new connections
        this.list_new = [
            ...this.newConnections.map(x => x.alias).filter(x => !this.existingAlias.includes(x)),
        ];
    };

    handleChange = e => {
        //console.log('handleChange');
        this.extractConfig(e.detail.value);
    };

    handleCloseClick = () => {
        this.close();
    };

    closeModal = () => {
        this.close();
    };

    handleSaveClick = async () => {
        this.isLoading = true;
        try {
            const connectors = await this.getOauthForNewConnections();
            showToast({
                label: `${this.list_new.length} credential(s) added !`,
                variant: 'success',
            });
            this.close('success');
        } catch (e) {
            handleError(e, 'Import Save Error');
        }
        this.isLoading = false;
    };

    handleDualListChange = e => {
        const selectedOptionsList = e.detail.value;
        //console.log('selectedOptionsList',selectedOptionsList,e.detail);
        this.list_new = e.detail.value;
    };

    /** Getters */

    get options() {
        return this.newConnections.map(x => ({ label: x.alias, value: x.alias }));
    }

    get existingAlias() {
        return this.existingConnections.map(x => x.alias);
    }

    get resultMessage() {
        return `${this.newConnections.length}/${this.originalSize} new connections will be added !`;
    }

    get isResultDisplayed() {
        return isNotUndefinedOrNull(this.newConnections) && this.newConnections.length > 0;
    }
}
