import LightningModal from 'lightning/modal';
import {addConnection} from 'connection/utils';
import {isNotUndefinedOrNull} from "shared/utils";

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

    connectedCallback(){
        console.log('ConnectionNewModal-connectedCallback',this.alias);
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
        window.jsforce.browser.login({loginUrl:this.selectedDomain === 'custom'?this.customDomain:this.selectedDomain});
        window.jsforce.browser.on('connect', async (connection) =>{
            const {accessToken,instanceUrl,loginUrl,refreshToken,version} = connection;

            let data = {
                accessToken,instanceUrl,loginUrl,refreshToken,version,
                id:this.alias,
                alias:this.alias,
                company:`${this.alias.split('-').length > 1?this.alias.split('-').shift():''}`.toUpperCase(),
                name:this.alias.split('-').pop(),
                sfdxAuthUrl:instanceUrl+'/secur/frontdoor.jsp?sid='+accessToken
            };

            /** Get Username **/
            let identity = await connection.identity();
            console.log('identity',identity);
            if(isNotUndefinedOrNull(identity)){
                data.username = identity.username;
                data.orgId    = identity.organization_id;
                data.userInfo = identity;
            }



            console.log('data',data);
            await addConnection(data,connection);

            this.close({alias:this.alias,connection});
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