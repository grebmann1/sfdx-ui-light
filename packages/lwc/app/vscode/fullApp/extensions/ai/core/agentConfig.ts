/* eslint-disable import/no-unresolved */
import {
    getAiProviderFromConfig,
    getLlmProviderConfigCacheKeys,
    loadExtensionConfigFromCache,
    resolveLlmProviderConfigMap,
} from 'shared/cacheManager';
import {
    fetchLlmModelsEndpoint,
    getDefaultModelForProvider,
    INTERNAL_OPENAI_MODEL_OPTIONS,
    isInternalProviderBaseUrl,
    OPENAI_MODEL_OPTIONS,
} from 'shared/llm';

export const WORKBENCH_RUNTIME_MODELS = OPENAI_MODEL_OPTIONS.map(model => ({
    label: model.label,
    value: model.value,
}));
export const WORKBENCH_INTERNAL_MODELS = INTERNAL_OPENAI_MODEL_OPTIONS.map(model => ({
    label: model.label,
    value: model.value,
}));
export const WORKBENCH_REASONING_OPTIONS = [
    { value: 'none', label: 'None' },
    { value: 'minimal', label: 'Minimal' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'xhigh', label: 'X-High' },
];
export const DEFAULT_WORKBENCH_MODEL =
    getDefaultModelForProvider('openai') || WORKBENCH_RUNTIME_MODELS[0].value;
export const DEFAULT_WORKBENCH_INTERNAL_MODEL = WORKBENCH_INTERNAL_MODELS[0].value;
export const DEFAULT_WORKBENCH_REASONING = WORKBENCH_REASONING_OPTIONS[2].value;
export const WORKBENCH_MODEL_CONTEXT_WINDOW = 128000;
export const WORKBENCH_MAX_TOOL_ROUNDS = 400;
export const WORKBENCH_AGENT_SYSTEM_PROMPT = `You are a dedicated coding agent operating inside an embedded VS Code workbench.

You have access to VS Code-native tools for reading, editing, creating, saving, opening, and deleting files in the current workspace.

- Prefer workspace discovery tools before guessing file paths.
- Prefer targeted edits over broad rewrites.
- Prefer range reads for large files.
- Use create tools only for new files and edit tools for existing files.
- Explain errors clearly when a tool reports failure.
- Keep responses concise and practical for coding tasks.`;

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
        } catch {
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
