/**
 * Travel Recommendation registry + feature gate.
 * Flag `brain.travel_recommendation` default OFF.
 * Distinct from ai.recommendation_engine / ai.recommendation_intelligence /
 * brain.personalization_engine.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type {
  TravelRecommendationRegistryEntry,
  TravelRecommendationSectionId,
} from './types'
import { TRAVEL_RECOMMENDATION_SECTION_IDS } from './types'

export const BRAIN_TRAVEL_RECOMMENDATION_FEATURE_ID =
  'brain.travel_recommendation' as const

export function isBrainTravelRecommendationEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(BRAIN_TRAVEL_RECOMMENDATION_FEATURE_ID)
}

export const TRAVEL_RECOMMENDATION_REGISTRY: readonly TravelRecommendationRegistryEntry[] =
  TRAVEL_RECOMMENDATION_SECTION_IDS.map((sectionId) => ({
    id: `trreg-${sectionId}`,
    sectionId,
    label: sectionId,
    enabledHint: false as const,
  }))

export function listTravelRecommendationRegistry(): TravelRecommendationRegistryEntry[] {
  return TRAVEL_RECOMMENDATION_REGISTRY.map((entry) => ({ ...entry }))
}

export function listTravelRecommendationSectionIds(): readonly TravelRecommendationSectionId[] {
  return TRAVEL_RECOMMENDATION_SECTION_IDS
}

export const TravelRecommendationRegistry = {
  featureId: BRAIN_TRAVEL_RECOMMENDATION_FEATURE_ID,
  isEnabled: isBrainTravelRecommendationEnabled,
  list: listTravelRecommendationRegistry,
  sectionIds: listTravelRecommendationSectionIds,
}
