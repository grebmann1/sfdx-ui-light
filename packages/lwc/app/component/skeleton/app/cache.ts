import { store, APPLICATION, AGENT } from 'core/store';
import {
    basicStore,
    loadExtensionConfigFromCache,
    CACHE_CONFIG,
    getAiProviderFromConfig,
    getLlmProviderConfigCacheKeys,
    resolveLlmProviderConfigMap,
} from 'shared/cacheManager';
import LOGGER from 'shared/logger';
import { isChromeExtension } from 'shared/utils';
import { fetchLlmModelsEndpoint, normalizeModelSelection } from 'shared/llm';

/**
 * Cache initialization and loading helpers
 */

/**
 * Initialize cache storage
 */
export async function initCacheStorage() {
    if (isChromeExtension()) return;
    LOGGER.debug('initCacheStorage');
    (window as any).defaultStore = await basicStore('local');
    (window as any).settingsStore = await basicStore('session');
}

/**
 * Load configuration from cache
 * @param {Object} context - Component context (for setting component properties)
 */
export async function loadFromCache(context) {
    const configuration = await loadExtensionConfigFromCache([
        CACHE_CONFIG.UI_IS_APPLICATION_TAB_VISIBLE.key,
        CACHE_CONFIG.BETA_SMARTINPUT_ENABLED.key,
        ...getLlmProviderConfigCacheKeys(),
    ]);

    if (context) {
        context.isApplicationTabVisible =
            configuration[CACHE_CONFIG.UI_IS_APPLICATION_TAB_VISIBLE.key];
        context.betaSmartInputEnabled = !!configuration[CACHE_CONFIG.BETA_SMARTINPUT_ENABLED.key];
    }

    const providerConfigs = resolveLlmProviderConfigMap(configuration);
    const aiProvider = getAiProviderFromConfig(configuration);
    const openaiKey = providerConfigs.openai.apiKey;
    const openaiUrl = providerConfigs.openai.baseUrl;
    const mistralKey = providerConfigs.mistral.apiKey;

    /* LOGGER.debug('loadFromCache - openaiKey', openaiKey);
    LOGGER.debug('loadFromCache - openaiUrl', openaiUrl);
    LOGGER.debug('loadFromCache - mistralKey', mistralKey);
    LOGGER.debug('loadFromCache - aiProvider', aiProvider); */

    store.dispatch(APPLICATION.reduxSlice.actions.updateProviderConfigs({ providerConfigs }));
    store.dispatch(APPLICATION.reduxSlice.actions.updateAiProvider({ aiProvider }));
    try {
        const response = await fetchLlmModelsEndpoint({ provider: aiProvider, providerConfigs });
        store.dispatch(
            APPLICATION.reduxSlice.actions.updateProviderCatalogs({ catalogs: response.catalogs })
        );

        if (response.catalog?.status === 'ok' && Array.isArray(response.catalog.models)) {
            const currentModel = store.getState()?.agent?.selectedModel;
            const normalizedModel = normalizeModelSelection(
                currentModel,
                response.catalog.models,
                response.catalog.defaultModel
            );
            if (normalizedModel && normalizedModel !== currentModel) {
                store.dispatch(
                    AGENT.reduxSlice.actions.updateSelectedModel({ model: normalizedModel })
                );
            }
        }
    } catch (error) {
        LOGGER.warn('loadFromCache - failed to refresh LLM catalog', error);
    }

    return {
        openaiKey,
        openaiUrl,
        mistralKey,
        aiProvider,
        providerConfigs,
        isApplicationTabVisible: configuration[CACHE_CONFIG.UI_IS_APPLICATION_TAB_VISIBLE.key],
        betaSmartInputEnabled: !!configuration[CACHE_CONFIG.BETA_SMARTINPUT_ENABLED.key],
    };
}
