import type { Application, NextFunction, Request, Response } from 'express';

type LlmProvider = 'openai' | 'anthropic' | 'gemini' | 'mistral' | 'grok';
type LlmModelOption = {
    label: string;
    value: string;
    provider: LlmProvider;
};
type LlmProviderConfig = {
    apiKey: string | null;
    baseUrl: string;
};
type LlmProviderConfigMap = Record<LlmProvider, LlmProviderConfig>;
type LlmProviderCatalog = {
    provider: LlmProvider;
    status: 'ok' | 'missing_key' | 'invalid_config' | 'upstream_error' | 'unsupported_provider';
    models: LlmModelOption[];
    defaultModel: string | null;
    error?: string | null;
};

const DEFAULT_LLM_PROVIDER: LlmProvider = 'openai';
const LLM_PROVIDERS: LlmProvider[] = ['openai', 'anthropic', 'gemini', 'mistral', 'grok'];
const DEFAULT_PROVIDER_BASE_URLS: Record<LlmProvider, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    gemini: 'https://generativelanguage.googleapis.com',
    mistral: 'https://api.mistral.ai/v1',
    grok: 'https://api.x.ai/v1',
};
const OPENAI_MODEL_OPTIONS: LlmModelOption[] = [
    { label: 'gpt-5-mini', value: 'gpt-5-mini', provider: 'openai' },
    { label: 'gpt-5', value: 'gpt-5-2025-08-07', provider: 'openai' },
    { label: 'gpt-5-codex', value: 'gpt-5-codex', provider: 'openai' },
    { label: 'gpt-5.3-codex', value: 'gpt-5.3-codex', provider: 'openai' },
    { label: 'gpt-5-nano', value: 'gpt-5-nano-2025-08-07', provider: 'openai' },
    { label: 'gpt-5.4', value: 'gpt-5.4', provider: 'openai' },
    { label: 'gpt-5.4-mini', value: 'gpt-5.4-mini', provider: 'openai' },
    { label: 'gpt-5.4-nano', value: 'gpt-5.4-nano', provider: 'openai' },
];
const ANTHROPIC_MODEL_OPTIONS: LlmModelOption[] = [
    { label: 'claude-opus-4-6', value: 'claude-opus-4-6', provider: 'anthropic' },
    { label: 'claude-sonnet-4-6', value: 'claude-sonnet-4-6', provider: 'anthropic' },
    {
        label: 'claude-haiku-4-5-20251001',
        value: 'claude-haiku-4-5-20251001',
        provider: 'anthropic',
    },
];
const GEMINI_MODEL_OPTIONS: LlmModelOption[] = [
    { label: 'gemini-3-flash-preview', value: 'gemini-3-flash-preview', provider: 'gemini' },
    {
        label: 'gemini-3.1-flash-lite-preview',
        value: 'gemini-3.1-flash-lite-preview',
        provider: 'gemini',
    },
    {
        label: 'gemini-3.1-pro-preview',
        value: 'gemini-3.1-pro-preview',
        provider: 'gemini',
    },
];
const MISTRAL_MODEL_OPTIONS: LlmModelOption[] = [
    { label: 'mistral-small-2603', value: 'mistral-small-2603', provider: 'mistral' },
    { label: 'mistral-large-2512', value: 'mistral-large-2512', provider: 'mistral' },
    { label: 'devstral-2512', value: 'devstral-2512', provider: 'mistral' },
    { label: 'mistral-medium-2508', value: 'mistral-medium-2508', provider: 'mistral' },
];
const GROK_MODEL_OPTIONS: LlmModelOption[] = [
    {
        label: 'grok-4.20-0309-reasoning',
        value: 'grok-4.20-0309-reasoning',
        provider: 'grok',
    },
    {
        label: 'grok-4.20-multi-agent-0309',
        value: 'grok-4.20-multi-agent-0309',
        provider: 'grok',
    },
    {
        label: 'grok-4-1-fast-reasoning',
        value: 'grok-4-1-fast-reasoning',
        provider: 'grok',
    },
];

function normalizeString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeLlmProvider(value: unknown): LlmProvider {
    return LLM_PROVIDERS.includes(value as LlmProvider)
        ? (value as LlmProvider)
        : DEFAULT_LLM_PROVIDER;
}

function normalizeProviderConfigMap(configs: unknown): LlmProviderConfigMap {
    const record =
        configs && typeof configs === 'object' ? (configs as Record<string, unknown>) : {};
    return LLM_PROVIDERS.reduce((normalized, provider) => {
        const current =
            record[provider] && typeof record[provider] === 'object'
                ? (record[provider] as Record<string, unknown>)
                : {};
        normalized[provider] = {
            apiKey: normalizeString(current.apiKey) || null,
            baseUrl: normalizeString(current.baseUrl) || DEFAULT_PROVIDER_BASE_URLS[provider],
        };
        return normalized;
    }, {} as LlmProviderConfigMap);
}

function getProviderModelOptions(provider: LlmProvider): LlmModelOption[] {
    switch (provider) {
        case 'openai':
            return OPENAI_MODEL_OPTIONS;
        case 'anthropic':
            return ANTHROPIC_MODEL_OPTIONS;
        case 'gemini':
            return GEMINI_MODEL_OPTIONS;
        case 'mistral':
            return MISTRAL_MODEL_OPTIONS;
        case 'grok':
            return GROK_MODEL_OPTIONS;
        default:
            return [];
    }
}

function getDefaultModelForProvider(provider: LlmProvider): string | null {
    return getProviderModelOptions(provider)[0]?.value || null;
}

function isInternalProviderBaseUrl(baseUrl: unknown): boolean {
    return normalizeString(baseUrl).includes('eng-ai-model-gateway');
}

type LlmModelsRequestBody = {
    provider?: string;
    providerConfigs?: LlmProviderConfigMap;
};

function toBaseUrl(baseUrl: string): string {
    return baseUrl.replace(/\/+$/, '');
}

async function fetchGatewayModels(
    config: LlmProviderConfigMap['openai']
): Promise<Awaited<ReturnType<typeof getOpenAiCatalog>>> {
    if (!config.apiKey) {
        return {
            provider: 'openai',
            status: 'missing_key',
            models: [],
            defaultModel: null,
            error: 'OpenAI API key is required to load models.',
        };
    }

    try {
        const response = await fetch(`${toBaseUrl(config.baseUrl)}/models`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            return {
                provider: 'openai',
                status: 'upstream_error',
                models: [],
                defaultModel: null,
                error: `Gateway model lookup failed with status ${response.status}.`,
            };
        }
        const payload = await response.json();
        const upstreamModels: LlmModelOption[] = Array.isArray(payload?.data)
            ? payload.data
                  .map(item => {
                      const id = typeof item?.id === 'string' ? item.id.trim() : '';
                      return id ? { label: id, value: id, provider: 'openai' as const } : null;
                  })
                  .filter((item): item is LlmModelOption => item !== null)
            : [];
        return {
            provider: 'openai',
            status: 'ok',
            models: upstreamModels,
            defaultModel: upstreamModels[0]?.value || null,
            error: null,
        };
    } catch (error) {
        return {
            provider: 'openai',
            status: 'upstream_error',
            models: [],
            defaultModel: null,
            error: error instanceof Error ? error.message : 'Unable to load gateway models.',
        };
    }
}

async function getOpenAiCatalog(
    config: LlmProviderConfigMap['openai']
): Promise<LlmProviderCatalog> {
    if (!config.baseUrl) {
        return {
            provider: 'openai',
            status: 'invalid_config',
            models: [],
            defaultModel: null,
            error: 'OpenAI base URL is required.',
        };
    }

    if (isInternalProviderBaseUrl(config.baseUrl)) {
        return fetchGatewayModels(config);
    }

    const models = getProviderModelOptions('openai');
    return {
        provider: 'openai',
        status: config.apiKey ? 'ok' : 'missing_key',
        models,
        defaultModel: getDefaultModelForProvider('openai'),
        error: config.apiKey ? null : 'OpenAI API key is required to load models.',
    };
}

function getStaticProviderCatalog(
    provider: Exclude<LlmProvider, 'openai'>,
    config: LlmProviderConfig
): LlmProviderCatalog {
    const models = getProviderModelOptions(provider);
    return {
        provider,
        status: !config.baseUrl ? 'invalid_config' : config.apiKey ? 'ok' : 'missing_key',
        models,
        defaultModel: getDefaultModelForProvider(provider),
        error: !config.baseUrl
            ? `${provider} base URL is required.`
            : config.apiKey
              ? null
              : `${provider} API key is required to load models.`,
    };
}

async function buildCatalogs(providerConfigs: LlmProviderConfigMap) {
    const catalogs = {} as Record<LlmProvider, LlmProviderCatalog>;
    for (const provider of LLM_PROVIDERS) {
        if (provider === 'openai') {
            catalogs.openai = await getOpenAiCatalog(providerConfigs.openai);
            continue;
        }
        catalogs[provider] = getStaticProviderCatalog(provider, providerConfigs[provider]);
    }
    return catalogs;
}

export default function llmModels(app: Application, path = '/api/llm/models') {
    app.post(path, async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = (req.body || {}) as LlmModelsRequestBody;
            const activeProvider = normalizeLlmProvider(body.provider || DEFAULT_LLM_PROVIDER);
            const providerConfigs = normalizeProviderConfigMap(body.providerConfigs);
            const catalogs = await buildCatalogs(providerConfigs);
            res.json({
                provider: activeProvider,
                catalog: catalogs[activeProvider],
                catalogs,
            });
        } catch (error) {
            next(error);
        }
    });
}

export const __testables = {
    buildCatalogs,
    getOpenAiCatalog,
    getStaticProviderCatalog,
    normalizeProviderConfigMap,
};
