import { api,track } from "lwc";
import Toast from 'lightning/toast';
import LightningAlert from 'lightning/alert';
import LightningModal from 'lightning/modal';
import { oauth,oauth_chrome } from 'connection/utils';
import { isNotUndefinedOrNull,isElectronApp,isChromeExtension,decodeError,checkIfPresent } from "shared/utils";

const domainOptions = [
    { id: 'prod',   label: 'login.salesforce.com', value: 'login.salesforce.com' },
    { id: 'test',   label: 'test.salesforce.com', value: 'test.salesforce.com' },
    { id: 'custom', label: 'custom domain', value: 'custom' }
];

const DEFAULT_CATEGORY = {
    id: 'default',
    icon: 'standard:category',
    title: 'Default'
}


export default class ConnectionNewModal extends LightningModal {

    isLoading = false;
    domain_options = domainOptions;

    @api customDomain;
    @api selectedDomain  = domainOptions[0].value;
    @api alias;
    @api connections = [];

    name;
    category;
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

    reset = () => {
        this.alias = null;
        this.selectedDomain  = domainOptions[0].value;
    }

    validateForm = () => {
        let isValid = true;
        // Default
        let inputFields = this.template.querySelectorAll('.input-to-validate');
            inputFields.forEach(inputField => {
                if(!inputField.checkValidity()) {
                    inputField.reportValidity();
                    isValid = false;
                }
            });
        // Custom Domain
        const domainToValidate = this.template.querySelector('.domain-to-validate');
        if(domainToValidate){
            if(isNotUndefinedOrNull(domainToValidate.value) && domainToValidate.value.startsWith('http')){
                try{
                    const _url = new URL(domainToValidate.value);
                    this.customDomain = this.processHost(_url.host);
                    

                }catch(e){
                    domainToValidate.setCustomValidity('Don\'t include the protocol');
                    isValid = false;
                }
            }else{
                domainToValidate.setCustomValidity('');
            }
            domainToValidate.reportValidity();
        }
        
        return isValid;
    }

    processHost = (host) => {
        const SALESFORCE_HOST = 'my.salesforce.com';
        if(!host.endsWith(SALESFORCE_HOST)){
            const baseHost = host.split('.')[0];
            if(baseHost.includes('--')){
                // Sandbox
                host = `${baseHost}.sandbox.my.salesforce.com`
            }else{
                host = `${baseHost}.my.salesforce.com`;
            }
        }
        return host;
    }

    validateNewCategory = () => {
        let isValid = true;
        // Default
        let inputFields = this.template.querySelectorAll('.new-category-to-validate');
            inputFields.forEach(inputField => {
                if(!inputField.checkValidity()) {
                    inputField.reportValidity();
                    isValid = false;
                }
            });
        
        return isValid;
    }



    closeModal() {
        this.close();
    }

    connect = async () => {
        this.isLoading = true;
        if(isElectronApp()){
            this.electron_oauth();
        }else if(isChromeExtension()){
            this.chrome_oauth();
        }else{
            this.web_oauth();
        }
        
    }

    electron_oauth = async () => {
        console.log('electron_oauth');
        let params = {
            alias: this.alias,
            instanceurl: this.loginUrl
        };
        try{
            const {error, res} = await window.electron.ipcRenderer.invoke('org-createNewOrgAlias',params);
            if (error) {
                throw decodeError(error);
            }

            window.electron.listener_on('oauth',(value) => {
                if(value.action === 'done' || value.action === 'exit'){
                    window.electron.listener_off('oauth');
                    setTimeout(() => {
                        console.log('close connection');
                        this.close(value.data);
                    }, 1000);
                    
                }else if(value.action === 'error'){
                    throw decodeError(value.error);
                }
            })
            
        }catch(e){
            console.log('error',e);
            this.close();
            await LightningAlert.open({
                message: e.message,
                theme: 'error', // a red theme intended for error states
                label: 'Error!', // this is the header text
            });
        }
    }
    
    chrome_oauth = async () => {
        console.log('chrome_oauth');
        oauth_chrome({
            alias:this.alias,
            loginUrl:this.loginUrl
        },(res) => {
            console.log('chrome_oauth',res);
            this.close(res);
        });
        
    }

    web_oauth = async () => {
        oauth({
            alias:this.alias,
            loginUrl:this.loginUrl
        },(res) => {
            console.log('web_oauth',res);
            this.close(res);
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

    handleCloseClick = (e) => {
        this.close();
    }

    handleLoginClick = async (e) =>  {
        if (this.validateForm()) {
            this.alias = this.generatedAlias; // Automatically generated from the Category & Name
            await this.connect();
        }
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

    alias_onChange = (e) => {
        this.alias = e.target.value;
    }
    
    name_onChange = (e) => {
        this.name = e.target.value;
    }

    newCategory_onChange = (e) => {
        this.newCategory = e.target.value;
    }

    customDomain_onChange = (e) => {
        this.customDomain = e.target.value;
    }

    domainType_onChange = (e) => {
        this.selectedDomain = e.target.value;
    }


    /** getters */

    get categories(){
        return [...new Set(this.connections.map(x => x.company))];
    }

    get generatedAlias(){
        const category = this.selectedCategory?.length >= 1 ? this.selectedCategory[0].id : 'category';
        const name = isNotUndefinedOrNull(this.name) ? this.name : 'name';
        return `${category}-${name}`;
    }

    get isCustomDomainDisplayed(){
        return this.selectedDomain === domainOptions[2].value;
    }

    get loginUrl(){
        return `https://${this.selectedDomain === 'custom'?this.customDomain:this.selectedDomain}`;
    }


}