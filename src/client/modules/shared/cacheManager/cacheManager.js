import LOGGER from 'shared/logger';
/**
 * CacheManager - Singleton class for managing cached data across the application
 * Handles both application settings and organization-specific data
 */
class CacheManager {
    constructor() {
        if (CacheManager.instance) {
            return CacheManager.instance;
        }
        
        this.configKeyMap = null;
        CacheManager.instance = this;
    }

    get store(){
        // Might fail in some cases
        return window.defaultStore;
    }


    /**
     * Get the mapping of configuration keys to their CONFIG_OBJECT instances
     * @returns {Object} Map of configuration keys to CONFIG_OBJECT instances
     */
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

    /**
     * Load configuration values from cache
     * @param {Array<string>} keys - Configuration keys to load
     * @returns {Promise<Object>} Object containing the loaded configuration values
     */
    async loadConfig(keys) {
        const configuration = {};
        
        for await (const key of keys) {
            const cachedValue = await this.store.getItem(key);
            
            // If we have a value in cache, use it
            if (cachedValue !== null && cachedValue !== undefined) {
                configuration[key] = cachedValue;
            } else {
                // Otherwise, look for a default value in CACHE_CONFIG using our map
                const configObj = this.getConfigKeyMap()[key];
                configuration[key] = configObj ? configObj.defaultValue : null;
            }
        }
        
        return configuration;
    }

    /**
     * Save configuration values to cache
     * @param {Object} config - Configuration values to save
     * @returns {Promise<void>}
     */
    async saveConfig(config) {
        const keys = Object.keys(config);
        for await (const key of keys) {
            await this.store.setItem(key, config[key]);
        }
    }

    /**
     * Load organization-specific data from cache
     * @param {string} orgAlias - Organization alias
     * @param {string} dataType - Type of data (e.g., 'Metadata', 'Queries')
     * @param {string} [key=null] - Specific key within the data type (optional)
     * @returns {Promise<any>} The cached data
     */
    async loadOrgData(orgAlias, dataType, key = null) {
        LOGGER.debug('loadOrgData - orgAlias',orgAlias,dataType,key);
        const cacheKey = this._getOrgCacheKey(orgAlias, dataType, key);
        const cachedValue = await this.store.getItem(cacheKey);
        return cachedValue !== null && cachedValue !== undefined ? cachedValue : null;
    }

    /**
     * Save organization-specific data to cache
     * @param {string} orgAlias - Organization alias
     * @param {string} dataType - Type of data (e.g., 'Metadata', 'Queries')
     * @param {any} data - Data to cache
     * @param {string} [key=null] - Specific key within the data type (optional)
     * @returns {Promise<void>}
     */
    async saveOrgData(orgAlias, dataType, data, key = null) {
        LOGGER.debug('saveOrgData - orgAlias',orgAlias,dataType,key);
        const cacheKey = this._getOrgCacheKey(orgAlias, dataType, key);
        await this.store.setItem(cacheKey, data);
    }

    /**
     * Clear organization-specific data from cache
     * @param {string} orgAlias - Organization alias
     * @param {string} [dataType=null] - Type of data (optional, if null clears all data for the org)
     * @param {string} [key=null] - Specific key within the data type (optional)
     * @returns {Promise<void>}
     */
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

    /**
     * Generate a cache key for organization-specific data
     * @private
     * @param {string} orgAlias - Organization alias
     * @param {string} dataType - Type of data
     * @param {string} [key=null] - Specific key within the data type (optional)
     * @returns {string} The cache key
     */
    _getOrgCacheKey(orgAlias, dataType, key = null) {
        return key 
            ? `org_${orgAlias}_${dataType}_${key}` 
            : `org_${orgAlias}_${dataType}`;
    }

    /**
     * Get a specific configuration value
     * @param {string} key - Configuration key
     * @returns {Promise<any>} The configuration value
     */
    async getConfigValue(key) {
        const configuration = await this.loadConfig([key]);
        return configuration[key];
    }

    /**
     * Set a specific configuration value
     * @param {string} key - Configuration key
     * @param {any} value - Value to set
     * @returns {Promise<void>}
     */
    async setConfigValue(key, value) {
        await this.saveConfig({ [key]: value });
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
        return this._value || this.defaultValue;
    }
}

export const CACHE_CONFIG = {
    CONFIG_POPUP: new CONFIG_OBJECT('openAsPopup', false),
    OPENAI_ASSISTANT_ID: new CONFIG_OBJECT('openai_assistant_id', null),
    OPENAI_KEY: new CONFIG_OBJECT('openai_key', null),
    SHORTCUT_INJECTION_ENABLED: new CONFIG_OBJECT('shortcut_injection_enabled', false),
    SHORTCUT_RECORDID: new CONFIG_OBJECT('shortcut_recordid', null),
    SHORTCUT_OPEN_PANEL: new CONFIG_OBJECT('shortcut_open_panel', null),
    SHORTCUT_OVERVIEW: new CONFIG_OBJECT('shortcut_overview', null),
    SHORTCUT_SOQL: new CONFIG_OBJECT('shortcut_soql', null),
    SHORTCUT_APEX: new CONFIG_OBJECT('shortcut_apex', null),
    EXPERIENCE_CLOUD_LOGINAS_INCOGNITO: new CONFIG_OBJECT('experienceCloudLoginAsIncognito', false),
    CACHE_ISCACHED_PROFILES: new CONFIG_OBJECT('cache_isProfilesCache', false),
    CACHE_ISCACHED_SOBJECTS: new CONFIG_OBJECT('cache_isSObjectsCache', false),
    CACHE_REFRESH_RATE: new CONFIG_OBJECT('cache_refreshRate', 24),
    CACHE_EXCLUSION_LIST: new CONFIG_OBJECT('cache_exclusionList', ''),
    UI_IS_APPLICATION_TAB_VISIBLE: new CONFIG_OBJECT('ui_isApplicationTabVisible', false),
};

export const CACHE_ORG_DATA_TYPES = {
    DESCRIBE_GLOBAL: 'DescribeGlobal',
    DESCRIBE: 'Describe',
    DESCRIBE_VERSION: 'DescribeVersion',
    METADATA_QUERY: 'MetadataQuery',
};

// Backward compatibility functions
export async function loadExtensionConfigFromCache(keys) {
    return cacheManager.loadConfig(keys);
}

export async function saveExtensionConfigToCache(config) {
    return cacheManager.saveConfig(config);
}

export const getOpenAIKeyFromCache = async () => {
    return cacheManager.getConfigValue(CACHE_CONFIG.OPENAI_KEY.key) || '';
}