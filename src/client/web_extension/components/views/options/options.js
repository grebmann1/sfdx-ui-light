import { LightningElement,api} from "lwc";
import { isUndefinedOrNull,isNotUndefinedOrNull,isEmpty,normalizeString as normalize} from "shared/utils";
import { loadExtensionConfigFromCache,saveExtensionConfigToCache,CACHE_CONFIG } from "extension/utils";


export default class Options extends LightningElement {

    openAsPopup_checked = false;
    openai_key;
    openai_assistant_id;

    connectedCallback(){
        this.loadConfigFromCache();
    }
    


    /** Events **/

    handleOpenaiKey_change = (e) => {
        this.openai_key = e.detail.value;
    }

    handleOpenaiAssistantId_change = (e) => {
        this.openai_assistant_id = e.detail.value;
    }

    openAsPopup_change = (e) => {
        this.openAsPopup_checked = e.detail.checked;
    }

    handleSaveClick = async (e) => {
        await this.saveToCache();
        window.close();
    }

    handleCancelClick = (e) => {
        window.close();
    }


    /** Methods **/

    saveToCache = async () => {
        
        const config = {};
            config[CACHE_CONFIG.CONFIG_POPUP]        = this.openAsPopup_checked;
            config[CACHE_CONFIG.OPENAI_KEY]          = this.openai_key;
            config[CACHE_CONFIG.OPENAI_ASSISTANT_ID] = this.openai_assistant_id;

        // To Bulkify
        await saveExtensionConfigToCache(config)
    }

    loadConfigFromCache = async () => {
        const configuration = await loadExtensionConfigFromCache([
            CACHE_CONFIG.CONFIG_POPUP,
            CACHE_CONFIG.OPENAI_KEY,
            CACHE_CONFIG.OPENAI_ASSISTANT_ID
        ]);
        this.openAsPopup_checked    = configuration[CACHE_CONFIG.CONFIG_POPUP] || false;
        this.openai_key             = configuration[CACHE_CONFIG.OPENAI_KEY] || null;
        this.openai_assistant_id    = configuration[CACHE_CONFIG.OPENAI_ASSISTANT_ID] || null;
    }


    /** Getters **/

   
}