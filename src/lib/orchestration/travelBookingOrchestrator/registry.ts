/**
 * Travel Booking Orchestrator registry + feature gate.
 * Flag `brain.booking_orchestrator` default OFF.
 * Distinct from booking.orchestrator / src/lib/booking / src/core/booking /
 * brain.offer_decision_engine.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type {
  TravelBookingRegistryEntry,
  TravelBookingSectionId,
} from './types'
import { TRAVEL_BOOKING_SECTION_IDS } from './types'

export const BRAIN_BOOKING_ORCHESTRATOR_FEATURE_ID =
  'brain.booking_orchestrator' as const

export function isBrainBookingOrchestratorEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(BRAIN_BOOKING_ORCHESTRATOR_FEATURE_ID)
}

export const TRAVEL_BOOKING_REGISTRY: readonly TravelBookingRegistryEntry[] =
  TRAVEL_BOOKING_SECTION_IDS.map((sectionId) => ({
    id: `tbreg-${sectionId}`,
    sectionId,
    label: sectionId,
    enabledHint: false as const,
  }))

export function listTravelBookingRegistry(): TravelBookingRegistryEntry[] {
  return TRAVEL_BOOKING_REGISTRY.map((entry) => ({ ...entry }))
}

export function listTravelBookingSectionIds(): readonly TravelBookingSectionId[] {
  return TRAVEL_BOOKING_SECTION_IDS
}

export const TravelBookingRegistry = {
  featureId: BRAIN_BOOKING_ORCHESTRATOR_FEATURE_ID,
  isEnabled: isBrainBookingOrchestratorEnabled,
  list: listTravelBookingRegistry,
  sectionIds: listTravelBookingSectionIds,
}
