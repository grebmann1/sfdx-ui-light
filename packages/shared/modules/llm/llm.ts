import {
    DEFAULT_LLM_PROVIDER,
    DEFAULT_PROVIDER_BASE_URLS,
    INTERNAL_OPENAI_MODEL_OPTIONS,
    LLM_PROVIDERS,
    LLM_PROVIDER_OPTIONS,
    OPENAI_MODEL_OPTIONS,
    PROVIDER_MODEL_OPTIONS,
    type LlmModelOption,
    type LlmProvider,
    type LlmModelsEndpointResponse,
    type LlmProviderConfig,
    type LlmProviderConfigMap,
} from './constants';

export * from './constants';

function normalizeString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

export function isLlmProvider(value: unknown): value is LlmProvider {
    return typeof value === 'string' && (LLM_PROVIDERS as readonly string[]).includes(value);
}

export function normalizeLlmProvider(value: unknown): LlmProvider {
    return isLlmProvider(value) ? value : DEFAULT_LLM_PROVIDER;
}

export function getDefaultProviderConfig(provider: LlmProvider): LlmProviderConfig {
    return {
        apiKey: null,
        baseUrl: DEFAULT_PROVIDER_BASE_URLS[provider],
    };
}

export function createDefaultProviderConfigMap(): LlmProviderConfigMap {
    return LLM_PROVIDERS.reduce((configs, provider) => {
        configs[provider] = getDefaultProviderConfig(provider);
        return configs;
    }, {} as LlmProviderConfigMap);
}

export function normalizeProviderConfig(provider: LlmProvider, config: unknown): LlmProviderConfig {
    const defaults = getDefaultProviderConfig(provider);
    const record = config && typeof config === 'object' ? (config as Record<string, unknown>) : {};
    const apiKey = normalizeString(record.apiKey);
    const baseUrl = normalizeString(record.baseUrl);
    return {
        apiKey: apiKey || null,
        baseUrl: baseUrl || defaults.baseUrl,
    };
}

export function normalizeProviderConfigMap(configs: unknown): LlmProviderConfigMap {
    const record =
        configs && typeof configs === 'object' ? (configs as Record<string, unknown>) : {};
    return LLM_PROVIDERS.reduce((normalizedConfigs, provider) => {
        normalizedConfigs[provider] = normalizeProviderConfig(provider, record[provider]);
        return normalizedConfigs;
    }, createDefaultProviderConfigMap());
}

export function getProviderOptions() {
    return LLM_PROVIDER_OPTIONS;
}

export function getProviderModelOptions(provider: LlmProvider): LlmModelOption[] {
    return PROVIDER_MODEL_OPTIONS[provider] || [];
}

export function getDefaultModelForProvider(provider: LlmProvider): string | null {
    return getProviderModelOptions(provider)[0]?.value || null;
}

export function normalizeModelSelection(
    model: unknown,
    options: LlmModelOption[],
    fallbackValue?: string | null
): string | null {
    const safeOptions = Array.isArray(options) ? options : [];
    const normalized = normalizeString(model);
    const fallback = fallbackValue ?? safeOptions[0]?.value ?? null;
    if (!normalized) return fallback;

    const lowered = normalized.toLowerCase();
    const exactValue = safeOptions.find(option => option.value === normalized);
    if (exactValue) return exactValue.value;

    const caseInsensitiveValue = safeOptions.find(option => option.value.toLowerCase() === lowered);
    if (caseInsensitiveValue) return caseInsensitiveValue.value;

    const labelMatch = safeOptions.find(option => option.label.toLowerCase() === lowered);
    if (labelMatch) return labelMatch.value;

    const aliasMatch = safeOptions.find(option =>
        option.value.toLowerCase().startsWith(`${lowered}-`)
    );
    if (aliasMatch) return aliasMatch.value;

    return fallback;
}

export function isInternalProviderBaseUrl(baseUrl: unknown): boolean {
    return normalizeString(baseUrl).includes('eng-ai-model-gateway');
}

export function resolveOpenAiCompatibleModels(isInternal = false): LlmModelOption[] {
    return isInternal ? INTERNAL_OPENAI_MODEL_OPTIONS : OPENAI_MODEL_OPTIONS;
}

function getWorkbenchBaseUrl(): string {
    return normalizeString(process.env.WORKBENCH_BASE_URL).replace(/\/+$/, '');
}

function resolveWorkbenchEndpoint(pathname: string): string {
    const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
    const baseUrl = getWorkbenchBaseUrl();
    return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}

export async function fetchLlmModelsEndpoint({
    provider,
    providerConfigs,
}: {
    provider: LlmProvider;
    providerConfigs: LlmProviderConfigMap;
}): Promise<LlmModelsEndpointResponse> {
    const response = await fetch(resolveWorkbenchEndpoint('/api/llm/models'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            provider,
            providerConfigs: normalizeProviderConfigMap(providerConfigs),
        }),
    });

    if (!response.ok) {
        throw new Error(`Model catalog request failed with status ${response.status}.`);
    }

    return response.json();
}
