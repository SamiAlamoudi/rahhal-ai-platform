import { getFeatureRegistry } from '../../ai/featureFlags'

export function isTravelReasoningEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.travel_reasoning')
}
