import { getFeatureRegistry } from '../../ai/featureFlags'

export const TRIP_MANAGEMENT_FEATURE_ID = 'ai.trip_management' as const

export function isTripManagementEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.trip_management')
}
