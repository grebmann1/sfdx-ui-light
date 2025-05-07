import { api, track, wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { isChromeExtension, isUndefinedOrNull } from 'shared/utils';
import {
    cacheManager,
    CACHE_CONFIG,
    getSyncedSettingsInitializedFromCache,
} from 'shared/cacheManager';
import Toast from 'lightning/toast';
import LOGGER from 'shared/logger';

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
    // Chrome Sync
    isChromeSyncSettingsEnabled = false;

    // Config
    @track config = {};
    @track originalConfig = {};
    @track contentScriptIncludePatterns = '';
    @track contentScriptExcludePatterns = '';

    isOpenAIKeyVisible = false;

    connectedCallback() {
        this.loadConfigFromCache();
    }

    /** Events **/

    chromeSyncSettings_change = async e => {
        this.isChromeSyncSettingsEnabled = e.currentTarget.checked;
        cacheManager.isChromeSyncSettingsEnabled = e.currentTarget.checked;
        if (cacheManager.isChromeSyncSettingsEnabled) {
            // reload the cache
            if (!(await getSyncedSettingsInitializedFromCache())) {
                LOGGER.log('Syncing settings', this.originalConfig);
                // If not initialized, we need to initialize the settings in the extension sync
                await cacheManager.saveConfig(this.originalConfig);
                cacheManager.isChromeSyncSettingsInitialized = true;
            }
            this.loadConfigFromCache();
        }
    };

    inputfield_change = e => {
        const inputField = e.currentTarget;
        const config = this.config;
        if (inputField.type === 'toggle') {
            config[inputField.dataset.key] = inputField.checked;
        } else {
            config[inputField.dataset.key] = inputField.value;
        }
        this.config = null;
        this.config = config;
    };

    handleSaveClick = async e => {
        await this.saveToCache();
    };

    handleCancelClick = async e => {
        await this.loadConfigFromCache();
        //window.close();
    };

    handleClearAllClick = async e => {
        const configurationList = Object.values(CACHE_CONFIG);
        const config = {};
        Object.values(configurationList).forEach(item => {
            config[item.key] = item.value;
        });
        this.config = config;
        await this.saveToCache();
    };

    handleToggleVisibility = e => {
        e.preventDefault();
        let isVisible = e.currentTarget.dataset.isVisible !== 'true'; // toggle the visibility
        this.template.querySelector('lightning-input[data-key="openai_key"]').type = isVisible
            ? 'text'
            : 'password';
        // update the button
        e.currentTarget.dataset.isVisible = isVisible;
        e.currentTarget.iconName = isVisible ? 'utility:hide' : 'utility:preview';
    };

    handleResetPatternsClick = () => {
        // Ask background for the default patterns
        if (this.isChrome && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: 'getDefaultContentScriptPatterns' }, response => {
                if (response && response.includePatterns && response.excludePatterns) {
                    this.config.content_script_include_patterns =
                        response.includePatterns.join('\n');
                    this.config.content_script_exclude_patterns =
                        response.excludePatterns.join('\n');
                    this.config = { ...this.config };
                }
            });
        }
    };

    /** Methods **/

    saveToCache = async () => {
        const configurationList = Object.values(CACHE_CONFIG);
        const config = {};
        Object.values(configurationList).forEach(item => {
            config[item.key] = this.config[item.key];
        });
        // Use the new CacheManager to save config
        await cacheManager.saveConfig(config);
        Toast.show({
            label: 'Configuration Saved',
            variant: 'success',
        });
        // we update the originalConfig
        this.originalConfig = { ...config };
    };

    loadConfigFromCache = async () => {
        // Use the new CacheManager to load config
        const cachedConfiguration = await cacheManager.loadConfig(
            Object.values(CACHE_CONFIG).map(x => x.key)
        );

        const configurationList = Object.values(CACHE_CONFIG);
        const config = {};
        Object.values(configurationList).forEach(item => {
            config[item.key] = cachedConfiguration[item.key] || item.value;
        });

        this.config = config;
        this.originalConfig = { ...config };
        console.log('config', config);

        // Chrome Only
        if (this.isChrome) {
            this.hasIncognitoAccess = await chrome.extension.isAllowedIncognitoAccess();
            this.isChromeSyncSettingsEnabled = cacheManager.isChromeSyncSettingsEnabled; // Manually added to the cacheManager
        }
    };

    /** Getters */

    get openaiKeyInputType() {
        return this.isOpenAIKeyVisible ? 'text' : 'password';
    }

    get hasChanged() {
        return JSON.stringify(this.config) != JSON.stringify(this.originalConfig);
    }

    get pageClass() {
        //Overwrite
        return super.pageClass + ' slds-p-around_small';
    }

    get isChrome() {
        return isChromeExtension();
    }

    get isCancelDisabled() {
        return !this.hasChanged;
    }

    get isSaveDisabled() {
        return !this.hasChanged;
    }

    get isShortcutDisabled() {
        return isUndefinedOrNull(this.config) || !this.config?.shortcut_injection_enabled;
    }

    get isFullIncognitoAccess() {
        return this.hasIncognitoAccess;
    }
}
