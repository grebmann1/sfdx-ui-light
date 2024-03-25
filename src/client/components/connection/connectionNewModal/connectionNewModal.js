import { api } from "lwc";
import LightningAlert from 'lightning/alert';
import LightningModal from 'lightning/modal';
import {oauth,oauth_chrome} from 'connection/utils';
import {isNotUndefinedOrNull,isElectronApp,isChromeExtension,decodeError} from "shared/utils";

const domainOptions = [
    { id: 'prod',   label: 'login.salesforce.com', value: 'login.salesforce.com' },
    { id: 'test',   label: 'test.salesforce.com', value: 'test.salesforce.com' },
    { id: 'custom', label: 'custom domain', value: 'custom' }
];


export default class ConnectionNewModal extends LightningModal {

    isLoading = false;
    domain_options = domainOptions;

    @api customDomain;
    @api selectedDomain  = domainOptions[0].value;
    @api alias;


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
                domainToValidate.setCustomValidity('Don\'t include the protocol');
                isValid = false;
            }else{
                domainToValidate.setCustomValidity('');
            }
            domainToValidate.reportValidity();
        }
        
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

    get loginUrl(){
        return `https://${this.selectedDomain === 'custom'?this.customDomain:this.selectedDomain}`;
    }


}