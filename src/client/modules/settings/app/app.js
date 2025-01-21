import { api,track,wire } from "lwc";
import ToolkitElement from 'core/toolkitElement';
import { isChromeExtension,isUndefinedOrNull, CACHE_CONFIG, loadExtensionConfigFromCache, saveExtensionConfigToCache} from "shared/utils";
import Toast from 'lightning/toast';


export default class App extends ToolkitElement {

    //openAsPopup_checked = false;
    //openai_key;
    //openai_assistant_id;
    //shortcut_recordid;
    //experienceCloudLoginAsIncognito;

    // Cache
    //isCached_enabled;
    //isCached_profiles;
    //isCached_sobjects;

    // Extension Permissions
    hasIncognitoAccess = false;

    // Config
    @track config = {};
    @track originalConfig = {};

    /** Getters **/


    get isFullIncognitoAccess() {
        return this.hasIncognitoAccess;
    }

    connectedCallback() {
        this.loadConfigFromCache();
    }

    /** Events **/

    inputfield_change = (e) => {
        const inputField = e.currentTarget;
        const config = this.config;
        if (inputField.type === 'toggle') {
            config[inputField.dataset.key] = inputField.checked;
        } else {
            config[inputField.dataset.key] = inputField.value;
        }
        this.config = null;
        this.config = config;
    }



    handleSaveClick = async (e) => {
        await this.saveToCache();
    };

    handleCancelClick = async (e) => {
        await this.loadConfigFromCache();
        //window.close();
    };

    handleClearAllClick = async (e) => {
        const configurationList = Object.values(CACHE_CONFIG);
        const config = {};
        Object.values(configurationList).forEach(item => {
            config[item.key] = item.value;
        });
        this.config = config;
        await this.saveToCache();
    }

    /** Methods **/


    saveToCache = async () => {
        const configurationList = Object.values(CACHE_CONFIG);
        const config = {};
        Object.values(configurationList).forEach(item => {
            config[item.key] = this.config[item.key];
        });
        console.log('config to save',config);


        // To Bulkify
        await saveExtensionConfigToCache(config);
        Toast.show({
            label: 'Configuration Saved',
            variant: 'success',
        });
        // we update the originalConfig
        this.originalConfig = {...config};
    };

    loadConfigFromCache = async () => {
        const cachedConfiguration = await loadExtensionConfigFromCache(Object.values(CACHE_CONFIG).map(x => x.key));
        const configurationList = Object.values(CACHE_CONFIG);
        //console.log('configurationList',configurationList);
        //console.log('cachedConfiguration',cachedConfiguration);
        const config = {};
        Object.values(configurationList).forEach(item => {
            config[item.key] = cachedConfiguration[item.key] || item.value;
        });


        this.config = config;
        this.originalConfig = {...config};

        // Chrome Only
        if(this.isChrome){
            this.hasIncognitoAccess = await chrome.extension.isAllowedIncognitoAccess();
        }
    }

    /** Getters */

    get hasChanged(){
        return JSON.stringify(this.config) != JSON.stringify(this.originalConfig);
    }

    get pageClass(){//Overwrite
        return super.pageClass+' slds-p-around_small';
    }

    get isChrome(){
        return isChromeExtension();
    }

    get isCancelDisabled(){
        return !this.hasChanged;
    }

    get isSaveDisabled(){
        return !this.hasChanged;
    }

    get isShortcutDisabled(){
        return isUndefinedOrNull(this.config) || !this.config?.shortcut_injection_enabled
    }

}