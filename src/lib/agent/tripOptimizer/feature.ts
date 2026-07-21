import { getFeatureRegistry } from '../../ai/featureFlags'

export const TRIP_OPTIMIZER_FEATURE_ID = 'ai.trip_optimizer' as const

export function isTripOptimizerEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.trip_optimizer')
}
