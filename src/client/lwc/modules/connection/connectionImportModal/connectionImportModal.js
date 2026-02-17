import Toast from 'lightning/toast';
import LightningAlert from 'lightning/alert';
import LightningModal from 'lightning/modal';
import { api, track } from 'lwc';
import { isNotUndefinedOrNull } from 'shared/utils';
import {
    extractConfig as extractSfdxAuthUrlConfig,
    credentialStrategies,
    notificationService,
    validateInputs,
    normalizeConfiguration,
    OAUTH_TYPES,
    platformService,
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
                const params = extractSfdxAuthUrlConfig(item.sfdxAuthUrl);
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

    buildNormalizedImportedConfiguration = settings => {
        // Imported org.json entries contain a refresh token (sfdxAuthUrl).
        // Persist as an OAuth config so the OAuth strategy can refresh silently (no interactive login).
        return normalizeConfiguration(
            {
                credentialType: OAUTH_TYPES.OAUTH,
                alias: settings.alias,
                refreshToken: settings.refreshToken,
                instanceUrl: settings.instanceUrl,
            },
            true
        );
    };

    importAndConnect = async settings => {
        const normalized = this.buildNormalizedImportedConfiguration(settings);
        await platformService.saveConfiguration(settings.alias, normalized);
        // Now that configuration is persisted, oauth.connect will use the refreshToken branch (no web auth flow).
        const connector = await credentialStrategies.OAUTH.connect({ alias: settings.alias });
        return connector;
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
            const params = extractSfdxAuthUrlConfig(item.sfdxAuthUrl);
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
            const selected = this.newConnections.filter(x => this.list_new.includes(x.alias));
            if (!selected.length) {
                showToast({
                    label: 'No credentials selected to import.',
                    variant: 'warning',
                });
                return;
            }

            const results = await Promise.allSettled(selected.map(this.importAndConnect));
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            const failures = results
                .filter(r => r.status === 'rejected')
                .map(r => (r.reason?.message ? r.reason.message : String(r.reason)));

            if (failures.length) {
                failures.forEach(msg => handleError(new Error(msg), 'Import OAuth Connect Error'));
            }

            showToast({
                label:
                    failures.length === 0
                        ? `${successCount} credential(s) imported and validated.`
                        : `${successCount}/${selected.length} credential(s) imported. Some need re-authorization.`,
                variant: failures.length === 0 ? 'success' : 'warning',
            });

            this.close(failures.length === 0 ? 'success' : 'partial');
        } catch (e) {
            handleError(e, 'Import Save Error');
        } finally {
            this.isLoading = false;
        }
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

    get saveInProcess() {
        return this.isLoading;
    }
}
