import { api, track } from 'lwc';
import Toast from 'lightning/toast';
import LightningAlert from 'lightning/alert';
import LightningModal from 'lightning/modal';
import {
    setRedirectCredential,
    getSalesforceURL,
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

const ORGFARM_CATEGORY = {
    id: 'orgfarm',
    icon: 'standard:category',
    title: 'OrgFarm',
};

const ORGFARM_PASSWORD = 'orgfarm1234';

const isOrgFarmString = value =>
    typeof value === 'string' && value.toLowerCase().includes(ORGFARM_CATEGORY.id);

// Supports:
// - orgfarm-023232023
// - orgfarm-029f24a5d9
// - orgfarm_029f24a5d9
// Stops at first non [a-z0-9] char (e.g. '.', ':', '/', '@')
const ORGFARM_ID_REGEX = /orgfarm[-_\s]?([a-z0-9]+)/i;

const extractOrgFarmId = value => {
    if (typeof value !== 'string') return null;
    const match = value.match(ORGFARM_ID_REGEX);
    const raw = match?.[1];
    return raw ? raw.trim() : null;
};

const isOrgFarmId = value => typeof value === 'string' && /^[a-z0-9]+$/i.test(value.trim());

const generateOrgFarmNumericId = () => {
    // 9 digits, left-padded with zeros: 000000000 - 999999999
    const n = Math.floor(Math.random() * 1_000_000_000);
    return String(n).padStart(9, '0');
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
    @api credentialType = OAUTH_TYPES.OAUTH;

    newCategory;
    orgType = ORG_TYPES.PRODUCTION;
    orgFarmGeneratedId;

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
        // Apply OrgFarm defaults for prefilled values (if any).
        window.setTimeout(() => this.applyOrgFarmDefaultsIfNeeded(), 1);
    }

    /** Methods **/

    applyOrgFarmDefaultsIfNeeded() {
        const categoryId = this.selectedCategory?.[0]?.id;
        const categoryTitle = this.selectedCategory?.[0]?.title;

        const isOrgFarm =
            isOrgFarmString(this.username) ||
            isOrgFarmString(this.customDomain) ||
            isOrgFarmString(this.name) ||
            isOrgFarmString(categoryId) ||
            isOrgFarmString(categoryTitle);

        if (!isOrgFarm) return;

        // Default category to OrgFarm only when still on default/empty category.
        // Also normalize case/format if category is already some variant of OrgFarm.
        if (!categoryId || categoryId === DEFAULT_CATEGORY.id || isOrgFarmString(categoryId)) {
            this.selectedCategory = [ORGFARM_CATEGORY];
            this.syncLookupSelection();
        }

        // Normalize name to just the numeric OrgFarm id so alias becomes: orgfarm-XXXXXXXXX
        // - If user typed `orgfarm-023...`, keep `023...`
        // - If name is empty, try to infer from username/domain
        const nameMatch = typeof this.name === 'string' ? this.name.match(ORGFARM_ID_REGEX) : null;
        if (nameMatch?.[1]) {
            this.name = nameMatch[1];
        } else if (!isOrgFarmId(this.name)) {
            const inferredId =
                extractOrgFarmId(this.username) ||
                extractOrgFarmId(this.customDomain) ||
                null;

            if (inferredId) {
                this.name = inferredId;
            } else {
                this.orgFarmGeneratedId = this.orgFarmGeneratedId || generateOrgFarmNumericId();
                this.name = this.orgFarmGeneratedId;
            }
        }

        // Password is always the same for OrgFarm (when using Username/Password).
        if (this.isUsernamePassword) {
            this.password = ORGFARM_PASSWORD;
        }
    }

    syncLookupSelection() {
        if (this.isNewCategoryDisplayed) return;
        const lookup = this.refs?.category || this.template.querySelector('slds-lookup');
        if (lookup) {
            lookup.selection = this.selectedCategory;
        }
    }

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
                    this.customDomain = getSalesforceURL(_url.host);
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
            if (isElectronApp()) {
                this.electron_usernamePassword();
            } else {
                this.standard_usernamePassword();
            }
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

    electron_usernamePassword = async () => {
        try {
            const connector = await credentialStrategies.USERNAME.directConnect(
                {
                    username: this.username,
                    password: this.password,
                    loginUrl: this.loginUrl,
                    alias: this.alias,
                },
                { saveFullConfiguration: false }
            );
            const result = await window.electron.invoke('org-setStoredOrg', {
                alias: this.alias,
                configuration: connector.configuration,
            });
            LOGGER.log('electron_usernamePassword', result);
            showToast({ label: 'Connected successfully!', variant: 'success' });
            this.close(result);
        } catch (e) {
            LOGGER.error('electron_usernamePassword error', e);
            handleError(e, 'Username/Password Error');
            this.close(null);
        }
    }

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
        const normalizedUrl = getSalesforceURL(this.loginUrl);
        let params = {
            alias: this.alias,
            instanceurl: normalizedUrl,
        };
        try {
            const { error, res } = await window.electron.invoke(
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
        const normalizedItem =
            typeof item === 'string' && item.toLowerCase() === ORGFARM_CATEGORY.id
                ? ORGFARM_CATEGORY.id
                : item;

        return {
            id: normalizedItem,
            icon: 'standard:category',
            title: normalizedItem === ORGFARM_CATEGORY.id ? ORGFARM_CATEGORY.title : normalizedItem,
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
        this.applyOrgFarmDefaultsIfNeeded();
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
        this.applyOrgFarmDefaultsIfNeeded();
    };

    newCategory_onChange = e => {
        this.newCategory = e.target.value;
    };

    customDomain_onChange = e => {
        this.customDomain = e.target.value;
        this.applyOrgFarmDefaultsIfNeeded();
    };

    domainType_onChange = e => {
        this.selectedDomain = e.target.value;
        this.applyOrgFarmDefaultsIfNeeded();
    };

    username_onChange = e => {
        this.username = e.target.value;
        this.applyOrgFarmDefaultsIfNeeded();
    };

    password_onChange = e => {
        this.password = e.target.value;
    };

    orgType_onChange = e => {
        this.orgType = e.target.value;
    };

    handleCredentialTypeChange = e => {
        this.credentialType = e.target.value;
        this.applyOrgFarmDefaultsIfNeeded();
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
        const normalized = _connections.map(x =>
            typeof x === 'string' && x.toLowerCase() === ORGFARM_CATEGORY.id ? ORGFARM_CATEGORY.id : x
        );
        return [...new Set(normalized)];
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
