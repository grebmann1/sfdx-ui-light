import LOGGER from 'shared/logger';
import { isChromeExtension, isEmpty, isUndefinedOrNull, isNotUndefinedOrNull } from 'shared/utils';
import {
    createDefaultProviderConfigMap,
    DEFAULT_LLM_PROVIDER,
    normalizeLlmProvider,
    normalizeProviderConfigMap,
    type LlmProvider,
    type LlmProviderConfigMap,
} from 'shared/llm';

import { chromeStore, basicStore, type StorageStore } from './interfaces';

export { chromeStore, basicStore };

const CHROME_SYNC_SETTINGS_STORAGE_KEY = 'chrome_syncSettingsEnabled';

/**
 * CacheManager - Singleton class for managing cached data across the application
 * Handles both application settings and organization-specific data
 */
class CacheManager {
    static instance: CacheManager | null = null;
    isChrome = isChromeExtension();
    configKeyMap: Record<string, CONFIG_OBJECT> | null;

    constructor() {
        if (CacheManager.instance) {
            return CacheManager.instance;
        }

        this.configKeyMap = null;
        CacheManager.instance = this;
    }

    // Stores

    get store(): StorageStore {
        return this.isChrome ? chromeStore('local') : basicStore('local');
    }

    get settingsStore(): StorageStore {
        // For now we use the same store for settings and orgs
        return this.store; //return this.isChrome ? this.isChromeSyncSettingsEnabled ? chromeStore('sync') : chromeStore('local') : basicStore('local');
    }

    // Chrome Sync Settings Storage

    get isChromeSyncSettingsEnabled() {
        // we need to sync the storage
        return localStorage.getItem(CHROME_SYNC_SETTINGS_STORAGE_KEY) === 'true';
    }

    set isChromeSyncSettingsEnabled(value: boolean) {
        localStorage.setItem(CHROME_SYNC_SETTINGS_STORAGE_KEY, JSON.stringify(value));
    }

    // OrgAlias Specific Storage

    async loadOrgData<T = unknown>(
        orgAlias: string,
        dataType: string,
        key: string | null = null
    ): Promise<T | null> {
        LOGGER.debug('loadOrgData - orgAlias', orgAlias, dataType, key);
        const cacheKey = this._getOrgCacheKey(orgAlias, dataType, key);
        const cachedValue = await this.store.getItem<T>(cacheKey);
        return cachedValue !== null && cachedValue !== undefined ? cachedValue : null;
    }

    async saveOrgData(
        orgAlias: string,
        dataType: string,
        data: unknown,
        key: string | null = null
    ): Promise<void> {
        LOGGER.debug('saveOrgData - orgAlias', orgAlias, dataType, data, key);
        const cacheKey = this._getOrgCacheKey(orgAlias, dataType, key);
        await this.store.setItem(cacheKey, data);
    }

    async clearOrgData(
        orgAlias: string,
        dataType: string | null = null,
        key: string | null = null
    ): Promise<void> {
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

    _getOrgCacheKey(orgAlias: string, dataType: string, key: string | null = null): string {
        return key ? `org_${orgAlias}_${dataType}_${key}` : `org_${orgAlias}_${dataType}`;
    }

    // General Storage

    async loadGeneralData<T = unknown>(
        key: string,
        defaultValue: T | null = null,
        store: StorageStore = this.store
    ): Promise<T | null> {
        const value = await store.getItem<T>(key);
        if (value == null) {
            return defaultValue;
        }
        if (typeof value === 'string' && isEmpty(value)) {
            return defaultValue;
        }
        return value;
    }

    async saveGeneralData(
        key: string,
        value: unknown,
        store: StorageStore = this.store
    ): Promise<void> {
        await store.setItem(key, value);
    }

    // Settings - Single Item

    async getConfigValue<T = unknown>(key: string): Promise<T | null> {
        const configuration = await this.loadConfig([key]);
        return configuration[key] as T | null;
    }

    async setConfigValue(key: string, value: unknown): Promise<void> {
        await this.saveConfig({ [key]: value });
    }

    // Settings - Multiple Items

    getConfigKeyMap(): Record<string, CONFIG_OBJECT> {
        if (!this.configKeyMap) {
            this.configKeyMap = {};
            for (const configKey in CACHE_CONFIG) {
                const configObj = CACHE_CONFIG[configKey];
                this.configKeyMap[configObj.key] = configObj;
            }
        }
        return this.configKeyMap;
    }

    async loadConfig(keys: string[]): Promise<Record<string, unknown>> {
        const configuration: Record<string, unknown> = {};

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

    async saveConfig(config: Record<string, unknown>): Promise<void> {
        const keys = Object.keys(config);
        for await (const key of keys) {
            await this.settingsStore.setItem(key, config[key]);
        }
    }
}

// Create and export the singleton instance
export const cacheManager = new CacheManager();

export class CONFIG_OBJECT<T = unknown> {
    key: string;
    defaultValue: T;
    _value?: T;

    constructor(key: string, defaultValue: T) {
        this.key = key;
        this.defaultValue = defaultValue;
    }

    set value(val: T) {
        this._value = val;
    }

    get value(): T {
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
    // Google Auth Session
    GOOGLE_SESSION: new CONFIG_OBJECT<{ token: string; email: string; name: string; picture: string } | null>('google_session', null),
    // AI Settings
    PROVIDER_CONFIGS: new CONFIG_OBJECT('llm_provider_configs', null),
    OPENAI_KEY: new CONFIG_OBJECT('openai_key', null),
    OPENAI_URL: new CONFIG_OBJECT('openai_url', 'https://api.openai.com/v1'),
    ANTHROPIC_KEY: new CONFIG_OBJECT('anthropic_key', null),
    ANTHROPIC_URL: new CONFIG_OBJECT('anthropic_url', 'https://api.anthropic.com/v1'),
    GEMINI_KEY: new CONFIG_OBJECT('gemini_key', null),
    GEMINI_URL: new CONFIG_OBJECT('gemini_url', 'https://generativelanguage.googleapis.com'),
    MISTRAL_KEY: new CONFIG_OBJECT('mistral_key', null),
    MISTRAL_URL: new CONFIG_OBJECT('mistral_url', 'https://api.mistral.ai/v1'),
    GROK_KEY: new CONFIG_OBJECT('grok_key', null),
    GROK_URL: new CONFIG_OBJECT('grok_url', 'https://api.x.ai/v1'),
    AI_PROVIDER: new CONFIG_OBJECT('ai_provider', 'openai'),
    EXPERIENCE_CLOUD_LOGINAS_INCOGNITO: new CONFIG_OBJECT('experienceCloudLoginAsIncognito', false),
    UI_IS_APPLICATION_TAB_VISIBLE: new CONFIG_OBJECT('ui_isApplicationTabVisible', true),
    CHROME_SYNC_SETTINGS_INITIALIZED_STORAGE_KEY: new CONFIG_OBJECT(
        'chrome_syncSettingsInitialized',
        false
    ),
    CHROME_SYNC_ORG_INITIALIZED_STORAGE_KEY: new CONFIG_OBJECT('chrome_syncOrgInitialized', false),
    // Applications Settings are stored in the general store
    API_SPLITTER_IS_HORIZONTAL: new CONFIG_OBJECT('api_splitter_is_horizontal', true),
    EINSTEIN_AGENT_CONVERSATIONS: new CONFIG_OBJECT('einstein_agent_conversations', []),
    EINSTEIN_AGENT_CONVERSATION_ACTIVE_ID: new CONFIG_OBJECT(
        'einstein_agent_conversation_active_id',
        null
    ),
    EINSTEIN_AGENT_CONVERSATION_MODEL: new CONFIG_OBJECT('einstein_agent_conversation_model', null),
    EINSTEIN_AGENT_CONVERSATION_REASONING: new CONFIG_OBJECT(
        'einstein_agent_conversation_reasoning',
        null
    ),
    EINSTEIN_AGENT_CONVERSATION_DATA: new CONFIG_OBJECT('einstein_agent_conversation_data', null),
    // Input Quick Pick
    INPUT_QUICKPICK_DATA: new CONFIG_OBJECT('input_quickpick_data', null),
    INPUT_QUICKPICK_ENABLED: new CONFIG_OBJECT('input_quickpick_enabled', false),
    INPUT_QUICKPICK_SELECTED_CATEGORY: new CONFIG_OBJECT(
        'input_quickpick_selected_category',
        'ALL'
    ),
    INPUT_QUICKPICK_RECENTS: new CONFIG_OBJECT('input_quickpick_recents', []),
    // Metadata Storage
    METADATA_STORAGE_ENABLED: new CONFIG_OBJECT('metadata_storage_enabled', true),
    METADATA_STORAGE_TYPES: new CONFIG_OBJECT('metadata_storage_types', [
        'ApexClass',
        'ApexTrigger',
        'ApexPage',
        'ApexComponent',
        'LightningComponentBundle',
        'AuraDefinitionBundle',
        'CustomObject',
        'CustomField',
        'PermissionSet',
        'Profile',
        'Flow',
        'StaticResource',
    ]),
    METADATA_STORAGE_BACKGROUND_SYNC_ENABLED: new CONFIG_OBJECT(
        'metadata_storage_background_sync_enabled',
        false
    ),
    // Google Integration
    GOOGLE_CONNECTED: new CONFIG_OBJECT('google_connected', false),
    GOOGLE_DRIVE_CONNECTED: new CONFIG_OBJECT('google_drive_connected', false),
    // Agent Tools
    TOOL_BRIGHT_DATA_KEY: new CONFIG_OBJECT('tool_bright_data_key', null),
    TOOL_BRIGHT_DATA_ENABLED: new CONFIG_OBJECT('tool_bright_data_enabled', false),
    TOOL_GOOGLE_SHEET_ENABLED: new CONFIG_OBJECT('tool_google_sheet_enabled', false),
    // Beta Features
    BETA_SMARTINPUT_ENABLED: new CONFIG_OBJECT('beta_smartinput_enabled', false),
    // Keyboard shortcuts (injected page + app). Use defaultValue when config not set.
    SHORTCUT_INJECTION_ENABLED: new CONFIG_OBJECT('shortcut_injectionEnabled', true),
    SHORTCUT_RECORDID: new CONFIG_OBJECT('shortcut_recordId', 'ctrl+shift+1'),
    SHORTCUT_OVERVIEW: new CONFIG_OBJECT('shortcut_overview', 'ctrl+shift+2'),
    SHORTCUT_SOQL: new CONFIG_OBJECT('shortcut_soql', 'ctrl+shift+3'),
    SHORTCUT_APEX: new CONFIG_OBJECT('shortcut_apex', 'ctrl+shift+4'),
    SHORTCUT_API: new CONFIG_OBJECT('shortcut_api', 'ctrl+shift+5'),
    SHORTCUT_DOCUMENTATION: new CONFIG_OBJECT('shortcut_documentation', 'ctrl+shift+6'),
    SHORTCUT_OPEN_PANEL: new CONFIG_OBJECT('shortcut_openPanel', 'ctrl+shift+7'),
    SHORTCUT_OPEN_OVERLAY: new CONFIG_OBJECT('shortcut_openOverlay', 'ctrl+shift+8'),
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
export async function loadExtensionConfigFromCache(keys: string[]) {
    return cacheManager.loadConfig(keys);
}

export async function loadSingleExtensionConfigFromCache<T = unknown>(
    key: string,
    format?: (value: T | null) => T
): Promise<T | null> {
    const result = (await cacheManager.loadConfig([key]))[key] as T | null;
    if (format) {
        console.log('### format', format);
        return format(result);
    }
    return result;
}

export async function saveExtensionConfigToCache(config: Record<string, unknown>) {
    return cacheManager.saveConfig(config);
}

export async function saveSingleExtensionConfigToCache(key: string, value: unknown) {
    return cacheManager.saveConfig({ [key]: value });
}

/** Extra Methods to simplify the usage of the cacheManager */

function toConfigValueRecord(config: Record<string, unknown>) {
    return config && typeof config === 'object' ? config : {};
}

export function getLlmProviderConfigCacheKeys(): string[] {
    return [
        CACHE_CONFIG.PROVIDER_CONFIGS.key,
        CACHE_CONFIG.OPENAI_KEY.key,
        CACHE_CONFIG.OPENAI_URL.key,
        CACHE_CONFIG.ANTHROPIC_KEY.key,
        CACHE_CONFIG.ANTHROPIC_URL.key,
        CACHE_CONFIG.GEMINI_KEY.key,
        CACHE_CONFIG.GEMINI_URL.key,
        CACHE_CONFIG.MISTRAL_KEY.key,
        CACHE_CONFIG.MISTRAL_URL.key,
        CACHE_CONFIG.GROK_KEY.key,
        CACHE_CONFIG.GROK_URL.key,
        CACHE_CONFIG.AI_PROVIDER.key,
    ];
}

export function getDefaultLlmProviderConfigMap(): LlmProviderConfigMap {
    return createDefaultProviderConfigMap();
}

export function getLegacyLlmProviderConfigMap(
    config: Record<string, unknown> = {}
): LlmProviderConfigMap {
    const safeConfig = toConfigValueRecord(config);
    const defaults = createDefaultProviderConfigMap();
    return normalizeProviderConfigMap({
        ...defaults,
        openai: {
            apiKey: safeConfig[CACHE_CONFIG.OPENAI_KEY.key],
            baseUrl: safeConfig[CACHE_CONFIG.OPENAI_URL.key],
        },
        anthropic: {
            apiKey: safeConfig[CACHE_CONFIG.ANTHROPIC_KEY.key],
            baseUrl: safeConfig[CACHE_CONFIG.ANTHROPIC_URL.key],
        },
        gemini: {
            apiKey: safeConfig[CACHE_CONFIG.GEMINI_KEY.key],
            baseUrl: safeConfig[CACHE_CONFIG.GEMINI_URL.key],
        },
        mistral: {
            apiKey: safeConfig[CACHE_CONFIG.MISTRAL_KEY.key],
            baseUrl: safeConfig[CACHE_CONFIG.MISTRAL_URL.key],
        },
        grok: {
            apiKey: safeConfig[CACHE_CONFIG.GROK_KEY.key],
            baseUrl: safeConfig[CACHE_CONFIG.GROK_URL.key],
        },
    });
}

export function resolveLlmProviderConfigMap(
    config: Record<string, unknown> = {}
): LlmProviderConfigMap {
    const safeConfig = toConfigValueRecord(config);
    const canonical = safeConfig[CACHE_CONFIG.PROVIDER_CONFIGS.key];
    if (canonical && typeof canonical === 'object') {
        return normalizeProviderConfigMap(canonical);
    }
    return getLegacyLlmProviderConfigMap(safeConfig);
}

export function buildProviderConfigCacheRecord(
    providerConfigs: LlmProviderConfigMap
): Record<string, unknown> {
    const normalized = normalizeProviderConfigMap(providerConfigs);
    return {
        [CACHE_CONFIG.PROVIDER_CONFIGS.key]: normalized,
        [CACHE_CONFIG.OPENAI_KEY.key]: normalized.openai.apiKey,
        [CACHE_CONFIG.OPENAI_URL.key]: normalized.openai.baseUrl,
        [CACHE_CONFIG.ANTHROPIC_KEY.key]: normalized.anthropic.apiKey,
        [CACHE_CONFIG.ANTHROPIC_URL.key]: normalized.anthropic.baseUrl,
        [CACHE_CONFIG.GEMINI_KEY.key]: normalized.gemini.apiKey,
        [CACHE_CONFIG.GEMINI_URL.key]: normalized.gemini.baseUrl,
        [CACHE_CONFIG.MISTRAL_KEY.key]: normalized.mistral.apiKey,
        [CACHE_CONFIG.MISTRAL_URL.key]: normalized.mistral.baseUrl,
        [CACHE_CONFIG.GROK_KEY.key]: normalized.grok.apiKey,
        [CACHE_CONFIG.GROK_URL.key]: normalized.grok.baseUrl,
    };
}

export async function loadLlmProviderConfigMapFromCache(): Promise<LlmProviderConfigMap> {
    const config = await cacheManager.loadConfig(getLlmProviderConfigCacheKeys());
    return resolveLlmProviderConfigMap(config);
}

export async function saveLlmProviderConfigMapToCache(
    providerConfigs: LlmProviderConfigMap
): Promise<void> {
    await cacheManager.saveConfig(buildProviderConfigCacheRecord(providerConfigs));
}

export async function saveSingleLlmProviderConfigToCache(
    provider: LlmProvider,
    config: Partial<{ apiKey: string | null; baseUrl: string | null }>
): Promise<LlmProviderConfigMap> {
    const current = await loadLlmProviderConfigMapFromCache();
    const normalizedProvider = normalizeLlmProvider(provider);
    const nextConfigs = normalizeProviderConfigMap({
        ...current,
        [normalizedProvider]: {
            ...current[normalizedProvider],
            ...config,
        },
    });
    await saveLlmProviderConfigMapToCache(nextConfigs);
    return nextConfigs;
}

export function getAiProviderFromConfig(config: Record<string, unknown> = {}): LlmProvider {
    return normalizeLlmProvider(config[CACHE_CONFIG.AI_PROVIDER.key]);
}

// OpenAI Key
export const getOpenAIKeyFromCache = async () => {
    return (await loadLlmProviderConfigMapFromCache()).openai.apiKey || '';
};
// Mistral Key
export const getMistralKeyFromCache = async () => {
    return (await loadLlmProviderConfigMapFromCache()).mistral.apiKey || '';
};
export const setMistralKeyInCache = async (key: string): Promise<void> => {
    await saveSingleLlmProviderConfigToCache('mistral', { apiKey: key });
};
// Synced Settings
export const getSyncedSettingsInitializedFromCache = async () => {
    return await cacheManager.loadGeneralData(
        CACHE_CONFIG.CHROME_SYNC_SETTINGS_INITIALIZED_STORAGE_KEY.key,
        false,
        cacheManager.settingsStore
    );
};

export const saveSyncedSettingsInitializedToCache = async (
    value: boolean = true
): Promise<void> => {
    return await cacheManager.saveGeneralData(
        CACHE_CONFIG.CHROME_SYNC_SETTINGS_INITIALIZED_STORAGE_KEY.key,
        value,
        cacheManager.settingsStore
    );
};
// Org Save Connections
export const saveConnectionsToCache = async (connections: unknown): Promise<void> => {
    return await cacheManager.saveGeneralData(CACHE_ORG_DATA_TYPES.CONNECTIONS, connections);
};

export const getConnectionsFromCache = async () => {
    const connections = await cacheManager.loadGeneralData(CACHE_ORG_DATA_TYPES.CONNECTIONS, []);
    return Array.isArray(connections) ? connections : [];
};
