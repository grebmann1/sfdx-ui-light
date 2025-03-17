export async function loadExtensionConfigFromCache(keys) {
    const configuration = {};
    
    for await (const key of keys) {
        const cachedValue = await window.defaultStore.getItem(key);
        
        // If we have a value in cache, use it
        if (cachedValue !== null && cachedValue !== undefined) {
            configuration[key] = cachedValue;
        } else {
            // Otherwise, look for a default value in CACHE_CONFIG using our map
            const configObj = getConfigKeyMap()[key];
            configuration[key] = configObj ? configObj.defaultValue : null;
        }
    }
    
    return configuration;
}

export async function saveExtensionConfigToCache(config) {
    const keys = Object.keys(config);
    for await (const key of keys) {
        await window.defaultStore.setItem(key, config[key]);
    }
}

export class CONFIG_OBJECT {
    
    constructor(key,defaultValue){
        this.key = key;
        this.defaultValue = defaultValue;
    }


    set value(val){
        this._value = val;
    }

    get value(){
        return this._value || this.defaultValue;
    }
}


export const CACHE_CONFIG = {
    CONFIG_POPUP: new CONFIG_OBJECT('openAsPopup',false),
    OPENAI_ASSISTANT_ID: new CONFIG_OBJECT('openai_assistant_id',null),
    OPENAI_KEY: new CONFIG_OBJECT('openai_key',null),
    SHORTCUT_RECORDID: new CONFIG_OBJECT('shortcut_recordid',null),
    SHORTCUT_INJECTION_ENABLED: new CONFIG_OBJECT('shortcut_injection_enabled',false),
    EXPERIENCE_CLOUD_LOGINAS_INCOGNITO: new CONFIG_OBJECT('experienceCloudLoginAsIncognito',false),
    CACHE_ISCACHED_PROFILES: new CONFIG_OBJECT('cache_isProfilesCache',false),
    CACHE_ISCACHED_SOBJECTS: new CONFIG_OBJECT('cache_isSObjectsCache',false),
    CACHE_REFRESH_RATE: new CONFIG_OBJECT('cache_refreshRate',24),
    CACHE_EXCLUSION_LIST: new CONFIG_OBJECT('cache_exclusionList',''),
    UI_IS_APPLICATION_TAB_VISIBLE: new CONFIG_OBJECT('ui_isApplicationTabVisible',false)
};

// Helper function to get the config key map (created only once when needed)
function getConfigKeyMap() {
    if (!getConfigKeyMap.map) {
        getConfigKeyMap.map = {};
        for (const configKey in CACHE_CONFIG) {
            const configObj = CACHE_CONFIG[configKey];
            getConfigKeyMap.map[configObj.key] = configObj;
        }
    }
    return getConfigKeyMap.map;
}

export const getOpenAIKeyFromCache = async () => {
    // Logic to fetch the OpenAI key, e.g., from a config or environment variable
    const configuration = await loadExtensionConfigFromCache([CACHE_CONFIG.OPENAI_KEY.key]);
    return configuration[CACHE_CONFIG.OPENAI_KEY.key] || ''; // Return the key or an empty string
}