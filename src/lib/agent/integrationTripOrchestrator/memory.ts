/**
 * Integration Sprint 4 — seed / learn traveler prefs for orchestration.
 * Reuses preferenceBridge; never overwrites explicit user statements.
 */

import {
  learnPreferencesFromRequirements,
  seedRequirementsFromPreferences,
} from '../reasoning/preferenceBridge'
import type { TripRequirements } from '../types'

export function seedOrchestratorRequirements(
  requirements: TripRequirements,
  userId?: string | null,
): TripRequirements {
  return seedRequirementsFromPreferences(requirements, { userId })
}

export function learnOrchestratorPreferences(
  requirements: TripRequirements,
  userId?: string | null,
): void {
  learnPreferencesFromRequirements(requirements, { userId })
}

/** Soft scenario label for tests / diagnostics. */
export function detectTripScenario(requirements: TripRequirements): string {
  if (requirements.tripPurpose === 'business' || requirements.travelerType === 'business') {
    return 'business'
  }
  if (requirements.tripPurpose === 'family' || requirements.travelerType === 'family') {
    return 'family'
  }
  if (requirements.budgetStyle === 'luxury' || requirements.tripPurpose === 'honeymoon') {
    return 'luxury'
  }
  if (requirements.budgetStyle === 'budget') return 'budget'
  if ((requirements.durationDays ?? 0) <= 3 || requirements.datesFlexible) return 'weekend'
  if (requirements.destinations.length > 1) return 'multi_city'
  return 'leisure'
}
