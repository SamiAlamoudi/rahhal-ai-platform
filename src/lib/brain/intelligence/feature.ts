import { getFeatureRegistry } from '../../ai/featureFlags'

export const REAL_WORLD_INTELLIGENCE_FEATURE_ID = 'ai.real_world_intelligence' as const

export function isRealWorldIntelligenceEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(REAL_WORLD_INTELLIGENCE_FEATURE_ID)
}
