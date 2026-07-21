import { getFeatureRegistry } from '../../ai/featureFlags'

export const TRAVEL_PLANNER_FEATURE_ID = 'ai.travel_planner' as const

export function isTravelPlannerEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.travel_planner')
}
