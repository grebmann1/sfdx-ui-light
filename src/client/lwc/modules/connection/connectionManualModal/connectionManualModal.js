import { api, track } from 'lwc';
import Toast from 'lightning/toast';
import LightningModal from 'lightning/modal';
import {
    getSalesforceURL,
    credentialStrategies,
    notificationService,
    validateInputs,
} from 'connection/utils';
import { isNotUndefinedOrNull, isChromeExtension } from 'shared/utils';
import LOGGER from 'shared/logger';
const { showToast, handleError } = notificationService;

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
        let isValid = validateInputs(this.template, '.input-to-validate');
        // Custom Domain
        const domainToValidate = this.template.querySelector('.domain-to-validate');
        if (domainToValidate) {
            if (
                isNotUndefinedOrNull(domainToValidate.value) &&
                domainToValidate.value.startsWith('http')
            ) {
                try {
                    const _url = new URL(domainToValidate.value);
                    this.customDomain = getSalesforceURL(_url.host);
                    //LOGGER.log('customDomain', this.customDomain);
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
        showToast({ label: title, message, variant });
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
            const result = await credentialStrategies.SESSION.connect({
                sessionId: this.manualSessionId,
                serverUrl: this.manualSessionUrl,
                extra: {
                    isProxyDisabled: isChromeExtension(),
                },
            });
            this.close(result);
        } catch (e) {
            handleError(e, 'Session Connect Error');
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
            const result = await credentialStrategies.USERNAME.connect({
                username: this.manualUsername,
                password: this.manualPassword,
                loginUrl: this.manualUrl,
                alias: this.manualUsername, // or another alias logic
            });
            this.close(result);
        } catch (e) {
            handleError(e, 'Username/Password Connect Error');
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
