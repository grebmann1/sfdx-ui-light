import LightningAlert from 'lightning/alert';
import LightningModal from 'lightning/modal';
import { api } from "lwc";
import {renameConnection} from 'connection/utils';

export default class OrgRenameModal extends LightningModal {

    @api alias;
    @api row;


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
        await renameConnection(this.row.alias,this.alias);
    }



    handleCloseClick() {
        this.close();
    }

    closeModal() {
        this.close();
    }

    async handleSaveClick() {
        if (this.validateForm()) {
            await this.renameAlias();
            this.close();
        }
    }

    /** events **/

    alias_onChange = (e) => {
        this.alias = e.target.value;
    }

}