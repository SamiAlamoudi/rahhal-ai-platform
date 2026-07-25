/**
 * Travel Planning registry + feature gate.
 * Flag `brain.travel_planning` default OFF.
 * Distinct from Phase 6 `brain.planning_engine`.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type {
  TravelPlanningRegistryEntry,
  TravelPlanningSectionId,
} from './types'
import { TRAVEL_PLANNING_SECTION_IDS } from './types'

export const BRAIN_TRAVEL_PLANNING_FEATURE_ID =
  'brain.travel_planning' as const

export function isBrainTravelPlanningEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(BRAIN_TRAVEL_PLANNING_FEATURE_ID)
}

export const TRAVEL_PLANNING_REGISTRY: readonly TravelPlanningRegistryEntry[] =
  TRAVEL_PLANNING_SECTION_IDS.map((sectionId) => ({
    id: `tpreg-${sectionId}`,
    sectionId,
    label: sectionId,
    enabledHint: false as const,
  }))

export function listTravelPlanningRegistry(): TravelPlanningRegistryEntry[] {
  return TRAVEL_PLANNING_REGISTRY.map((entry) => ({ ...entry }))
}

export function listTravelPlanningSectionIds(): readonly TravelPlanningSectionId[] {
  return TRAVEL_PLANNING_SECTION_IDS
}

export const TravelPlanningRegistry = {
  featureId: BRAIN_TRAVEL_PLANNING_FEATURE_ID,
  isEnabled: isBrainTravelPlanningEnabled,
  list: listTravelPlanningRegistry,
  sectionIds: listTravelPlanningSectionIds,
}
