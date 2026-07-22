import { getFeatureRegistry } from '../../ai'

export const ALPHA_EXPERIENCE_FEATURE_ID = 'ai.alpha_experience' as const

export function isAlphaExperienceEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.alpha_experience')
}
