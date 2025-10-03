import LOGGER from 'shared/logger';
import { isChromeExtension, isEmpty,isUndefinedOrNull,isNotUndefinedOrNull } from 'shared/utils';

import { chromeStore, basicStore } from './interfaces';

export { chromeStore, basicStore };

const CHROME_SYNC_SETTINGS_STORAGE_KEY = 'chrome_syncSettingsEnabled';

/**
 * CacheManager - Singleton class for managing cached data across the application
 * Handles both application settings and organization-specific data
 */
class CacheManager {
    isChrome = isChromeExtension();

    constructor() {
        if (CacheManager.instance) {
            return CacheManager.instance;
        }

        this.configKeyMap = null;
        CacheManager.instance = this;
    }

    // Stores

    get store() {
        return this.isChrome ? chromeStore('local') : basicStore('local');
    }

    get settingsStore() {
        // For now we use the same store for settings and orgs
        return this.store; //return this.isChrome ? this.isChromeSyncSettingsEnabled ? chromeStore('sync') : chromeStore('local') : basicStore('local');
    }

    // Chrome Sync Settings Storage

    get isChromeSyncSettingsEnabled() {
        // we need to sync the storage
        return localStorage.getItem(CHROME_SYNC_SETTINGS_STORAGE_KEY) === 'true';
    }

    set isChromeSyncSettingsEnabled(value) {
        localStorage.setItem(CHROME_SYNC_SETTINGS_STORAGE_KEY, JSON.stringify(value));
    }

    // OrgAlias Specific Storage

    async loadOrgData(orgAlias, dataType, key = null) {
        LOGGER.debug('loadOrgData - orgAlias', orgAlias, dataType, key);
        const cacheKey = this._getOrgCacheKey(orgAlias, dataType, key);
        const cachedValue = await this.store.getItem(cacheKey);
        return cachedValue !== null && cachedValue !== undefined ? cachedValue : null;
    }

    async saveOrgData(orgAlias, dataType, data, key = null) {
        LOGGER.debug('saveOrgData - orgAlias', orgAlias, dataType, data, key);
        const cacheKey = this._getOrgCacheKey(orgAlias, dataType, key);
        await this.store.setItem(cacheKey, data);
    }

    async clearOrgData(orgAlias, dataType = null, key = null) {
        if (!dataType) {
            // Clear all data for this org - would need to list all keys with this prefix and remove them
            // This implementation depends on the capabilities of the store
            // For now, we'll just log that this functionality would need to be implemented
            console.warn('Clearing all org data not implemented yet');
            return;
        }

        const cacheKey = this._getOrgCacheKey(orgAlias, dataType, key);
        await this.store.removeItem(cacheKey);
    }

    _getOrgCacheKey(orgAlias, dataType, key = null) {
        return key ? `org_${orgAlias}_${dataType}_${key}` : `org_${orgAlias}_${dataType}`;
    }

    // General Storage

    async loadGeneralData(key, defaultValue = null, store = this.store) {
        const value = await store.getItem(key);
        return isEmpty(value) ? defaultValue : value;
    }

    async saveGeneralData(key, value, store = this.store) {
        await store.setItem(key, value);
    }

    // Settings - Single Item

    async getConfigValue(key) {
        const configuration = await this.loadConfig([key]);
        return configuration[key];
    }

    async setConfigValue(key, value) {
        await this.saveConfig({ [key]: value });
    }

    // Settings - Multiple Items

    getConfigKeyMap() {
        if (!this.configKeyMap) {
            this.configKeyMap = {};
            for (const configKey in CACHE_CONFIG) {
                const configObj = CACHE_CONFIG[configKey];
                this.configKeyMap[configObj.key] = configObj;
            }
        }
        return this.configKeyMap;
    }

    async loadConfig(keys) {
        const configuration = {};

        for await (const key of keys) {
            const cachedValue = await this.settingsStore.getItem(key);

            // If we have a value in cache, use it
            if (isNotUndefinedOrNull(cachedValue)) {
                configuration[key] = cachedValue;
            } else {
                // Otherwise, look for a default value in CACHE_CONFIG using our map
                const configObj = this.getConfigKeyMap()[key];
                configuration[key] = configObj ? configObj.defaultValue : null;
            }
        }

        return configuration;
    }

    async saveConfig(config) {
        const keys = Object.keys(config);
        for await (const key of keys) {
            await this.settingsStore.setItem(key, config[key]);
        }
    }
}

// Create and export the singleton instance
export const cacheManager = new CacheManager();

export class CONFIG_OBJECT {
    constructor(key, defaultValue) {
        this.key = key;
        this.defaultValue = defaultValue;
    }

    set value(val) {
        this._value = val;
    }

    get value() {
        return isUndefinedOrNull(this._value) ? this.defaultValue : this._value;
    }
}

// NOTE: Chrome extension dependency
// The Chrome extension page `src/client_chrome/scripts/link-action.js` filters
// incoming settings against the keys defined in CACHE_CONFIG (mirrored as a
// whitelist). If you add, remove, or rename keys here, update the
// `ALLOWED_SETTING_KEYS` set in that file to keep the extension in sync.
// Alternatively, consider centralizing the whitelist generation if shared
// bundling becomes feasible.
export const CACHE_CONFIG = {
    CONFIG_POPUP: new CONFIG_OBJECT('openAsPopup', false),
    CACHE_ISCACHED_PROFILES: new CONFIG_OBJECT('cache_isProfilesCache', false),
    CACHE_ISCACHED_SOBJECTS: new CONFIG_OBJECT('cache_isSObjectsCache', false),
    CACHE_REFRESH_RATE: new CONFIG_OBJECT('cache_refreshRate', 24),
    CACHE_EXCLUSION_LIST: new CONFIG_OBJECT('cache_exclusionList', ''),
    OVERLAY_ENABLED: new CONFIG_OBJECT('overlayEnabled', true),
    CONTENT_SCRIPT_INCLUDE_PATTERNS: new CONFIG_OBJECT('content_script_include_patterns', null),
    CONTENT_SCRIPT_EXCLUDE_PATTERNS: new CONFIG_OBJECT('content_script_exclude_patterns', null),
    // AI Settings
    OPENAI_KEY: new CONFIG_OBJECT('openai_key', null),
    MISTRAL_KEY: new CONFIG_OBJECT('mistral_key', null), // Added for Mistral
    AI_PROVIDER: new CONFIG_OBJECT('ai_provider', 'openai'),
    OPENAI_URL: new CONFIG_OBJECT('openai_url', 'https://api.openai.com'),
    // Shortcuts
    SHORTCUT_INJECTION_ENABLED: new CONFIG_OBJECT('shortcut_injection_enabled', false),
    SHORTCUT_RECORDID: new CONFIG_OBJECT('shortcut_recordid', null),
    SHORTCUT_OPEN_PANEL: new CONFIG_OBJECT('shortcut_open_panel', null),
    SHORTCUT_OPEN_OVERLAY: new CONFIG_OBJECT('shortcut_open_overlay', null),
    SHORTCUT_OVERVIEW: new CONFIG_OBJECT('shortcut_overview', null),
    SHORTCUT_SOQL: new CONFIG_OBJECT('shortcut_soql', null),
    SHORTCUT_APEX: new CONFIG_OBJECT('shortcut_apex', null),
    SHORTCUT_API: new CONFIG_OBJECT('shortcut_api', null),
    SHORTCUT_DOCUMENTATION: new CONFIG_OBJECT('shortcut_documentation', null),
    EXPERIENCE_CLOUD_LOGINAS_INCOGNITO: new CONFIG_OBJECT('experienceCloudLoginAsIncognito', false),
    UI_IS_APPLICATION_TAB_VISIBLE: new CONFIG_OBJECT('ui_isApplicationTabVisible', true),
    CHROME_SYNC_SETTINGS_INITIALIZED_STORAGE_KEY: new CONFIG_OBJECT(
        'chrome_syncSettingsInitialized',
        false
    ),
    CHROME_SYNC_ORG_INITIALIZED_STORAGE_KEY: new CONFIG_OBJECT('chrome_syncOrgInitialized', false),
    // Applications Settings are stored in the general store
    API_SPLITTER_IS_HORIZONTAL: new CONFIG_OBJECT('api_splitter_is_horizontal', false),
    EINSTEIN_AGENT_CONVERSATIONS: new CONFIG_OBJECT('einstein_agent_conversations', []),
    EINSTEIN_AGENT_CONVERSATION_ACTIVE_ID: new CONFIG_OBJECT('einstein_agent_conversation_active_id', null),
    EINSTEIN_AGENT_CONVERSATION_MODEL: new CONFIG_OBJECT('einstein_agent_conversation_model', null),
    // Input Quick Pick
    INPUT_QUICKPICK_DATA: new CONFIG_OBJECT('input_quickpick_data', null),
    INPUT_QUICKPICK_ENABLED: new CONFIG_OBJECT('input_quickpick_enabled', false),
    INPUT_QUICKPICK_SELECTED_CATEGORY: new CONFIG_OBJECT('input_quickpick_selected_category', 'ALL'),
    INPUT_QUICKPICK_RECENTS: new CONFIG_OBJECT('input_quickpick_recents', []),
    //  TODO: Add Global CLIENT_ID and API_VERSION to the CACHE_CONFIG
};

export const CACHE_SESSION_CONFIG = {
    CLIENT_ID: new CONFIG_OBJECT('client_id', null),
    API_VERSION: new CONFIG_OBJECT('api_version', null),
};

export const CACHE_ANALYTICS_CONFIG = {
    CLIENT_STORAGE_KEY: new CONFIG_OBJECT('analytics_client_id', null),
    SESSION_STORAGE_KEY: new CONFIG_OBJECT('analytics_session', null),
};

export const CACHE_ORG_DATA_TYPES = {
    DESCRIBE_GLOBAL: 'DescribeGlobal',
    DESCRIBE: 'Describe',
    DESCRIBE_VERSION: 'DescribeVersion',
    METADATA_QUERY: 'MetadataQuery',
    CONNECTIONS: 'connections',
    SESSION_SETTINGS: 'session_settings',
    ELECTRON_ORG_LIST: 'electron_org_list', // Added for electron org list caching
};

export const CACHE_DOCUMENTS = {
    QUERYFILES: 'QUERYFILES',
    APIFILES: 'APIFILES',
    OPENAPI_SCHEMAS_FILES: 'OPENAPI_SCHEMAS_FILES',
    APEXFILES: 'APEXFILES',
    RECENT: 'RECENTS',
};
// Backward compatibility functions
export async function loadExtensionConfigFromCache(keys) {
    return cacheManager.loadConfig(keys);
}

export async function loadSingleExtensionConfigFromCache(key) {
    return (await cacheManager.loadConfig([key]))[key];
}

export async function saveExtensionConfigToCache(config) {
    return cacheManager.saveConfig(config);
}

export async function saveSingleExtensionConfigToCache(key, value) {
    return cacheManager.saveConfig({ [key]: value });
}

/** Extra Methods to simplify the usage of the cacheManager */

// OpenAI Key
export const getOpenAIKeyFromCache = async () => {
    return (await cacheManager.getConfigValue(CACHE_CONFIG.OPENAI_KEY.key)) || '';
};
// Mistral Key
export const getMistralKeyFromCache = async () => {
    return (await cacheManager.getConfigValue(CACHE_CONFIG.MISTRAL_KEY.key)) || '';
};
export const setMistralKeyInCache = async (key) => {
    return await cacheManager.setConfigValue(CACHE_CONFIG.MISTRAL_KEY.key, key);
};
// Synced Settings
export const getSyncedSettingsInitializedFromCache = async () => {
    return await cacheManager.loadGeneralData(
        CACHE_CONFIG.CHROME_SYNC_SETTINGS_INITIALIZED_STORAGE_KEY.key,
        false,
        cacheManager.settingsStore
    );
};

export const saveSyncedSettingsInitializedToCache = async (value = true) => {
    return await cacheManager.saveGeneralData(
        CACHE_CONFIG.CHROME_SYNC_SETTINGS_INITIALIZED_STORAGE_KEY.key,
        value,
        cacheManager.settingsStore
    );
};
// Org Save Connections
export const saveConnectionsToCache = async connections => {
    return await cacheManager.saveGeneralData(CACHE_ORG_DATA_TYPES.CONNECTIONS, connections);
};

export const getConnectionsFromCache = async () => {
    const connections = await cacheManager.loadGeneralData(CACHE_ORG_DATA_TYPES.CONNECTIONS, []);
    return Array.isArray(connections) ? connections : [];
};
