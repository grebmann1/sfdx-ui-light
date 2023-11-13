import LightningAlert from 'lightning/alert';
import LightningModal from 'lightning/modal';
import { api } from "lwc";


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

    setAlias = async () => {
        try{
            const {error, res} = await window.electron.ipcRenderer.invoke('org-setAlias',{
                alias: this.alias,
                username: this.row.username
            });
            if (error) {
                throw decodeError(error);
            }else{
                this.disableClose = false;
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
            await this.renameAlias();
        } else {
            this.disableClose = false;
        }
    }

    /** events **/

    alias_onChange = (e) => {
        this.alias = e.target.value;
    }

}