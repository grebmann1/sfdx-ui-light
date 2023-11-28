import LightningAlert from 'lightning/alert';
import LightningModal from 'lightning/modal';
import {addConnection,connect} from 'connection/utils';
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
        if(isElectronApp()){
            this.electron_connect();
        }else{
            this.web_connect();
        }
        
    }

    electron_connect = async () => {
        
        let params = {
            alias: this.alias,
            instanceurl: this.selectedDomain === 'custom'?this.customDomain:this.selectedDomain
        };
        try{
            const {error, res} = await window.electron.ipcRenderer.invoke('org-createNewOrgAlias',params);
            if (error) {
                throw decodeError(error);
            }
            let connection = res;
            await connect({connection});
            this.close({alias:this.alias,connection});
        }catch(e){
            await LightningAlert.open({
                message: e.message,
                theme: 'error', // a red theme intended for error states
                label: 'Error!', // this is the header text
            });
        }
    }

    web_connect = async () => {
        console.log('web_connect');
        window.jsforce.browser.login({
                loginUrl:this.selectedDomain === 'custom'?this.customDomain:this.selectedDomain,
                version:process.env.VERSION || '55.0',
                scope:'id api web openid sfap_api refresh_token'
            },(_,res) => {
                console.log('status',res.status);
                if(res.status === 'cancel'){
                    this.close(null)
                }
            }
        );
        window.jsforce.browser.on('connect', async (connection) =>{
            console.log('connection',connection); // refresh_token
            const {accessToken,instanceUrl,loginUrl,refreshToken,version} = connection;
            let nameArray = this.alias.split('-');
            let companyName = nameArray.length > 1 ?nameArray.shift() : '';
            let name = nameArray.join('-');
            let data = {
                accessToken,instanceUrl,loginUrl,refreshToken,version,
                id:this.alias,
                alias:this.alias,
                company:companyName.toUpperCase(),
                name:name,
                sfdxAuthUrl:instanceUrl+'/secur/frontdoor.jsp?sid='+accessToken,
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