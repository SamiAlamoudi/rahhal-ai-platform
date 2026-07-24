/**
 * Phase 3 Stage 4 — Travel Intelligence feature registry helpers.
 * Flag `ai.travel_intelligence` default OFF.
 *
 * Not wired into planTurn — isolated layer; consumers call enrich/run explicitly.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type { IntelligenceDimension } from './types'

export const TRAVEL_INTELLIGENCE_FEATURE_ID = 'ai.travel_intelligence' as const

export function isTravelIntelligenceEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(TRAVEL_INTELLIGENCE_FEATURE_ID)
}

export const INTELLIGENCE_DIMENSIONS: readonly IntelligenceDimension[] = [
  'price',
  'duration',
  'convenience',
  'visa_difficulty',
  'weather_suitability',
  'family_friendliness',
  'business_suitability',
  'accessibility',
  'preference_fit',
  'conversation_fit',
] as const

export const DEFAULT_MAX_ALTERNATIVES = 3

export const IntelligenceRegistry = {
  featureId: TRAVEL_INTELLIGENCE_FEATURE_ID,
  isEnabled: isTravelIntelligenceEnabled,
  dimensions: INTELLIGENCE_DIMENSIONS,
  defaultMaxAlternatives: DEFAULT_MAX_ALTERNATIVES,
}
