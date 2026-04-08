/* eslint-disable import/no-unresolved */
import {
    CACHE_CONFIG,
    getAiProviderFromConfig,
    getLlmProviderConfigCacheKeys,
    loadExtensionConfigFromCache,
    resolveLlmProviderConfigMap,
} from 'shared/cacheManager';
import { fetchLlmModelsEndpoint, isInternalProviderBaseUrl } from 'shared/llm';

import {
    DEFAULT_WORKBENCH_INTERNAL_MODEL,
    DEFAULT_WORKBENCH_MODEL,
    DEFAULT_WORKBENCH_REASONING,
    WORKBENCH_AGENT_SYSTEM_PROMPT,
    WORKBENCH_INTERNAL_MODELS,
    WORKBENCH_MAX_TOOL_ROUNDS,
    WORKBENCH_MODEL_CONTEXT_WINDOW,
    WORKBENCH_REASONING_OPTIONS,
    WORKBENCH_RUNTIME_MODELS,
} from '../constants.js';

export {
    DEFAULT_WORKBENCH_INTERNAL_MODEL,
    DEFAULT_WORKBENCH_MODEL,
    DEFAULT_WORKBENCH_REASONING,
    WORKBENCH_AGENT_SYSTEM_PROMPT,
    WORKBENCH_INTERNAL_MODELS,
    WORKBENCH_MAX_TOOL_ROUNDS,
    WORKBENCH_MODEL_CONTEXT_WINDOW,
    WORKBENCH_REASONING_OPTIONS,
    WORKBENCH_RUNTIME_MODELS,
};

export function resolveWorkbenchOpenAiBaseUrl(openaiUrl) {
    return openaiUrl || 'https://api.openai.com/v1';
}

export function isAbortLikeError(error) {
    const name = error?.name || '';
    const message = error?.message || '';
    return name === 'AbortError' || String(message).toLowerCase().includes('aborted');
}

export function resolveWorkbenchReasoningSelection(selection) {
    const normalized = typeof selection === 'string' ? selection.trim() : '';
    const allowed = new Set(WORKBENCH_REASONING_OPTIONS.map(option => option.value));
    return allowed.has(normalized) ? normalized : DEFAULT_WORKBENCH_REASONING;
}

export function resolveWorkbenchModelId(requestedModelId, isInternal = false, availableModels) {
    const normalized = typeof requestedModelId === 'string' ? requestedModelId.trim() : '';
    const supportedModels =
        Array.isArray(availableModels) && availableModels.length > 0
            ? availableModels
            : isInternal
              ? WORKBENCH_INTERNAL_MODELS
              : WORKBENCH_RUNTIME_MODELS;
    const supportedValues = new Set(supportedModels.map(model => model.value));
    if (supportedValues.has(normalized)) {
        return normalized;
    }
    return isInternal ? DEFAULT_WORKBENCH_INTERNAL_MODEL : DEFAULT_WORKBENCH_MODEL;
}

export async function resolveWorkbenchAgentSettings({ modelId, reasoning } = {}) {
    const cachedConfig = await loadExtensionConfigFromCache(getLlmProviderConfigCacheKeys()).catch(
        () => ({})
    );
    const providerConfigs = resolveLlmProviderConfigMap(cachedConfig);
    const aiProvider = getAiProviderFromConfig(cachedConfig);
    const openaiKey = providerConfigs.openai.apiKey || '';
    const openaiUrl = resolveWorkbenchOpenAiBaseUrl(providerConfigs.openai.baseUrl);
    const isInternal = isInternalProviderBaseUrl(openaiUrl);
    let availableModels;

    if (aiProvider === 'openai') {
        try {
            const response = await fetchLlmModelsEndpoint({
                provider: 'openai',
                providerConfigs,
            });
            if (response.catalog?.status === 'ok' && Array.isArray(response.catalog.models)) {
                availableModels = response.catalog.models.map(model => ({
                    label: model.label,
                    value: model.value,
                }));
            }
        } catch (_error) {
            availableModels = undefined;
        }
    }

    return {
        openaiKey,
        openaiUrl,
        isInternal,
        selectedModel: resolveWorkbenchModelId(modelId, isInternal, availableModels),
        selectedReasoning: resolveWorkbenchReasoningSelection(reasoning),
        modelContextWindow: WORKBENCH_MODEL_CONTEXT_WINDOW,
        maxToolRounds: WORKBENCH_MAX_TOOL_ROUNDS,
        systemPrompt: WORKBENCH_AGENT_SYSTEM_PROMPT,
    };
}
