/**
 * Offer Decision Engine registry + feature gate.
 * Flag `brain.offer_decision_engine` default OFF.
 * Distinct from brain.travel_recommendation / brain.personalization_engine /
 * ai.recommendation_engine.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type {
  TravelOfferDecisionRegistryEntry,
  TravelOfferDecisionSectionId,
} from './types'
import { TRAVEL_OFFER_DECISION_SECTION_IDS } from './types'

export const BRAIN_OFFER_DECISION_ENGINE_FEATURE_ID =
  'brain.offer_decision_engine' as const

export function isBrainOfferDecisionEngineEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(BRAIN_OFFER_DECISION_ENGINE_FEATURE_ID)
}

export const TRAVEL_OFFER_DECISION_REGISTRY: readonly TravelOfferDecisionRegistryEntry[] =
  TRAVEL_OFFER_DECISION_SECTION_IDS.map((sectionId) => ({
    id: `odreg-${sectionId}`,
    sectionId,
    label: sectionId,
    enabledHint: false as const,
  }))

export function listTravelOfferDecisionRegistry(): TravelOfferDecisionRegistryEntry[] {
  return TRAVEL_OFFER_DECISION_REGISTRY.map((entry) => ({ ...entry }))
}

export function listTravelOfferDecisionSectionIds(): readonly TravelOfferDecisionSectionId[] {
  return TRAVEL_OFFER_DECISION_SECTION_IDS
}

export const TravelOfferDecisionRegistry = {
  featureId: BRAIN_OFFER_DECISION_ENGINE_FEATURE_ID,
  isEnabled: isBrainOfferDecisionEngineEnabled,
  list: listTravelOfferDecisionRegistry,
  sectionIds: listTravelOfferDecisionSectionIds,
}
