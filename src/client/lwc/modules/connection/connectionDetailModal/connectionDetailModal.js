import LightningModal from 'lightning/modal';
import { api, track } from 'lwc';
import Toast from 'lightning/toast';
import LightningAlert from 'lightning/alert';
import { renameConfiguration, notificationService, validateInputs } from 'connection/utils';
import {
    isEmpty,
    isNotUndefinedOrNull,
    isElectronApp,
    isChromeExtension,
    decodeError,
    checkIfPresent,
} from 'shared/utils';

const { showToast, handleError } = notificationService;

export default class ConnectionDetailModal extends LightningModal {
    @api company;
    @api orgId;
    @api name;
    @api alias;
    @api username;
    @api instanceUrl;
    @api sfdxAuthUrl;
    @api frontDoorUrl;
    @api accessToken;
    @api credentialType;
    @api password;
    @api redirectUrl;
    @api connections = [];
    @api mode = 'view'; // 'view' or 'edit'

    @track showAccessToken = false;
    @track showPassword = false;
    @track selectedCategory = [];
    @track isNewCategoryDisplayed = false;
    @track newCategory;
    @track errors = [];
    @track orgName;
    @track newAlias;
    @track saveInProcess = false;

    newRecordOptions = [{ value: 'Category', label: 'New Category' }];

    connectedCallback() {
        this.orgName = this.name;
        this.newAlias = this.alias;
        if (this.company) {
            this.selectedCategory = [this.formatForLookup(this.company)];
        }
    }

    /* Methods for edit mode */
    formatForLookup = item => {
        return {
            id: item,
            icon: 'standard:category',
            title: item,
        };
    };
    validateForm = () => {
        let isValid = validateInputs(this.template, '.input-to-validate');
        if (this.isNewCategoryDisplayed && this.refs?.newCategory) {
            this.refs.newCategory.setCustomValidity('Confirm the new Category');
            this.refs.newCategory.reportValidity();
            isValid = false;
        }
        return isValid;
    };
    async renameAlias() {
        await renameConfiguration({
            newAlias: this.generatedAlias,
            oldAlias: this.alias,
            username: this.username,
            redirectUrl: this.redirectUrl,
            credentialType: this.credentialType,
        });
    }
    checkForErrors() {
        const lookup = this.template.querySelector('slds-lookup');
        if (!lookup) return;
        const selection = lookup.getSelection();
        this.errors = [];
        this.selectedCategory = selection;
        if (selection.length === 0) {
            this.errors.push({ message: 'Please make a selection.' });
        }
    }
    notifyUser(title, message, variant) {
        showToast({ label: title, message, variant });
    }
    validateNewCategory = () => {
        let isValid = true;
        let inputFields = this.template.querySelectorAll('.new-category-to-validate');
        inputFields.forEach(inputField => {
            if (!inputField.checkValidity()) {
                inputField.reportValidity();
                isValid = false;
            }
        });
        return isValid;
    };
    toggleShowAccessToken = () => {
        this.showAccessToken = !this.showAccessToken;
    };
    toggleShowPassword = () => {
        this.showPassword = !this.showPassword;
    };
    editMode = () => {
        this.mode = 'edit';
    };

    /* Event handlers for edit mode */
    alias_onChange = e => {
        this.newAlias = e.target.value;
    };
    name_onChange = e => {
        this.orgName = e.target.value;
    };
    newCategory_onChange = e => {
        this.newCategory = e.target.value;
    };
    redirectUrl_onChange = e => {
        this.redirectUrl = e.target.value;
    };
    handleLookupSearch = async event => {
        const lookupElement = event.target;
        try {
            const keywords = event.detail.rawSearchTerm;
            const results = this.categories
                .filter(x => checkIfPresent(x, keywords))
                .map(x => this.formatForLookup(x));
            lookupElement.setSearchResults(results);
        } catch (error) {
            handleError(error, 'Lookup Error');
            this.errors = [error];
        }
    };
    handleLookupSelectionChange = event => {
        this.checkForErrors();
    };
    handleLookupNewRecordSelection = event => {
        this.isNewCategoryDisplayed = true;
        this.newCategory = this.refs?.category?.searchTerm;
        window.setTimeout(() => {
            this.template.querySelector('.new-category-to-validate')?.focus();
        });
    };
    handleCancelNewCategoryClick = e => {
        this.isNewCategoryDisplayed = false;
        this.newCategory = null;
    };
    handleCreateNewCategoryClick = e => {
        if (this.validateNewCategory()) {
            this.errors = [];
            this.selectedCategory = [this.formatForLookup(this.newCategory)];
            this.isNewCategoryDisplayed = false;
            this.newCategory = null;
        }
    };
    async handleSaveClick() {
        if (this.validateForm()) {
            this.saveInProcess = true;
            try {
                await this.renameAlias();
                showToast({ label: 'Alias renamed successfully!', variant: 'success' });
                this.close('success');
            } catch (e) {
                handleError(e, 'Rename Alias Error');
            } finally {
                this.saveInProcess = false;
            }
        }
    }

    /* Detail mode events */

    handleCopy = e => {
        navigator.clipboard.writeText(e.currentTarget.dataset.value);
    };
    handleCloseClick() {
        this.close('canceled');
    }
    closeModal() {
        this.close('success');
    }

    /* Getters */
    get isRedirect() {
        return isNotUndefinedOrNull(this.redirectUrl);
    }
    get isOauthType() {
        return this.credentialType === 'OAUTH';
    }
    get isUsernameType() {
        return this.credentialType === 'USERNAME';
    }
    get isRedirectType() {
        return this.credentialType === 'REDIRECT';
    }
    get isAccessTokenAvailable() {
        return !isEmpty(this.accessToken);
    }
    get isPasswordAvailable() {
        return !isEmpty(this.password);
    }
    get displayAccessToken() {
        if (this.showAccessToken) return this.accessToken || '';
        if (!this.accessToken) return '';
        const len = this.accessToken.length;
        if (len <= 8) return '****';
        return this.accessToken.slice(0, 4) + '****' + this.accessToken.slice(-4);
    }
    get displayPassword() {
        if (this.showPassword) return this.password || '';
        if (!this.password) return '********';
        return '*'.repeat(this.password.length);
    }
    get accessTokenIconName() {
        return this.showAccessToken ? 'utility:hide' : 'utility:preview';
    }
    get passwordIconName() {
        return this.showPassword ? 'utility:hide' : 'utility:preview';
    }
    get categories() {
        return [...new Set(this.connections.map(x => x.company).filter(x => !isEmpty(x)))];
    }
    get generatedAlias() {
        const category =
            this.selectedCategory?.length >= 1 ? this.selectedCategory[0].id : 'category';
        const name = isNotUndefinedOrNull(this.orgName) ? this.orgName : 'name';
        return `${category}-${name}`;
    }
    get isViewMode() {
        return this.mode === 'view';
    }
    get isEditMode() {
        return this.mode === 'edit';
    }
}
