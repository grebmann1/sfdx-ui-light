import LightningAlert from 'lightning/alert';
import LightningModal from 'lightning/modal';
import { api,track } from "lwc";
import { extractConfig,connect } from 'connection/utils';
import { isEmpty,isElectronApp,classSet,isUndefinedOrNull,isNotUndefinedOrNull,runActionAfterTimeOut,formatFiles,sortObjectsByField,removeDuplicates } from 'shared/utils';

export default class ConnectionImportModal extends LightningModal {

    @api newAlias;
    @api oldAlias;
    @api username;

    originalSize = 0;

    @track newConnections = [];


    /** Methods  **/

    extractConfig = (value) => {
        const textAreaCmp = this.template.querySelector('lightning-textarea');
            textAreaCmp.setCustomValidity('');
        
        try{
            const config = JSON.parse(value);
            // Setup
            this.newConnections = [];
            this.originalSize = config.length;
            // Processing
            config.forEach(item => {
                const params = extractConfig(item.sfdxAuthUrl);
                if(!params.instanceUrl.startsWith('http')){
                    params.instanceUrl = `https://${params.instanceUrl}`;
                }
                const newConn = {
                    ...params,
                    alias:item.alias,
                };
                if(newConn.alias && newConn.refreshToken && newConn.instanceUrl){
                    this.newConnections.push(newConn);
                }
            });
            
        }catch(e){
            console.error(e);
            textAreaCmp.setCustomValidity(e.name);
        }

        textAreaCmp.reportValidity();
    }

    getOauthForNewConnections = async () => {
        return await Promise.all(this.newConnections.map(async settings => {
            const config = {
                settings,
                disableEvent:true,
                directStorage:true
            };

             return await connect(config);
        }))
    }



    

    /** events **/
    handleChange = (e) => {
        //console.log('handleChange');
        this.extractConfig(e.detail.value);
    }

    handleCloseClick = () => {
        this.close();
    }

    closeModal = () =>  {
        this.close();
    }

    handleSaveClick = async () => {
        try{
            const connectors = await this.getOauthForNewConnections();
            console.log('connectors',connectors);
            this.close('success');
        }catch(e){
            console.error(e);
        }
        
    }

    /** Getters */

    get resultMessage(){
        return `${this.newConnections.length}/${this.originalSize} new connections will be added !`;
    }

    get isResultDisplayed(){
        return isNotUndefinedOrNull(this.newConnections) && this.newConnections.length > 0;
    }

}