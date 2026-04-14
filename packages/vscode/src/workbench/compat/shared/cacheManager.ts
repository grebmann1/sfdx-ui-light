const DEFAULT_PROVIDER = 'openai'

type ProviderConfig = {
  apiKey?: string
  baseUrl?: string
}

function getStorage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function getLlmProviderConfigCacheKeys() {
  return ['llmProvider', 'llmProviderConfigs']
}

export async function loadExtensionConfigFromCache(keys: string[] = []) {
  const storage = getStorage()
  if (!storage) {
    return {}
  }
  const output: Record<string, unknown> = {}
  for (const key of keys) {
    const value = storage.getItem(key)
    if (!value) {
      continue
    }
    try {
      output[key] = JSON.parse(value)
    } catch {
      output[key] = value
    }
  }
  return output
}

function normalizeProviderConfig(input: unknown): ProviderConfig {
  if (!input || typeof input !== 'object') {
    return {}
  }
  const record = input as Record<string, unknown>
  return {
    apiKey: typeof record.apiKey === 'string' ? record.apiKey : '',
    baseUrl: typeof record.baseUrl === 'string' ? record.baseUrl : ''
  }
}

export function resolveLlmProviderConfigMap(config: Record<string, unknown>) {
  const rawConfigs =
    config.llmProviderConfigs && typeof config.llmProviderConfigs === 'object'
      ? (config.llmProviderConfigs as Record<string, unknown>)
      : {}

  return {
    openai: normalizeProviderConfig(rawConfigs.openai),
    anthropic: normalizeProviderConfig(rawConfigs.anthropic),
    google: normalizeProviderConfig(rawConfigs.google)
  }
}

export function getAiProviderFromConfig(config: Record<string, unknown>) {
  const provider = typeof config.llmProvider === 'string' ? config.llmProvider.trim() : ''
  return provider || DEFAULT_PROVIDER
}
