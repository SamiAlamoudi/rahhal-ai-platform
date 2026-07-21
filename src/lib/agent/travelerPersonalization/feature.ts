import { getFeatureRegistry } from '../../ai/featureFlags'

export const TRAVELER_PERSONALIZATION_FEATURE_ID = 'ai.traveler_personalization' as const

export function isTravelerPersonalizationEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.traveler_personalization')
}
