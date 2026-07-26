/**
 * Conversation stage + completion / confidence for TripState.
 */

import type { TripConversationStage, TripMissingField, TripState } from './types'

export function resolveConversationStage(input: {
  missingFields: TripMissingField[]
  hasTripPlan: boolean
  bookingReady?: boolean
}): TripConversationStage {
  const missing = input.missingFields

  // Booking / itinerary stages only when TripState planning slots are complete.
  if (input.bookingReady && missing.length === 0) return 'BOOKING_READY'
  if (input.hasTripPlan && missing.length === 0) return 'ITINERARY'
  if (missing.length === 0) return 'RECOMMENDATIONS'

  // Nothing known about where to go yet.
  if (missing.includes('destinationCountry')) return 'DISCOVERY'

  // Country/city/dates/budget still open.
  if (
    missing.includes('destinationCity')
    || missing.includes('duration')
    || missing.includes('travelDates')
    || missing.includes('budget')
  ) {
    return 'CLARIFICATION'
  }

  // Core facts known — style / party before recommendation cards.
  if (missing.includes('travelStyle') || missing.includes('travelers')) {
    return 'PLANNING'
  }

  return 'CLARIFICATION'
}

/** Planning is complete when we reached recommendations or later. */
export function cardsAllowedForStage(stage: TripConversationStage): boolean {
  return stage === 'RECOMMENDATIONS'
    || stage === 'ITINERARY'
    || stage === 'BOOKING_READY'
}

export function computeCompletionPercentage(state: Pick<
  TripState,
  | 'destinationCountry'
  | 'destinationCity'
  | 'duration'
  | 'travelDates'
  | 'budget'
  | 'travelStyle'
  | 'travelers'
  | 'relationship'
  | 'hotelPreference'
  | 'flightPreference'
>): number {
  const checks = [
    Boolean(state.destinationCountry || state.destinationCity),
    Boolean(state.destinationCity || (state.destinationCountry && !needsCity(state.destinationCountry))),
    state.duration != null || Boolean(state.travelDates.start),
    state.budget != null,
    Boolean(state.travelStyle),
    state.travelers != null || state.relationship != null,
    Boolean(state.hotelPreference),
    Boolean(state.flightPreference),
  ]
  const filled = checks.filter(Boolean).length
  return Math.round((filled / checks.length) * 100)
}

function needsCity(country: string | null): boolean {
  if (!country) return false
  const key = country.toLowerCase()
  return key === 'morocco' || key === 'japan' || key === 'italy' || key === 'spain'
}

export function computeConfidenceScore(state: Pick<
  TripState,
  'completionPercentage' | 'missingFields' | 'conversationStage'
>): number {
  const base = state.completionPercentage / 100
  const missingPenalty = Math.min(0.45, state.missingFields.length * 0.08)
  const stageBonus =
    state.conversationStage === 'ITINERARY' || state.conversationStage === 'BOOKING_READY'
      ? 0.15
      : state.conversationStage === 'RECOMMENDATIONS'
        ? 0.08
        : 0
  return Math.max(0, Math.min(1, Number((base - missingPenalty + stageBonus).toFixed(2))))
}
