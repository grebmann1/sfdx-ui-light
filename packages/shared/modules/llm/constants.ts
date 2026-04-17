export const LLM_PROVIDERS = ['openai', 'anthropic', 'gemini', 'mistral', 'grok', 'workbench'] as const;

export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export type LlmProviderConfig = {
    apiKey: string | null;
    baseUrl: string;
};

export type LlmProviderConfigMap = Record<LlmProvider, LlmProviderConfig>;

export type LlmModelOption = {
    label: string;
    value: string;
    provider: LlmProvider;
};

export type LlmCatalogStatus =
    | 'ok'
    | 'missing_key'
    | 'invalid_config'
    | 'upstream_error'
    | 'unsupported_provider';

export type LlmProviderCatalog = {
    provider: LlmProvider;
    status: LlmCatalogStatus;
    models: LlmModelOption[];
    defaultModel: string | null;
    error?: string | null;
};

export type LlmModelsEndpointResponse = {
    provider: LlmProvider;
    catalog: LlmProviderCatalog;
    catalogs: Record<LlmProvider, LlmProviderCatalog>;
};

export const DEFAULT_LLM_PROVIDER: LlmProvider = 'openai';

export const DEFAULT_PROVIDER_BASE_URLS: Record<LlmProvider, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    gemini: 'https://generativelanguage.googleapis.com',
    mistral: 'https://api.mistral.ai/v1',
    grok: 'https://api.x.ai/v1',
    workbench: '/openai/v1',
};

export const LLM_PROVIDER_OPTIONS: Array<{ label: string; value: LlmProvider }> = [
    { label: 'OpenAI', value: 'openai' },
    { label: 'Anthropic', value: 'anthropic' },
    { label: 'Gemini', value: 'gemini' },
    { label: 'Mistral', value: 'mistral' },
    { label: 'xAI Grok', value: 'grok' },
    { label: 'Workbench (Free Tier)', value: 'workbench' },
];

export const OPENAI_MODEL_OPTIONS: LlmModelOption[] = [
    { label: 'gpt-5-mini', value: 'gpt-5-mini', provider: 'openai' },
    { label: 'gpt-5', value: 'gpt-5-2025-08-07', provider: 'openai' },
    { label: 'gpt-5-codex', value: 'gpt-5-codex', provider: 'openai' },
    { label: 'gpt-5.3-codex', value: 'gpt-5.3-codex', provider: 'openai' },
    { label: 'gpt-5-nano', value: 'gpt-5-nano-2025-08-07', provider: 'openai' },
    { label: 'gpt-5.4', value: 'gpt-5.4', provider: 'openai' },
    { label: 'gpt-5.4-mini', value: 'gpt-5.4-mini', provider: 'openai' },
    { label: 'gpt-5.4-nano', value: 'gpt-5.4-nano', provider: 'openai' },
];

export const INTERNAL_OPENAI_MODEL_OPTIONS: LlmModelOption[] = [
    { label: 'gpt-5-mini', value: 'gpt-5-mini', provider: 'openai' },
    { label: 'gpt-5', value: 'gpt-5', provider: 'openai' },
];

export const ANTHROPIC_MODEL_OPTIONS: LlmModelOption[] = [
    { label: 'claude-opus-4-6', value: 'claude-opus-4-6', provider: 'anthropic' },
    { label: 'claude-sonnet-4-6', value: 'claude-sonnet-4-6', provider: 'anthropic' },
    {
        label: 'claude-haiku-4-5-20251001',
        value: 'claude-haiku-4-5-20251001',
        provider: 'anthropic',
    },
];

export const GEMINI_MODEL_OPTIONS: LlmModelOption[] = [
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

export const MISTRAL_MODEL_OPTIONS: LlmModelOption[] = [
    { label: 'mistral-small-2603', value: 'mistral-small-2603', provider: 'mistral' },
    { label: 'mistral-large-2512', value: 'mistral-large-2512', provider: 'mistral' },
    { label: 'devstral-2512', value: 'devstral-2512', provider: 'mistral' },
    { label: 'mistral-medium-2508', value: 'mistral-medium-2508', provider: 'mistral' },
];

export const WORKBENCH_MODEL_OPTIONS: LlmModelOption[] = [
    { label: 'gpt-4o-mini (Free Tier)', value: 'gpt-4o-mini', provider: 'workbench' },
    { label: 'gpt-4o (Free Tier)', value: 'gpt-4o', provider: 'workbench' },
];

export const GROK_MODEL_OPTIONS: LlmModelOption[] = [
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

export const PROVIDER_MODEL_OPTIONS: Record<LlmProvider, LlmModelOption[]> = {
    openai: OPENAI_MODEL_OPTIONS,
    anthropic: ANTHROPIC_MODEL_OPTIONS,
    gemini: GEMINI_MODEL_OPTIONS,
    mistral: MISTRAL_MODEL_OPTIONS,
    grok: GROK_MODEL_OPTIONS,
    workbench: WORKBENCH_MODEL_OPTIONS,
};
