import { getFeatureRegistry } from '../../ai/featureFlags'

export const RAHHAL_BRAIN_FEATURE_ID = 'ai.rahhal_brain' as const

export function isRahhalBrainEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(RAHHAL_BRAIN_FEATURE_ID)
}
