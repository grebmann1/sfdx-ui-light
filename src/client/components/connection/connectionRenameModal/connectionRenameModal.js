import { api,track } from "lwc";
import Toast from 'lightning/toast';
import LightningAlert from 'lightning/alert';
import LightningModal from 'lightning/modal';
import {renameConnection} from 'connection/utils';
import { isNotUndefinedOrNull,isElectronApp,isChromeExtension,decodeError,checkIfPresent } from "shared/utils";


const DEFAULT_CATEGORY = {
    id: 'default',
    icon: 'standard:category',
    title: 'Default'
}

export default class OrgRenameModal extends LightningModal {

    @api orgName;
    @api username;
    @api oldAlias;
    @api connections = [];

    @api
    get category(){
        return this._category;
    }
    set category(value){
        this._category = value;
        if(this._category){
            this.selectedCategory = [
                this.formatForLookup(this._category)
            ];
        }else{
            this.selectedCategory = [];
        }
        
    }
    newCategory;
    isNewCategoryDisplayed = false;

    /* Group variables */
    maxSelectionSize = 2;
    @track selectedCategory = [];//[DEFAULT_CATEGORY];
    errors = [];
    
    newRecordOptions = [
        { value: 'Category', label: 'New Category' }
    ];

    connectedCallback() {
        window.setTimeout(()=>{
            this.initLookupDefaultResults();
        },1)
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
        let isValid = true;
        let inputFields = this.template.querySelectorAll('.input-to-validate');
        inputFields.forEach(inputField => {
            if(!inputField.checkValidity()) {
                inputField.reportValidity();
                isValid = false;
            }
        });
        return isValid;
    }

    renameAlias = async () => {
        await renameConnection({
            newAlias:this.generatedAlias,
            oldAlias:this.oldAlias,
            username:this.username
        });
    }

    checkForErrors() {
        this.errors = [];
        const selection = this.template.querySelector('slds-lookup').getSelection();
        this.selectedCategory = selection;
        // Enforcing required field
        if (selection.length === 0) {
            this.errors.push({ message: 'Please make a selection.' });
        }
    }

    formatForLookup = (item) => {
        return {
            id: item,
            icon: 'standard:category',
            title: item
        };
    }

    notifyUser(title, message, variant) {
        Toast.show({
            label:title,
            message,
            variant
        });
    }

    

    /** events **/

    handleCloseClick() {
        this.close();
    }

    alias_onChange = (e) => {
        this.newAlias = e.target.value;
    }

    name_onChange = (e) => {
        this.orgName = e.target.value;
    }

    newCategory_onChange = (e) => {
        this.newCategory = e.target.value;
    }

    handleLookupSearch = async (event) =>{
        const lookupElement = event.target;
        // Call Apex endpoint to search for records and pass results to the lookup
        try {
            const keywords = event.detail.rawSearchTerm;
            const results = this.categories.filter(x => checkIfPresent(x,keywords)).map(x => this.formatForLookup(x));
            lookupElement.setSearchResults(results);
        } catch (error) {
            this.notifyUser('Lookup Error', 'An error occurred while searching with the lookup field.', 'error');
            // eslint-disable-next-line no-console
            console.error('Lookup error', JSON.stringify(error));
            this.errors = [error];
        }
    }

    handleLookupSelectionChange = (event) => {
        this.checkForErrors();
    }

    handleLookupNewRecordSelection = (event) => {
        this.isNewCategoryDisplayed = true;
        window.setTimeout(() => {
            this.template.querySelector('.new-category-to-validate')?.focus();
        })
    }
    handleCancelNewCategoryClick = (e) => {
        this.isNewCategoryDisplayed = false;
        this.newCategory = null;
    }
    handleCreateNewCategoryClick = (e) => {
        if(this.validateNewCategory()){
            this.selectedCategory = [
                this.formatForLookup(this.newCategory)
            ];
            this.isNewCategoryDisplayed = false;
            this.newCategory = null;
        }
    }

    async handleSaveClick() {
        if (this.validateForm()) {
            await this.renameAlias();
            this.close();
        }
    }

     /** getters */

     get categories(){
        return [...new Set(this.connections.map(x => x.company))];
    }

    get generatedAlias(){
        const category = this.selectedCategory?.length >= 1 ? this.selectedCategory[0].id : 'category';
        const name = isNotUndefinedOrNull(this.orgName) ? this.orgName : 'name';
        return `${category}-${name}`;
    }
}