/**
 * Sprint 52 — Prediction helpers.
 */

import type { PersonalizationProfile } from '../../../ai/preferences/types'
import type { AgentMemory } from '../../../agent/types'
import type { TravelReasoningResult } from '../../../agent/reasoning/types'
import type { ScoredOption, PredictionResult, TravelGoal } from './types'

export function buildPrediction(input: {
  profile: PersonalizationProfile
  memory: AgentMemory
  reasoningResult: TravelReasoningResult | null
  strongest: ScoredOption[]
  goal: TravelGoal
  now: Date
}): PredictionResult {
  const { profile, memory, reasoningResult, strongest, goal, now } = input
  const preferred = strongest[0]?.name
    ?? reasoningResult?.primary?.name
    ?? profile.travelStyle.favoriteDestinations[0]
    ?? null

  const likelyBudget = memory.requirements.budgetAmount
    ?? profile.budget.typicalTripBudget
    ?? (profile.budget.style === 'luxury' ? 25000
      : profile.budget.style === 'budget' ? 6000
        : 12000)

  const monthFromDates = memory.requirements.startDate
    ? new Date(memory.requirements.startDate).getMonth() + 1
    : null
  const likelyTravelMonth = monthFromDates
    ?? (goal === 'family' ? 7 : goal === 'honeymoon' ? 9 : now.getMonth() + 2 > 12
      ? (now.getMonth() + 2) % 12 || 12
      : now.getMonth() + 2)

  const likelyAirline = profile.airline.preferredAirlines[0]
    ?? (profile.airline.cabin === 'business' || profile.airline.cabin === 'first'
      ? 'Saudia Business'
      : 'Saudia')

  const likelyHotelStyle = profile.hotel.categories[0]
    ?? (profile.budget.style === 'luxury' ? 'resort' : 'hotel')

  const acceptProbability = clamp01(
    0.45
    + (strongest[0]?.confidence ?? 0.3) * 0.35
    + (preferred && profile.travelStyle.favoriteDestinations.some(
      (d) => d.toLowerCase() === preferred.toLowerCase(),
    ) ? 0.15 : 0)
    - (profile.budget.flexibility === 'strict' ? 0.05 : 0),
  )

  const cancelProbability = clamp01(
    0.12
    + (profile.budget.flexibility === 'strict' ? 0.08 : 0)
    + ((strongest[0]?.objectives.safety ?? 0.7) < 0.55 ? 0.1 : 0)
    + (memory.requirements.destinationFlexible ? 0.05 : 0),
  )

  const changeDestinationProbability = clamp01(
    0.18
    + (memory.requirements.destinationFlexible ? 0.2 : 0)
    + (strongest.length > 1 && Math.abs((strongest[0]?.score ?? 0) - (strongest[1]?.score ?? 0)) < 0.05
      ? 0.15
      : 0)
    - (profile.travelStyle.favoriteDestinations.length > 0 ? 0.05 : 0),
  )

  const confidence = clamp01(
    0.5
    + (strongest[0] ? 0.2 : 0)
    + (memory.requirements.budgetAmount ? 0.1 : 0)
    + (preferred ? 0.1 : 0),
  )

  return {
    preferredDestination: preferred,
    likelyBudget,
    likelyTravelMonth,
    likelyAirline,
    likelyHotelStyle,
    acceptProbability,
    cancelProbability,
    changeDestinationProbability,
    confidence,
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
