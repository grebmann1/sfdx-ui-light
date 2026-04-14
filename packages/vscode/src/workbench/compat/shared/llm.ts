type Provider = 'openai' | 'anthropic' | 'google'

type ModelOption = {
  label: string
  value: string
  provider?: Provider
}

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google'
}

const MODEL_OPTIONS: Record<Provider, ModelOption[]> = {
  openai: [
    { label: 'GPT-4.1', value: 'gpt-4.1' },
    { label: 'GPT-4o', value: 'gpt-4o' },
    { label: 'GPT-4o Mini', value: 'gpt-4o-mini' }
  ],
  anthropic: [
    { label: 'Claude Sonnet 4', value: 'claude-sonnet-4-20250514' },
    { label: 'Claude 3.7 Sonnet', value: 'claude-3-7-sonnet-latest' }
  ],
  google: [
    { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
    { label: 'Gemini 2.0 Flash Lite', value: 'gemini-2.0-flash-lite' }
  ]
}

export const OPENAI_MODEL_OPTIONS = MODEL_OPTIONS.openai
export const INTERNAL_OPENAI_MODEL_OPTIONS: ModelOption[] = [
  { label: 'GPT-4.1', value: 'gpt-4.1' },
  { label: 'GPT-4o', value: 'gpt-4o' }
]

function toProvider(value: unknown): Provider {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (normalized === 'anthropic' || normalized === 'google') {
    return normalized
  }
  return 'openai'
}

export function normalizeLlmProvider(value: unknown) {
  return toProvider(value)
}

export function getProviderLabel(provider: unknown) {
  return PROVIDER_LABELS[toProvider(provider)]
}

export function getProviderModelOptions(provider: unknown) {
  return MODEL_OPTIONS[toProvider(provider)]
}

export function getDefaultModelForProvider(provider: unknown) {
  const options = getProviderModelOptions(provider)
  return options[0]?.value ?? 'gpt-4.1'
}

export function normalizeModelSelection(
  requestedModel: unknown,
  options: Array<ModelOption> = [],
  fallbackModel = ''
) {
  const normalized = typeof requestedModel === 'string' ? requestedModel.trim() : ''
  if (!normalized) {
    return fallbackModel || options[0]?.value || ''
  }
  const allowed = new Set(options.map((option) => option.value))
  return allowed.has(normalized) ? normalized : fallbackModel || options[0]?.value || normalized
}

export function isInternalProviderBaseUrl(baseUrl: unknown) {
  const value = typeof baseUrl === 'string' ? baseUrl.toLowerCase() : ''
  return value.includes('salesforce.com') || value.includes('internal')
}

export function resolveAgentProviderBaseUrl(provider: unknown, baseUrl: unknown) {
  const normalized = typeof baseUrl === 'string' ? baseUrl.trim() : ''
  if (normalized) {
    return normalized
  }
  switch (toProvider(provider)) {
    case 'anthropic':
      return 'https://api.anthropic.com/v1'
    case 'google':
      return 'https://generativelanguage.googleapis.com/v1beta'
    case 'openai':
    default:
      return 'https://api.openai.com/v1'
  }
}

export function buildAvailableAgentModelOptions({
  availableModelsByProvider,
  providerConfigs
}: {
  availableModelsByProvider?: Record<string, unknown>
  providerConfigs?: Record<string, unknown>
}) {
  const providers = (['openai', 'anthropic', 'google'] as Provider[]).filter((provider) => {
    const config = (providerConfigs?.[provider] ?? {}) as Record<string, unknown>
    return typeof config.apiKey === 'string' ? config.apiKey.trim().length > 0 : true
  })

  const built: ModelOption[] = []
  for (const provider of providers) {
    const catalog = availableModelsByProvider?.[provider]
    if (Array.isArray(catalog) && catalog.length > 0) {
      for (const entry of catalog) {
        if (!entry || typeof entry !== 'object') {
          continue
        }
        const record = entry as Record<string, unknown>
        const value = typeof record.value === 'string' ? record.value : ''
        if (!value) {
          continue
        }
        built.push({
          label: typeof record.label === 'string' ? record.label : value,
          value,
          provider
        })
      }
      continue
    }
    for (const fallbackOption of MODEL_OPTIONS[provider]) {
      built.push({ ...fallbackOption, provider })
    }
  }
  return built
}

export async function fetchLlmModelsEndpoint({
  provider
}: {
  provider: unknown
  providerConfigs?: Record<string, unknown>
}) {
  const normalizedProvider = toProvider(provider)
  return {
    catalogs: {
      [normalizedProvider]: MODEL_OPTIONS[normalizedProvider]
    }
  }
}
