import LightningModal from 'lightning/modal';
import { api } from "lwc";
import { isUndefinedOrNull } from 'shared/utils';

export default class SaveModal extends LightningModal {
    @api title;
    @api maxLength = 50;
    @api name = ''; // Used for direct update



    connectedCallback(){

    }

    handleCloseClick() {
        //this.close('canceled');
		this.close();
    }

    closeModal() {
        this.close();
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
		this.close(data);
	}
    

}