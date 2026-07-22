/**
 * Sprint 99 — derive final recommendation text (deduped).
 */

import type { AlphaExperienceComposeInput } from './AlphaExperienceDTO'
import { dedupeStrings } from './ExperienceSections'

export function buildFinalRecommendationText(
  input: AlphaExperienceComposeInput,
): string | null {
  const candidates = [
    input.concierge?.summaryText,
    input.concierge?.explanation,
    input.decisionExplanation,
    input.packageSelected?.explanation,
    input.priceOpportunity?.note,
  ]
    .map((v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''))
    .filter(Boolean)

  const unique = dedupeStrings(candidates)
  if (unique.length === 0) return null
  // Prefer the richest traveler-facing summary (usually concierge summary).
  return unique[0] ?? null
}

export function buildTravelerRecommendationHeadline(
  input: AlphaExperienceComposeInput,
): string | null {
  const option = input.concierge?.recommendedOption?.trim()
  const destination = input.destination?.trim()
  if (option && destination) return `${option} for ${destination}`
  if (option) return option
  if (input.packageSelected?.title?.trim()) {
    return input.packageSelected.title.trim()
  }
  if (destination) return `Recommendation for ${destination}`
  return buildFinalRecommendationText(input)
}
