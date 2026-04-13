import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'

type ProviderKey = 'openai' | 'anthropic' | 'google'

type ProviderConfig = {
  provider: string
  apiKey?: string
  baseUrl?: string
}

type ProviderModelSelection = {
  provider: string
  modelId: string
  isInternal?: boolean
}

function normalizeProvider(provider: unknown): ProviderKey {
  const normalized = typeof provider === 'string' ? provider.trim().toLowerCase() : ''
  if (normalized === 'anthropic' || normalized === 'google') {
    return normalized
  }
  return 'openai'
}

export function createProviderInstance({
  provider,
  apiKey,
  baseUrl
}: ProviderConfig) {
  const normalized = normalizeProvider(provider)
  if (normalized === 'anthropic') {
    return createAnthropic({
      apiKey,
      baseURL: baseUrl || undefined
    })
  }
  if (normalized === 'google') {
    return createGoogleGenerativeAI({
      apiKey,
      baseURL: baseUrl || undefined
    })
  }
  return createOpenAI({
    apiKey,
    baseURL: baseUrl || undefined
  })
}

export function resolveProviderModelInstance(
  providerInstance: ((modelId: string) => unknown) | { languageModel?: (id: string) => unknown },
  { modelId }: ProviderModelSelection
) {
  if (typeof providerInstance === 'function') {
    return providerInstance(modelId)
  }
  if (typeof providerInstance?.languageModel === 'function') {
    return providerInstance.languageModel(modelId)
  }
  throw new Error('Unsupported provider instance.')
}

export function getReasoningConfigFromSelection(selection: unknown) {
  const normalized = typeof selection === 'string' ? selection.trim().toLowerCase() : ''
  const allowed = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh'])
  return allowed.has(normalized) ? normalized : 'none'
}

export function resolveProviderOptions({
  provider,
  reasoningConfig
}: {
  provider: string
  reasoningConfig?: string
  isInternal?: boolean
}) {
  const normalizedProvider = normalizeProvider(provider)
  if (!reasoningConfig || reasoningConfig === 'none') {
    return undefined
  }
  if (normalizedProvider === 'openai') {
    return { openai: { reasoningEffort: reasoningConfig } }
  }
  if (normalizedProvider === 'anthropic') {
    return { anthropic: { thinking: { type: reasoningConfig } } }
  }
  return undefined
}
