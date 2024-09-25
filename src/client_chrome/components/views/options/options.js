import {LightningElement} from "lwc";
import {CACHE_CONFIG, loadExtensionConfigFromCache, saveExtensionConfigToCache} from "extension/utils";
import Toast from 'lightning/toast';


export default class Options extends LightningElement {

    openAsPopup_checked = false;
    openai_key;
    openai_assistant_id;
    shortcut_recordid;
    shortcut_enabled;
    experienceCloudLoginAsIncognito;

    // Extension Permissions
    hasIncognitoAccess = false;

    /** Getters **/

    get isShortcutDisabled() {
        return !this.shortcut_enabled;
    }

    get isFullIncognitoAccess() {
        return this.hasIncognitoAccess;
    }

    connectedCallback() {
        this.loadConfigFromCache();
    }

    /** Events **/

    handleOpenaiKey_change = (e) => {
        this.openai_key = e.detail.value;
    };

    handleOpenaiAssistantId_change = (e) => {
        this.openai_assistant_id = e.detail.value;
    };

    handleShortcutRecordid_change = (e) => {
        this.shortcut_recordid = e.detail.value;
    };

    openAsPopup_change = (e) => {
        this.openAsPopup_checked = e.detail.checked;
    };

    handleShortcutEnabled_change = (e) => {
        this.shortcut_enabled = e.detail.checked;
    };

    handleExperienceCloudLoginAsIncognito_change = (e) => {
        this.experienceCloudLoginAsIncognito = e.detail.checked;
    };

    handleSaveClick = async (e) => {
        await this.saveToCache();

    };

    handleCancelClick = async (e) => {
        await this.loadConfigFromCache();
        //window.close();
    };

    /** Methods **/


    saveToCache = async () => {

        const config = {};
        config[CACHE_CONFIG.CONFIG_POPUP] = this.openAsPopup_checked;
        config[CACHE_CONFIG.OPENAI_KEY] = this.openai_key;
        config[CACHE_CONFIG.OPENAI_ASSISTANT_ID] = this.openai_assistant_id;
        config[CACHE_CONFIG.SHORTCUT_RECORDID] = this.shortcut_recordid;
        config[CACHE_CONFIG.SHORTCUT_INJECTION_ENABLED] = this.shortcut_enabled;
        config[CACHE_CONFIG.EXPERIENCE_CLOUD_LOGINAS_INCOGNITO] = this.experienceCloudLoginAsIncognito;


        // To Bulkify
        await saveExtensionConfigToCache(config);
        Toast.show({
            label: 'Configuration Saved',
            variant: 'success',
        });
        window.setTimeout(() => {
            window.close();
        }, 1500);
    };

    loadConfigFromCache = async () => {
        const configuration = await loadExtensionConfigFromCache([
            CACHE_CONFIG.CONFIG_POPUP,
            CACHE_CONFIG.OPENAI_KEY,
            CACHE_CONFIG.OPENAI_ASSISTANT_ID,
            CACHE_CONFIG.SHORTCUT_RECORDID,
            CACHE_CONFIG.SHORTCUT_INJECTION_ENABLED,
            CACHE_CONFIG.EXPERIENCE_CLOUD_LOGINAS_INCOGNITO

        ]);
        this.hasIncognitoAccess = await chrome.extension.isAllowedIncognitoAccess();

        this.openAsPopup_checked = configuration[CACHE_CONFIG.CONFIG_POPUP] || false;
        this.openai_key = configuration[CACHE_CONFIG.OPENAI_KEY] || null;
        this.openai_assistant_id = configuration[CACHE_CONFIG.OPENAI_ASSISTANT_ID] || null;
        this.shortcut_recordid = configuration[CACHE_CONFIG.SHORTCUT_RECORDID] || null;
        this.shortcut_enabled = configuration[CACHE_CONFIG.SHORTCUT_INJECTION_ENABLED] || false;
        this.experienceCloudLoginAsIncognito = configuration[CACHE_CONFIG.EXPERIENCE_CLOUD_LOGINAS_INCOGNITO] || false;
    }

}