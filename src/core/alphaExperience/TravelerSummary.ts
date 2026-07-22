/**
 * Sprint 99 — traveler summary helpers (deduped key reasons).
 */

import type { AlphaExperienceComposeInput } from './AlphaExperienceDTO'
import { dedupeStrings } from './ExperienceSections'
import { buildFinalRecommendationText } from './TravelerRecommendation'

export function buildTravelerSummaryText(
  input: AlphaExperienceComposeInput,
): string | null {
  return buildFinalRecommendationText(input)
}

export function buildTravelerKeyReasons(
  input: AlphaExperienceComposeInput,
): string[] {
  return dedupeStrings([
    input.concierge?.whyDestination,
    input.concierge?.whyFlights,
    input.concierge?.whyHotel,
    input.concierge?.whyPackage,
    input.packageSelected?.explanation,
  ].filter((x): x is string => typeof x === 'string' && x.trim().length > 0))
}
