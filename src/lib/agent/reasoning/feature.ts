import { getFeatureRegistry } from '../../ai/featureFlags'

export function isTravelReasoningEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.travel_reasoning')
}

/** Light gate — preference bridge body stays in preferenceBridge.ts. */
export function isPreferenceMemoryEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  const registry = getFeatureRegistry()
  if (!registry.isEnabled('ai.personalization')) return false
  return registry.isEnabled('ai.travel_reasoning')
    || registry.isEnabled('ai.persistent_memory')
    || registry.isEnabled('ai.smart_clarification')
}
