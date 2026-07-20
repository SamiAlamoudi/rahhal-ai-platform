import { getFeatureRegistry } from '../../ai/featureFlags'

export const TRAVEL_EXECUTIVE_FEATURE_ID = 'ai.travel_executive' as const

export function isTravelExecutiveEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(TRAVEL_EXECUTIVE_FEATURE_ID)
}
