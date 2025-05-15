import { api, track } from 'lwc';
import Toast from 'lightning/toast';
import LightningAlert from 'lightning/alert';
import LightningModal from 'lightning/modal';
import { directConnect, unsecureDirectConnect, processHost } from 'connection/utils';
import {
    isEmpty,
    isUndefinedOrNull,
    isNotUndefinedOrNull,
    isElectronApp,
    isChromeExtension,
    decodeError,
    checkIfPresent,
} from 'shared/utils';
import LOGGER from 'shared/logger';

export default class ConnectionManualModal extends LightningModal {
    @track manualSessionUrl = '';
    @track manualSessionId = '';
    @track manualUrl = '';
    @track manualUsername = '';
    @track manualPassword = '';
    @track activeTab = 'session'; // 'session' or 'username'
    isLoading = false;

    connectedCallback() {}

    /** Methods **/

    reset = () => {};

    closeModal() {
        this.close();
    }

    validateForm = () => {
        let isValid = true;
        // Default
        let inputFields = this.template.querySelectorAll('.input-to-validate');
        inputFields.forEach(inputField => {
            if (!inputField.checkValidity()) {
                inputField.reportValidity();
                isValid = false;
            }
        });
        // Custom Domain
        const domainToValidate = this.template.querySelector('.domain-to-validate');
        if (domainToValidate) {
            if (
                isNotUndefinedOrNull(domainToValidate.value) &&
                domainToValidate.value.startsWith('http')
            ) {
                try {
                    const _url = new URL(domainToValidate.value);
                    this.customDomain = processHost(_url.host);
                    LOGGER.log('customDomain', this.customDomain);
                } catch (e) {
                    domainToValidate.setCustomValidity("Don't include the protocol");
                    isValid = false;
                }
            } else {
                domainToValidate.setCustomValidity('');
            }
            domainToValidate.reportValidity();
        }
        return isValid;
    };

    notifyUser(title, message, variant) {
        Toast.show({
            label: title,
            message,
            variant,
        });
    }

    /** events **/

    handleCloseClick = e => {
        this.close();
    };

    // Tab logic for slds-tabset
    handleTabActive = event => {
        this.activeTab = event.target.value || event.detail.value;
    };

    // Session tab handlers
    manualSessionUrl_onChange = e => {
        this.manualSessionUrl = e.target.value;
    };
    manualSessionId_onChange = e => {
        this.manualSessionId = e.target.value;
    };
    handleManualSessionConnect = async () => {
        if (!this.validateForm()) return;
        this.isLoading = true;
        try {
            const normalizedUrl = processHost(this.manualSessionUrl);
            console.log('normalizedUrl', normalizedUrl);
            console.log('manualSessionId', this.manualSessionId);
            await directConnect(this.manualSessionId, normalizedUrl, {
                isEnrichDisabled: false,
                isAliasMatchingDisabled: true,
                isProxyDisabled: isChromeExtension(),
            });
            this.close(true);
        } catch (e) {
            this.notifyUser('Error', e.message, 'error');
        }
        this.isLoading = false;
    };

    // Username/Password tab handlers
    manualUrl_onChange = e => {
        this.manualUrl = e.target.value;
    };
    manualUsername_onChange = e => {
        this.manualUsername = e.target.value;
    };
    manualPassword_onChange = e => {
        this.manualPassword = e.target.value;
    };
    handleManualUsernameConnect = async () => {
        if (!this.validateForm()) return;

        this.isLoading = true;
        try {
            const normalizedUrl = processHost(this.manualUrl);
            await unsecureDirectConnect(this.manualUsername, this.manualPassword, normalizedUrl);
            this.close(true);
        } catch (e) {
            this.isLoading = false;
            this.notifyUser('Error', e.message, 'error');
        }
        this.isLoading = false;
    };

    /** Getters **/

    get isSessionTab() {
        return this.activeTab === 'session';
    }
    get isUsernameTab() {
        return this.activeTab === 'username';
    }

    get canConnectManualSession() {
        return this.manualSessionUrl.trim() !== '' && this.manualSessionId.trim() !== '';
    }

    get canConnectManualUsername() {
        return (
            this.manualUrl.trim() !== '' &&
            this.manualUsername.trim() !== '' &&
            this.manualPassword.trim() !== ''
        );
    }
}
