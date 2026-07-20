import { getFeatureRegistry } from '../../ai/featureFlags'

export function isSmartClarificationEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.smart_clarification')
}
