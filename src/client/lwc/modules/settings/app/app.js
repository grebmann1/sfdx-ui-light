import { api, track, wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { isChromeExtension, isUndefinedOrNull, guid } from 'shared/utils';
import {
    cacheManager,
    CACHE_CONFIG,
    CACHE_SESSION_CONFIG,
    getSyncedSettingsInitializedFromCache,
    CACHE_ORG_DATA_TYPES,
} from 'shared/cacheManager';
import { getDefaultAgentSkills, getEffectiveAgentSkills } from 'shared/defaultAgentSkills';
import Toast from 'lightning/toast';
import LOGGER from 'shared/logger';
import { store, APPLICATION } from 'core/store';

export default class App extends ToolkitElement {
    //openAsPopup_checked = false;
    //openai_key;
    //openai_assistant_id;
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
    // Session Config
    @track sessionConfig = {};
    @track originalSessionConfig = {};
    // Content Script Config
    @track contentScriptIncludePatterns = '';
    @track contentScriptExcludePatterns = '';

    @track activeTab;

    isOpenAIKeyVisible = false;
    isMistralKeyVisible = false;

    // New property to track API version validity
    _isApiVersionValid = true;

    @track aiProviderOptions = [
        { label: 'OpenAI', value: 'openai' },
        { label: 'Einstein', value: 'einstein' },
    ];

    @track selectedAgentSkillId = null;

    connectedCallback() {
        this.loadConfigFromCache();
        this.activeTab = this.isUserLoggedIn ? 'session' : 'ui';
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
                // Save the session specific settings to the cache
                if (this.connector?.conn?.alias) {
                    await cacheManager.saveOrgData(
                        this.connector.conn.alias,
                        CACHE_ORG_DATA_TYPES.SESSION_SETTINGS,
                        this.sessionConfig
                    );
                }

                cacheManager.isChromeSyncSettingsInitialized = true;
            }
            this.loadConfigFromCache();
        }
    };

    // Config Input Field Change
    inputfield_change = e => {
        const inputField = e.currentTarget;
        const config = this.config;
        if (e.detail?.value !== undefined) {
            config[inputField.dataset.key] = e.detail.value;
        } else if (inputField.type === 'toggle') {
            config[inputField.dataset.key] = inputField.checked;
        } else {
            config[inputField.dataset.key] = inputField.value;
        }
        this.config = null;
        this.config = config;
    };

    // Session Input Field Change
    sessionInputfield_change = e => {
        const inputField = e.currentTarget;
        const sessionConfig = this.sessionConfig;
        sessionConfig[inputField.dataset.key] = inputField.value;
        this.sessionConfig = null;
        this.sessionConfig = sessionConfig;

        // Validate API Version input (and any other relevant fields)
        if (inputField.dataset.key === 'api_version') {
            this._isApiVersionValid = inputField.validity.valid;
        }
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
        this.template.querySelector(
            'lightning-input[data-key="' + e.currentTarget.dataset.key + '"]'
        ).type = isVisible ? 'text' : 'password';
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

    handleSetDefaultClientId = () => {
        // Default for Sforce-Call-Options client (SFDC internal), not OAuth client id
        const defaultCallOptionsClient = 'SfdcInternalQA/';
        this.sessionConfig = { ...this.sessionConfig, client_id: defaultCallOptionsClient };
    };

    handleResetClientId = e => {
        this.sessionConfig.client_id = CACHE_SESSION_CONFIG.CLIENT_ID.value;
    };

    handleResetApiVersion = e => {
        this.sessionConfig.api_version = CACHE_SESSION_CONFIG.API_VERSION.value;
    };

    handleAddAgentSkill = () => {
        const key = CACHE_CONFIG.EINSTEIN_AGENT_SKILLS.key;
        const skills = Array.isArray(this.config[key]) ? [...this.config[key]] : [];
        const newId = guid();
        skills.push({ id: newId, name: '', content: '', enabled: true });
        this.config = { ...this.config, [key]: skills };
        this.selectedAgentSkillId = newId;
    };

    handleRemoveAgentSkill = e => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.skillId;
        if (!id) return;
        const skill = this.agentSkills.find(s => s.id === id);
        if (skill?.defaultToolId) return;
        const key = CACHE_CONFIG.EINSTEIN_AGENT_SKILLS.key;
        const skills = (this.config[key] || []).filter(s => s.id !== id);
        const wasSelected = this.selectedAgentSkillId === id;
        if (wasSelected && skills.length > 0) {
            this.selectedAgentSkillId = skills[0].id;
        } else if (wasSelected) {
            this.selectedAgentSkillId = null;
        }
        this.config = { ...this.config, [key]: skills };
    };

    handleSelectAgentSkill = e => {
        const id = e.currentTarget.dataset.skillId;
        if (id) this.selectedAgentSkillId = id;
    };

    handleAgentSkillChange = e => {
        const { skillId, property } = e.currentTarget.dataset;
        if (!skillId || !property) return;
        const key = CACHE_CONFIG.EINSTEIN_AGENT_SKILLS.key;
        const skills = Array.isArray(this.config[key]) ? [...this.config[key]] : [];
        const idx = skills.findIndex(s => s.id === skillId);
        if (idx === -1) return;
        const value =
            e.currentTarget.type === 'toggle' ? e.currentTarget.checked : e.currentTarget.value;
        skills[idx] = { ...skills[idx], [property]: value };
        this.config = { ...this.config, [key]: skills };
    };

    handleResetAgentSkillsToDefault = () => {
        const key = CACHE_CONFIG.EINSTEIN_AGENT_SKILLS.key;
        const defaults = getDefaultAgentSkills();
        this.config = { ...this.config, [key]: defaults };
        this.selectedAgentSkillId = defaults.length > 0 ? defaults[0].id : null;
    };

    /** Methods **/

    sendToggleOverlayMessage = checked => {
        chrome.runtime.sendMessage({
            action: 'toggleOverlay',
            enabled: checked,
        });
    };

    saveToCache = async () => {
        const configurationList = Object.values(CACHE_CONFIG);
        const config = {};
        Object.values(configurationList).forEach(item => {
            config[item.key] = this.config[item.key];
        });
        // if the overlayEnabled is changed, send a message to the background script
        if (
            this.config[CACHE_CONFIG.OVERLAY_ENABLED.key] !==
            this.originalConfig[CACHE_CONFIG.OVERLAY_ENABLED.key]
        ) {
            LOGGER.log('overlayEnabled changed', this.config[CACHE_CONFIG.OVERLAY_ENABLED.key]);
            this.sendToggleOverlayMessage(this.config[CACHE_CONFIG.OVERLAY_ENABLED.key]);
        }
        // Use the new CacheManager to save config
        await cacheManager.saveConfig(config);
        // we update the originalConfig
        this.originalConfig = { ...config };

        // Save the session specific settings to the cache
        if (this.isUserLoggedIn) {
            const _oldOriginalSessionConfig = Object.assign({}, this.originalSessionConfig);
            await this.saveSessionConfigToCache();

            // force the connector to reload
            const apiVersionChanged =
                _oldOriginalSessionConfig.api_version !== this.originalSessionConfig.api_version;
            const clientIdChanged =
                _oldOriginalSessionConfig.client_id !== this.originalSessionConfig.client_id;
            const hasChanged = apiVersionChanged || clientIdChanged;
            if (apiVersionChanged) {
                LOGGER.log('api_version changed', this.originalSessionConfig.api_version);
                this.connector.conn.version = this.originalSessionConfig.api_version;
            }
            if (clientIdChanged) {
                LOGGER.log('client_id changed', this.originalSessionConfig.client_id);
                this.connector.conn._callOptions.client = this.originalSessionConfig.client_id;
            }
            if (hasChanged) {
                store.dispatch(
                    APPLICATION.reduxSlice.actions.updateConnector({ connector: this.connector })
                );
            }
        }

        Toast.show({
            label: 'Configuration Saved',
            variant: 'success',
        });
    };

    saveSessionConfigToCache = async () => {
        const sessionConfigurationList = Object.values(CACHE_SESSION_CONFIG);
        const sessionConfig = {};
        Object.values(sessionConfigurationList).forEach(item => {
            sessionConfig[item.key] = this.sessionConfig[item.key];
        });
        await cacheManager.saveOrgData(
            this.connector.conn.alias,
            CACHE_ORG_DATA_TYPES.SESSION_SETTINGS,
            sessionConfig
        );
        // we update the originalSessionConfig
        this.originalSessionConfig = { ...sessionConfig };
    };

    loadConfigFromCache = async () => {
        // Use the new CacheManager to load config
        const cachedConfiguration = await cacheManager.loadConfig(
            Object.values(CACHE_CONFIG).map(x => x.key)
        );
        LOGGER.log('cachedConfiguration', cachedConfiguration);

        const configurationList = Object.values(CACHE_CONFIG);
        const config = {};
        Object.values(configurationList).forEach(item => {
            const cached = cachedConfiguration[item.key];
            config[item.key] = cached !== undefined && cached !== null ? cached : item.defaultValue;
        });
        // Default to 'openai' if not set
        if (!config.ai_provider) {
            config.ai_provider = 'openai';
        }
        // Agent skills: default skills from files (content) + cache (enabled); custom skills from cache
        const rawSkills = config[CACHE_CONFIG.EINSTEIN_AGENT_SKILLS.key];
        const cachedSkills =
            rawSkills === undefined || rawSkills === null
                ? []
                : Array.isArray(rawSkills)
                  ? rawSkills
                  : [];
        config[CACHE_CONFIG.EINSTEIN_AGENT_SKILLS.key] = getEffectiveAgentSkills(cachedSkills);
        this.config = config;
        this.originalConfig = { ...config };

        const skills = config[CACHE_CONFIG.EINSTEIN_AGENT_SKILLS.key] || [];
        if (Array.isArray(skills) && skills.length > 0) {
            const hasValidSelection =
                this.selectedAgentSkillId && skills.some(s => s.id === this.selectedAgentSkillId);
            if (!hasValidSelection) {
                this.selectedAgentSkillId = skills[0].id;
            }
        } else {
            this.selectedAgentSkillId = null;
        }

        // Load the session specific settings from the cache

        if (this.isUserLoggedIn) {
            const sessionCachedConfiguration =
                (await cacheManager.loadOrgData(
                    this.connector.conn.alias,
                    CACHE_ORG_DATA_TYPES.SESSION_SETTINGS
                )) || {};
            const sessionConfigurationList = Object.values(CACHE_SESSION_CONFIG);
            const sessionConfig = {};
            Object.values(sessionConfigurationList).forEach(item => {
                sessionConfig[item.key] = sessionCachedConfiguration[item.key]; // || item.value;
            });

            this.sessionConfig = sessionConfig;
            this.originalSessionConfig = { ...sessionConfig };
        }

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
        return (
            JSON.stringify(this.config) != JSON.stringify(this.originalConfig) ||
            JSON.stringify(this.sessionConfig) != JSON.stringify(this.originalSessionConfig)
        );
    }

    get pageClass() {
        //Overwrite
        return super.pageClass + ' slds-p-around_small';
    }

    get isChrome() {
        return isChromeExtension();
    }

    get isShortcutDisabled() {
        return !this.config[CACHE_CONFIG.SHORTCUT_INJECTION_ENABLED.key];
    }

    get isCancelDisabled() {
        return !this.hasChanged;
    }

    get isSaveDisabled() {
        // Disable if config hasn't changed or if API version is invalid
        if (this._isApiVersionValid === false) return true;
        return !this.hasChanged;
    }

    get isFullIncognitoAccess() {
        return this.hasIncognitoAccess;
    }

    get userName() {
        return this.connector?.configuration?.username;
    }

    get agentSkills() {
        const key = CACHE_CONFIG.EINSTEIN_AGENT_SKILLS.key;
        const list = this.config[key];
        return Array.isArray(list) ? list : [];
    }

    get agentSkillsEmpty() {
        return this.agentSkills.length === 0;
    }

    get selectedAgentSkill() {
        if (!this.selectedAgentSkillId) return null;
        return this.agentSkills.find(s => s.id === this.selectedAgentSkillId) || null;
    }

    get agentSkillsWithSelection() {
        const selectedId = this.selectedAgentSkillId;
        return this.agentSkills.map(s => {
            const isSelected = s.id === selectedId;
            const displayName = s.name && String(s.name).trim() ? s.name.trim() : 'Unnamed';
            const isDefault = Boolean(s.defaultToolId);
            return {
                ...s,
                isSelected,
                displayName,
                isDefault,
                canRemove: !isDefault,
                navItemClass: `agent-skills-nav-item${isSelected ? ' agent-skills-nav-item_selected' : ''}`,
            };
        });
    }

    get selectedAgentSkillIsDefault() {
        return Boolean(this.selectedAgentSkill?.defaultToolId);
    }

    handleAgentSkillNavKeydown = e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const id = e.currentTarget.dataset.skillId;
            if (id) this.selectedAgentSkillId = id;
        }
    };
}
