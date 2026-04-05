/* eslint-disable import/no-unresolved */
import { CACHE_CONFIG, loadExtensionConfigFromCache } from 'shared/cacheManager';

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

export function getReasoningConfigFromSelection(selection) {
    if (selection === 'off' || selection === 'none' || !selection) {
        return undefined;
    }
    return { reasoningEffort: selection, reasoningSummary: 'auto' };
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

export function resolveWorkbenchModelId(requestedModelId, isInternal = false) {
    const normalized = typeof requestedModelId === 'string' ? requestedModelId.trim() : '';
    const supportedModels = isInternal ? WORKBENCH_INTERNAL_MODELS : WORKBENCH_RUNTIME_MODELS;
    const supportedValues = new Set(supportedModels.map(model => model.value));
    if (supportedValues.has(normalized)) {
        return normalized;
    }
    return isInternal ? DEFAULT_WORKBENCH_INTERNAL_MODEL : DEFAULT_WORKBENCH_MODEL;
}

export async function resolveWorkbenchAgentSettings({ modelId, reasoning } = {}) {
    const cachedConfig = await loadExtensionConfigFromCache([
        CACHE_CONFIG.OPENAI_KEY.key,
        CACHE_CONFIG.OPENAI_URL.key,
    ]).catch(() => ({}));

    const openaiKey =
        typeof cachedConfig?.[CACHE_CONFIG.OPENAI_KEY.key] === 'string'
            ? cachedConfig[CACHE_CONFIG.OPENAI_KEY.key].trim()
            : '';
    const openaiUrl =
        typeof cachedConfig?.[CACHE_CONFIG.OPENAI_URL.key] === 'string'
            ? cachedConfig[CACHE_CONFIG.OPENAI_URL.key].trim()
            : CACHE_CONFIG.OPENAI_URL.defaultValue;
    const isInternal = typeof openaiUrl === 'string' && openaiUrl.includes('eng-ai-model-gateway');

    return {
        openaiKey,
        openaiUrl,
        isInternal,
        selectedModel: resolveWorkbenchModelId(modelId, isInternal),
        selectedReasoning: resolveWorkbenchReasoningSelection(reasoning),
        modelContextWindow: WORKBENCH_MODEL_CONTEXT_WINDOW,
        maxToolRounds: WORKBENCH_MAX_TOOL_ROUNDS,
        systemPrompt: WORKBENCH_AGENT_SYSTEM_PROMPT,
    };
}
