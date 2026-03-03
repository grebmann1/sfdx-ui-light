import { isChromeExtension } from 'shared/utils';
import { basicStore, loadExtensionConfigFromCache, CACHE_CONFIG } from 'shared/cacheManager';
import { store, APPLICATION } from 'core/store';
import LOGGER from 'shared/logger';

/**
 * Cache initialization and loading helpers
 */

/**
 * Initialize cache storage
 */
export async function initCacheStorage() {
    if (isChromeExtension()) return;
    LOGGER.debug('initCacheStorage');
    window.defaultStore = await basicStore('local');
    window.settingsStore = await basicStore('session');
}

/**
 * Load configuration from cache
 * @param {Object} context - Component context (for setting component properties)
 */
export async function loadFromCache(context) {
    const configuration = await loadExtensionConfigFromCache([
        CACHE_CONFIG.UI_IS_APPLICATION_TAB_VISIBLE.key,
        CACHE_CONFIG.MISTRAL_KEY.key,
        CACHE_CONFIG.AI_PROVIDER.key,
        CACHE_CONFIG.OPENAI_KEY.key,
        CACHE_CONFIG.OPENAI_URL.key,
    ]);

    if (context) {
        context.isApplicationTabVisible = configuration[CACHE_CONFIG.UI_IS_APPLICATION_TAB_VISIBLE.key];
    }

    // Handle LLM keys and provider
    const openaiKey = configuration[CACHE_CONFIG.OPENAI_KEY.key];
    const openaiUrl = configuration[CACHE_CONFIG.OPENAI_URL.key];
    const mistralKey = configuration[CACHE_CONFIG.MISTRAL_KEY.key];
    const aiProvider = configuration[CACHE_CONFIG.AI_PROVIDER.key];
    
    LOGGER.debug('loadFromCache - openaiKey', openaiKey);
    LOGGER.debug('loadFromCache - openaiUrl', openaiUrl);
    LOGGER.debug('loadFromCache - mistralKey', mistralKey);
    LOGGER.debug('loadFromCache - aiProvider', aiProvider);
    
    if (openaiKey) {
        store.dispatch(APPLICATION.reduxSlice.actions.updateOpenAIKey({ openaiKey, openaiUrl }));
    }
    if (mistralKey) {
        store.dispatch(APPLICATION.reduxSlice.actions.updateMistralKey({ mistralKey }));
    }
    if (aiProvider) {
        store.dispatch(APPLICATION.reduxSlice.actions.updateAiProvider({ aiProvider }));
    }

    return {
        openaiKey,
        openaiUrl,
        mistralKey,
        aiProvider,
        isApplicationTabVisible: configuration[CACHE_CONFIG.UI_IS_APPLICATION_TAB_VISIBLE.key],
    };
}
