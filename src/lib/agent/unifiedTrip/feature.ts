import { getFeatureRegistry } from '../../ai'

export const UNIFIED_TRIP_FEATURE_ID = 'ai.unified_trip' as const

export function isUnifiedTripEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.unified_trip')
}
