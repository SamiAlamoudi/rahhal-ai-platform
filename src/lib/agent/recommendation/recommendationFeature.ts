/**
 * Evolution Sprint 6 — Recommendation Intelligence feature gate.
 * Default OFF. Additive — not wired into planTurn.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'

export const RECOMMENDATION_INTELLIGENCE_FEATURE_ID = 'ai.recommendation_intelligence' as const

export function isRecommendationIntelligenceEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(RECOMMENDATION_INTELLIGENCE_FEATURE_ID)
}
