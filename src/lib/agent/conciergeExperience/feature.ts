import { getFeatureRegistry } from '../../ai'

export const CONCIERGE_EXPERIENCE_FEATURE_ID = 'ai.concierge_experience' as const

export function isConciergeExperienceEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.concierge_experience')
}
