import LightningAlert from 'lightning/alert';
import LightningModal from 'lightning/modal';
import {decodeError} from 'shared/utils';
const domainOptions = [
	{ id: 'prod',   label: 'login.salesforce.com', value: 'https://login.salesforce.com' },
	{ id: 'test',   label: 'test.salesforce.com', value: 'https://test.salesforce.com' },
	{ id: 'custom', label: 'custom domain', value: 'custom' }
];

export default class NewOrgModal extends LightningModal {
    saveInProcess = false;
    domain_options = domainOptions;

    alias;
    customDomain;
    domainType  = domainOptions[0].value;


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

    createNewOrgAlias = async () => {
        console.log('createNewOrgAlias');
        let params = {
            alias: this.alias,
            instanceurl: this.domainType === 'custom'?this.customDomain:this.domainType
        };
        console.log('params',params);
        try{
            const {error, res} = await window.electron.ipcRenderer.invoke('org-createNewOrgAlias',params);
            if (error) {
                throw decodeError(error);
            }else{
                this.closeModal();
            }
        }catch(e){
            await LightningAlert.open({
                message: e.message,
                theme: 'error', // a red theme intended for error states
                label: 'Error!', // this is the header text
            });
        }
        
    }
  


    handleCloseClick() {
        this.close('canceled');
    }

    closeModal() {
        this.close('success');
    }

    async handleSaveClick() {
        if (this.validateForm()) {
            this.disableClose = true;
            await this.createNewOrgAlias();
        } else {
            this.disableClose = false;
        }
    }

    /** events **/

    alias_onChange = (e) => {
        this.alias = e.target.value;
    }

    customDomain_onChange = (e) => {
        this.customDomain = e.target.value;
    }

    domainType_onChange = (e) => {
        this.domainType = e.target.value;
    }


    /** getters */

    get isCustomDomainDisplayed(){
        return this.domainType == domainOptions[2].value;
    }


}