import LightningModal from 'lightning/modal';
import { api } from "lwc";

const STORAGE_TYPE = {
    GLOBAL:'Global',
    LOCAL:'Local'
}

export default class SaveModal extends LightningModal {
    @api title;
    @api fieldTitle;
    @api maxLength = 50;
    @api storage = STORAGE_TYPE.LOCAL;

    @api name = ''; // Used for direct update


    connectedCallback(){

    }

    handleCloseClick() {
        //this.close('canceled');
		this.close({action:'cancel'});
    }

    closeModal() {
        this.close({action:'cancel'});
    }

    validateForm = () => {
        let isValid = true;
        // Default
        let inputFields = this.template.querySelectorAll('.input-target');
            inputFields.forEach(inputField => {
                if(!inputField.checkValidity()) {
                    inputField.reportValidity();
                    isValid = false;
                }
            });
        
        return isValid;
    }
    
    extractFormValues = () => {
        const formData = {};
        let inputFields = this.template.querySelectorAll('.input-target');
            inputFields.forEach(inputField => {
                formData[inputField.name] = inputField.value;
            });
        return formData;
    }


    /** events **/

	handleSaveClick = (e) => {
        const isValid = this.validateForm();
        if(!isValid)return;

        const data = this.extractFormValues();
            data.isGlobal = data.storage === STORAGE_TYPE.GLOBAL;
        //console.log('data',data);
		this.close({action:'save',data});
	}

	/** Getter **/

    get storage_options(){
        return [
            {value:STORAGE_TYPE.GLOBAL,label:'All Orgs'},
            {value:STORAGE_TYPE.LOCAL, label:'Current Org Only'}
        ];
    }
    

}