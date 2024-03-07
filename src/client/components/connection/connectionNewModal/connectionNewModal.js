import LightningAlert from 'lightning/alert';
import LightningModal from 'lightning/modal';
import {addConnection,connect,oauth} from 'connection/utils';
import {isNotUndefinedOrNull,isElectronApp,decodeError} from "shared/utils";

const domainOptions = [
    { id: 'prod',   label: 'login.salesforce.com', value: 'https://login.salesforce.com' },
    { id: 'test',   label: 'test.salesforce.com', value: 'https://test.salesforce.com' },
    { id: 'custom', label: 'custom domain', value: 'custom' }
];


export default class ConnectionNewModal extends LightningModal {

    domain_options = domainOptions;
    customDomain;

    selectedDomain  = domainOptions[0].value;
    isLoading = false;
    alias;


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


    /** Methods **/

    reset = () => {
        this.alias = null;
        this.selectedDomain  = domainOptions[0].value;
    }



    closeModal() {
        this.close();
    }

    connect = async () => {
        this.isLoading = true;
        if(isElectronApp()){
            this.electron_oauth();
        }else{
            this.web_oauth();
        }
        
    }

    electron_oauth = async () => {
        console.log('electron_oauth');
        let params = {
            alias: this.alias,
            instanceurl: this.selectedDomain === 'custom'?this.customDomain:this.selectedDomain
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

    web_oauth = async () => {
            oauth({
                alias:this.alias,
                loginUrl:this.selectedDomain === 'custom'?this.customDomain:this.selectedDomain
            },(res) => {
                this.close(res);
            });
    }








    /** events **/

    handleCloseClick = (e) => {
        this.close();
    }

    handleLoginClick = async (e) =>  {
        if (this.validateForm()) {
            await this.connect()
        }
    }

    alias_onChange = (e) => {
        this.alias = e.target.value;
    }

    customDomain_onChange = (e) => {
        this.customDomain = e.target.value;
    }

    domainType_onChange = (e) => {
        this.selectedDomain = e.target.value;
    }


    /** getters */

    get isCustomDomainDisplayed(){
        return this.selectedDomain === domainOptions[2].value;
    }


}