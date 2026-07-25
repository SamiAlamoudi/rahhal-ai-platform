/**
 * LLM Registry + feature gate.
 * Flag `brain.llm_adapter` default OFF.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type { LlmProviderId, LlmRegistryEntry } from './types'
import { LLM_FUTURE_PROVIDERS } from './types'

export const BRAIN_LLM_ADAPTER_FEATURE_ID = 'brain.llm_adapter' as const

export function isBrainLlmAdapterEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(BRAIN_LLM_ADAPTER_FEATURE_ID)
}

export const LLM_REGISTRY: readonly LlmRegistryEntry[] =
  LLM_FUTURE_PROVIDERS.map((providerId, index) => ({
    id: `lreg-${providerId}`,
    providerId,
    enabledHint: false as const,
    rankHint: index + 1,
  }))

export function listLlmRegistry(): LlmRegistryEntry[] {
  return LLM_REGISTRY.map((entry) => ({ ...entry }))
}

export function listLlmFutureProviders(): readonly LlmProviderId[] {
  return LLM_FUTURE_PROVIDERS
}

export const LlmRegistry = {
  featureId: BRAIN_LLM_ADAPTER_FEATURE_ID,
  isEnabled: isBrainLlmAdapterEnabled,
  list: listLlmRegistry,
  futureProviders: listLlmFutureProviders,
}
