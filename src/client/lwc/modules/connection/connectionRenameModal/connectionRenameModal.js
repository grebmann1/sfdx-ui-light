import { api, track } from 'lwc';
import Toast from 'lightning/toast';
import LightningAlert from 'lightning/alert';
import LightningModal from 'lightning/modal';
import { renameConfiguration, notificationService, validateInputs } from 'connection/utils';
import {
    isEmpty,
    isNotUndefinedOrNull,
    isElectronApp,
    isChromeExtension,
    decodeError,
    checkIfPresent,
} from 'shared/utils';

const DEFAULT_CATEGORY = {
    id: 'default',
    icon: 'standard:category',
    title: 'Default',
};

const { showToast, handleError } = notificationService;

export default class OrgRenameModal extends LightningModal {
    @api orgName;
    @api username;
    @api redirectUrl;
    @api isRedirect = false;
    @api oldAlias;
    @api connections = [];

    @api
    get category() {
        return this._category;
    }
    set category(value) {
        this._category = value;
        if (this._category) {
            this.selectedCategory = [this.formatForLookup(this._category)];
        } else {
            this.selectedCategory = [];
        }
    }
    newCategory;
    isNewCategoryDisplayed = false;

    /* Group variables */
    maxSelectionSize = 2;
    @track selectedCategory = []; //[DEFAULT_CATEGORY];
    errors = [];

    newRecordOptions = [{ value: 'Category', label: 'New Category' }];

    connectedCallback() {
        window.setTimeout(() => {
            this.initLookupDefaultResults();
        }, 1);
    }

    /** Methods **/

    initLookupDefaultResults() {
        // Make sure that the lookup is present and if so, set its default results
        const lookup = this.template.querySelector('slds-lookup');
        if (lookup) {
            lookup.setDefaultResults(this.categories.map(x => this.formatForLookup(x)));
        }
    }

    closeModal() {
        this.close();
    }

    validateForm = () => {
        let isValid = validateInputs(this.template, '.input-to-validate');
        // Categories
        if (this.isNewCategoryDisplayed && this.refs.newCategory) {
            this.refs.newCategory.setCustomValidity('Confirm the new Category');
            this.refs.newCategory.reportValidity();
            isValid = false;
        }
        return isValid;
    };

    renameAlias = async () => {
        await renameConfiguration({
            newAlias: this.generatedAlias,
            oldAlias: this.oldAlias,
            username: this.username,
            redirectUrl: this.redirectUrl,
        });
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

    notifyUser(title, message, variant) {
        showToast({ label: title, message, variant });
    }

    validateNewCategory = () => {
        let isValid = true;
        // Default
        let inputFields = this.template.querySelectorAll('.new-category-to-validate');
        inputFields.forEach(inputField => {
            if (!inputField.checkValidity()) {
                inputField.reportValidity();
                isValid = false;
            }
        });

        return isValid;
    };

    /** events **/

    handleCloseClick() {
        this.close();
    }

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
        this.newCategory = this.refs.category.searchTerm;
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
            this.errors = []; // reset
            this.selectedCategory = [this.formatForLookup(this.newCategory)];
            this.isNewCategoryDisplayed = false;
            this.newCategory = null;
        }
    };

    async handleSaveClick() {
        if (this.validateForm()) {
            try {
                await this.renameAlias();
                showToast({ label: 'Alias renamed successfully!', variant: 'success' });
                this.close();
            } catch (e) {
                handleError(e, 'Rename Alias Error');
            }
        }
    }

    /** getters */

    get categories() {
        return [...new Set(this.connections.map(x => x.company).filter(x => !isEmpty(x)))];
    }

    get generatedAlias() {
        const category =
            this.selectedCategory?.length >= 1 ? this.selectedCategory[0].id : 'category';
        const name = isNotUndefinedOrNull(this.orgName) ? this.orgName : 'name';
        return `${category}-${name}`;
    }
}
