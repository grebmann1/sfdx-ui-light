/* eslint-disable import/no-unresolved */
import {
    getAiProviderFromConfig,
    getLlmProviderConfigCacheKeys,
    loadExtensionConfigFromCache,
    resolveLlmProviderConfigMap,
} from 'shared/cacheManager';
import {
    buildAvailableAgentModelOptions,
    fetchLlmModelsEndpoint,
    getDefaultModelForProvider,
    getProviderLabel,
    getProviderModelOptions,
    INTERNAL_OPENAI_MODEL_OPTIONS,
    isInternalProviderBaseUrl,
    normalizeLlmProvider,
    normalizeModelSelection,
    OPENAI_MODEL_OPTIONS,
    resolveAgentProviderBaseUrl,
} from 'shared/llm';

function toModelSelectionOptions(models = []) {
    return models.map(model => ({
        label: model.label,
        value: model.value,
    }));
}

export const WORKBENCH_RUNTIME_MODELS = toModelSelectionOptions(OPENAI_MODEL_OPTIONS);
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

export function getDefaultWorkbenchModelOptions(provider, isInternal = false) {
    const normalizedProvider = normalizeLlmProvider(provider);
    if (normalizedProvider === 'openai' && isInternal) {
        return INTERNAL_OPENAI_MODEL_OPTIONS;
    }
    return getProviderModelOptions(normalizedProvider);
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

type WorkbenchAgentSettingsOptions = {
    modelId?: string;
    reasoning?: string;
};

export async function resolveWorkbenchAgentSettings(options: WorkbenchAgentSettingsOptions = {}) {
    const { modelId, reasoning } = options;
    const cachedConfig = await loadExtensionConfigFromCache(getLlmProviderConfigCacheKeys()).catch(
        () => ({})
    );
    const providerConfigs = resolveLlmProviderConfigMap(cachedConfig);
    const selectedProvider = normalizeLlmProvider(getAiProviderFromConfig(cachedConfig));
    const providerConfig = providerConfigs[selectedProvider] || providerConfigs.openai;
    const providerKey = providerConfig?.apiKey || '';
    const providerBaseUrl = resolveAgentProviderBaseUrl(
        selectedProvider,
        providerConfig?.baseUrl || ''
    );
    const isInternal =
        selectedProvider === 'openai' && isInternalProviderBaseUrl(providerBaseUrl || '');
    let availableModelsByProvider;

    try {
        const response = await fetchLlmModelsEndpoint({
            provider: selectedProvider,
            providerConfigs,
        });
        availableModelsByProvider = response.catalogs;
    } catch {
        availableModelsByProvider = undefined;
    }

    const availableModels = buildAvailableAgentModelOptions({
        availableModelsByProvider,
        providerConfigs,
    }).filter(model => model.provider === selectedProvider);
    const fallbackModels =
        availableModels.length > 0
            ? availableModels
            : getDefaultWorkbenchModelOptions(selectedProvider, isInternal);
    const selectedModel =
        normalizeModelSelection(
            modelId,
            fallbackModels,
            getDefaultModelForProvider(selectedProvider)
        ) || getDefaultModelForProvider(selectedProvider);

    return {
        provider: selectedProvider,
        providerLabel: getProviderLabel(selectedProvider),
        providerConfigs,
        providerKey,
        providerBaseUrl,
        isInternal,
        availableModels: toModelSelectionOptions(fallbackModels),
        selectedModel,
        selectedReasoning: resolveWorkbenchReasoningSelection(reasoning),
        modelContextWindow: WORKBENCH_MODEL_CONTEXT_WINDOW,
        maxToolRounds: WORKBENCH_MAX_TOOL_ROUNDS,
        systemPrompt: WORKBENCH_AGENT_SYSTEM_PROMPT,
    };
}

export const __testables = {
    getDefaultWorkbenchModelOptions,
};
