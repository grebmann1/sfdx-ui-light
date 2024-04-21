import { LightningElement,api} from "lwc";
import { isUndefinedOrNull,isNotUndefinedOrNull,isEmpty,normalizeString as normalize} from "shared/utils";
import { loadExtensionConfigFromCache } from "extension/utils";

const CONFIG_POPUP = 'openAsPopup';

export default class Options extends LightningElement {

    openAsPopup_checked = false;

    connectedCallback(){
        this.loadConfigFromCache();
    }
    


    /** Events **/

    openAsPopup_change = (e) => {
        this.openAsPopup_checked = e.detail.checked;
    }

    handleSaveClick = async (e) => {
        await this.saveToCache();
        //window.close();
    }

    handleCancelClick = (e) => {
        window.close();
    }


    /** Methods **/

    saveToCache = async () => {
        
        const configuration = {
            openAsPopup:this.openAsPopup_checked
        };
        await window.defaultStore.setItem(CONFIG_POPUP,configuration[CONFIG_POPUP]);
    }

    loadConfigFromCache = async () => {
        const configuration = await loadExtensionConfigFromCache([CONFIG_POPUP]);
        this.openAsPopup_checked = configuration[CONFIG_POPUP] || false;
    }


    /** Getters **/

   
}