import { api, track } from 'lwc';
import Toast from 'lightning/toast';
import LightningAlert from 'lightning/alert';
import LightningModal from 'lightning/modal';
import {
    setRedirectCredential,
    processHost,
    credentialStrategies,
    notificationService,
    validateInputs,
    OAUTH_TYPES,
} from 'connection/utils';
const { showToast, handleError } = notificationService;
import {
    isEmpty,
    isNotUndefinedOrNull,
    isElectronApp,
    decodeError,
    checkIfPresent,
} from 'shared/utils';

import LOGGER from 'shared/logger';

const domainOptions = [
    { id: 'prod', label: 'login.salesforce.com', value: 'login.salesforce.com' },
    { id: 'test', label: 'test.salesforce.com', value: 'test.salesforce.com' },
    { id: 'custom', label: 'custom domain', value: 'custom' },
];

const DEFAULT_CATEGORY = {
    id: 'default',
    icon: 'standard:category',
    title: 'Default',
};

const ORG_TYPES = {
    PRODUCTION: 'Production',
    SANDBOX: 'Sandbox',
    SCRATCH: 'Scratch',
};

export default class ConnectionNewModal extends LightningModal {
    isLoading = false;
    domain_options = domainOptions;

    @api customDomain;
    @api redirectUrl;
    @api selectedDomain = domainOptions[0].value;
    @api alias;
    @api connections = [];
    @api selectedCategory = [DEFAULT_CATEGORY];
    @api name;
    @api username = '';
    @api password = '';

    newCategory;
    orgType = ORG_TYPES.PRODUCTION;
    credentialType = OAUTH_TYPES.OAUTH;

    _isNewCategoryDisplayed;
    set isNewCategoryDisplayed(value) {
        this._isNewCategoryDisplayed = value;
        if (this._isNewCategoryDisplayed === false)
            window.setTimeout(() => {
                this.initLookupDefaultResults();
            }, 1);
    }
    get isNewCategoryDisplayed() {
        return this._isNewCategoryDisplayed;
    }

    /* Group variables */
    maxSelectionSize = 2;
    errors = [];

    newRecordOptions = [{ value: 'Category', label: 'New Category' }];

    connectedCallback() {
        this.isNewCategoryDisplayed = false;
    }

    /** Methods **/

    initLookupDefaultResults() {
        // Make sure that the lookup is present and if so, set its default results
        const lookup = this.template.querySelector('slds-lookup');
        if (lookup) {
            lookup.setDefaultResults(this.categories.map(x => this.formatForLookup(x)));
            lookup.selection = this.selectedCategory;
        }
    }

    reset = () => {
        this.alias = null;
        this.selectedDomain = domainOptions[0].value;
    };

    validateForm = () => {
        let isValid = validateInputs(this.template, '.input-to-validate');
        // Categories
        if (this.isNewCategoryDisplayed && this.refs.newCategory) {
            this.refs.newCategory.setCustomValidity('Confirm the new Category');
            this.refs.newCategory.reportValidity();
            isValid = false;
        }
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

    validateNewCategory = () => {
        let isValid = true;
        // Default
        let inputFields = this.template.querySelectorAll('.new-category-to-validate');
        inputFields.forEach(inputField => {
            inputField.setCustomValidity(''); // reset
            if (!inputField.checkValidity()) {
                inputField.reportValidity();
                isValid = false;
            }
        });

        return isValid;
    };

    closeModal() {
        this.close();
    }

    register = async () => {
        this.isLoading = true;
        if (this.isOauth) {
            if (isElectronApp()) {
                this.electron_oauth();
            } else {
                this.standard_oauth();
            }
        } else if (this.isRedirect) {
            this.default_redirect();
        } else if (this.isUsernamePassword) {
            this.standard_usernamePassword();
        }
    };

    standard_usernamePassword = async () => {
        try {
            const result = await credentialStrategies.USERNAME.connect(
                {
                    username: this.username,
                    password: this.password,
                    loginUrl: this.loginUrl,
                    alias: this.alias,
                },
                { saveFullConfiguration: true }
            );
            LOGGER.log('standard_usernamePassword', result);
            showToast({ label: 'Connected successfully!', variant: 'success' });
            this.close(result);
        } catch (e) {
            LOGGER.error('standard_usernamePassword error', e);
            handleError(e, 'Username/Password Error');
            this.close(null);
        }
    };

    default_redirect = () => {
        setRedirectCredential(
            {
                alias: this.alias,
                redirectUrl: this.redirectUrl,
            },
            () => {
                this.isLoading = false;
                this.close(null);
            },
            e => {
                this.isLoading = false;
                handleError(e, 'Redirect Error');
                this.close(null);
            }
        );
    };

    electron_oauth = async () => {
        //console.log('electron_oauth');
        const normalizedUrl = processHost(this.loginUrl);
        let params = {
            alias: this.alias,
            instanceurl: normalizedUrl,
        };
        try {
            const { error, res } = await window.electron.ipcRenderer.invoke(
                'org-createNewOrgAlias',
                params
            );
            if (error) {
                throw decodeError(error);
            }
            console.log('electron_oauth', error, res);

            window.electron.listener_on('oauth', value => {
                if (value.action === 'done' || value.action === 'exit') {
                    window.electron.listener_off('oauth');
                    setTimeout(() => {
                        //console.log('close connection');
                        this.close(value.data);
                    }, 1000);
                } else if (value.action === 'error') {
                    throw decodeError(value.error);
                }
            });
        } catch (e) {
            //console.log('error',e);
            this.close();
            await LightningAlert.open({
                message: e.message,
                theme: 'error', // a red theme intended for error states
                label: 'Error!', // this is the header text
            });
        }
    };

    standard_oauth = async () => {
        try {
            const result = await credentialStrategies.OAUTH.connect(
                {
                    alias: this.alias,
                    loginUrl: this.loginUrl,
                },
                { saveFullConfiguration: true }
            );
            console.log('result', result);
            this.close(result);
        } catch (e) {
            handleError(e, 'OAuth Error');
            this.close(null);
        }
    };

    checkForErrors() {
        //console.log('checkForErrors',this.template.querySelector('slds-lookup').getSelection());
        const selection = this.template.querySelector('slds-lookup').getSelection();

        this.errors = [];
        this.selectedCategory = selection;
        // Enforcing required field
        if (selection.length === 0) {
            this.errors.push({ message: 'Please make a selection.' });
        }
    }

    formatForLookup = item => {
        return {
            id: item,
            icon: 'standard:category',
            title: item,
        };
    };

    /** events **/

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
        this.newCategory = this.refs.category.searchTerm;
        window.setTimeout(() => {
            this.template.querySelector('.new-category-to-validate')?.focus();
        });
    };

    handleCloseClick = e => {
        this.close();
    };

    handleLoginClick = async e => {
        if (this.validateForm()) {
            this.alias = this.generatedAlias; // Automatically generated from the Category & Name
            await this.register();
        }
    };

    handleCancelNewCategoryClick = e => {
        this.isNewCategoryDisplayed = false;
        this.newCategory = null;
    };

    handleCreateNewCategoryClick = e => {
        if (this.validateNewCategory()) {
            this.errors = []; // reset
            this.selectedCategory = [this.formatForLookup(this.newCategory)];
            this.isNewCategoryDisplayed = false;
            this.newCategory = null;
        }
    };

    alias_onChange = e => {
        this.alias = e.target.value;
    };

    name_onChange = e => {
        this.name = e.target.value;
    };

    newCategory_onChange = e => {
        this.newCategory = e.target.value;
    };

    customDomain_onChange = e => {
        this.customDomain = e.target.value;
    };

    domainType_onChange = e => {
        this.selectedDomain = e.target.value;
    };

    username_onChange = e => {
        this.username = e.target.value;
    };

    password_onChange = e => {
        this.password = e.target.value;
    };

    orgType_onChange = e => {
        this.orgType = e.target.value;
    };

    handleCredentialTypeChange = e => {
        this.credentialType = e.target.value;
    };

    redirectUrl_onChange = e => {
        this.redirectUrl = e.target.value;
    };

    /** getters */

    get credentialOptions() {
        if (isElectronApp()) {
            return [
                { label: 'OAuth (Recommended)', value: OAUTH_TYPES.OAUTH },
                { label: 'Username/Password', value: OAUTH_TYPES.USERNAME },
            ];
        }
        return [
            { label: 'OAuth (Recommended)', value: OAUTH_TYPES.OAUTH },
            { label: 'Redirect Only', value: OAUTH_TYPES.REDIRECT },
            { label: 'Username/Password', value: OAUTH_TYPES.USERNAME },
        ];
    }

    get orgType_options() {
        return Object.keys(ORG_TYPES).map(x => ({
            label: ORG_TYPES[x],
            value: ORG_TYPES[x],
        }));
    }

    get isOauth() {
        return this.credentialType === OAUTH_TYPES.OAUTH;
    }

    get isUsernamePassword() {
        return this.credentialType === OAUTH_TYPES.USERNAME;
    }

    get isRedirect() {
        return this.credentialType === OAUTH_TYPES.REDIRECT;
    }

    get categories() {
        let _connections = this.connections.map(x => x.company).filter(x => !isEmpty(x));
        if (this.selectedCategory.length > 0) {
            _connections.push(this.selectedCategory[0].id);
        }
        return [...new Set(_connections)];
    }

    get generatedAlias() {
        const category =
            this.selectedCategory?.length >= 1 ? this.selectedCategory[0].id : 'category';
        const name = isNotUndefinedOrNull(this.name) ? this.name : 'name';
        return `${category}-${name}`;
    }

    get isCustomDomainDisplayed() {
        return this.selectedDomain === domainOptions[2].value;
    }

    get loginUrl() {
        return `https://${
            this.selectedDomain === 'custom' ? this.customDomain : this.selectedDomain
        }`;
    }
}
