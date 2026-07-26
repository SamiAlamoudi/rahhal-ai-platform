/**
 * Build / merge TripState from agent memory + latest user text.
 * Never clears previously known fields unless a stronger patch replaces them.
 */

import type { AgentMemory, TripRequirements } from '../agent/types'
import { resolveGeography } from './geography'
import { computeMissingFields, primaryMissingField } from './missing'
import {
  cardsAllowedForStage,
  computeCompletionPercentage,
  computeConfidenceScore,
  resolveConversationStage,
} from './stages'
import { inferActivities, inferFoodPreferences, inferTravelStyle } from './styleSignals'
import { emptyTripState, type TripState } from './types'

export interface UpdateTripStateInput {
  previous: TripState | null
  requirements: TripRequirements
  userText: string
  hasTripPlan: boolean
  bookingReady?: boolean
  now?: string
}

export function updateTripState(input: UpdateTripStateInput): TripState {
  const prev = input.previous ?? emptyTripState()
  const req = input.requirements
  const geo = resolveGeography(req.destination || req.destinations[0] || null)

  // Prefer city from latest extraction; keep prior city when destination is still the country.
  let destinationCountry = geo.country ?? prev.destinationCountry
  let destinationCity = geo.city ?? prev.destinationCity

  // If traveler named a country again without a city, do not wipe a prior city.
  if (geo.country && !geo.city && prev.destinationCity) {
    destinationCountry = geo.country
    destinationCity = prev.destinationCity
  }
  // City answer upgrades country when known from geography map.
  if (geo.city && geo.country) {
    destinationCountry = geo.country
    destinationCity = geo.city
  }

  const travelStyle = inferTravelStyle(
    input.userText,
    req.interests,
    req.weatherPreference,
    req.budgetStyle,
  ) ?? prev.travelStyle

  const activities = uniqueStrings([
    ...prev.activities,
    ...inferActivities(input.userText, req.interests),
  ])
  const foodPreferences = uniqueStrings([
    ...prev.foodPreferences,
    ...inferFoodPreferences(input.userText, req.interests),
  ])

  const flightPreference = joinFlightPreference(req) ?? prev.flightPreference
  const hotelPreference = req.hotelPreference ?? prev.hotelPreference
  const specialNeeds = req.notes ?? prev.specialNeeds

  const draft: TripState = {
    ...prev,
    destinationCountry,
    destinationCity,
    travelDates: {
      start: req.startDate ?? prev.travelDates.start,
      end: req.endDate ?? prev.travelDates.end,
    },
    duration: req.durationDays ?? prev.duration,
    travelers: req.travelers ?? prev.travelers,
    relationship: req.travelerType ?? prev.relationship,
    budget: req.budgetAmount ?? prev.budget,
    currency: req.budgetCurrency ?? prev.currency ?? (req.budgetAmount != null ? 'SAR' : null),
    travelStyle,
    hotelPreference,
    flightPreference,
    activities,
    foodPreferences,
    visaRequired: prev.visaRequired,
    specialNeeds,
    conversationStage: prev.conversationStage,
    completionPercentage: prev.completionPercentage,
    missingFields: prev.missingFields,
    confidenceScore: prev.confidenceScore,
    primaryMissing: prev.primaryMissing,
    cardsAllowed: prev.cardsAllowed,
    updatedAt: input.now ?? new Date().toISOString(),
  }

  const missingFields = computeMissingFields(draft)
  const conversationStage = resolveConversationStage({
    missingFields,
    hasTripPlan: input.hasTripPlan,
    bookingReady: input.bookingReady,
  })
  const completionPercentage = computeCompletionPercentage(draft)
  const primaryMissing = primaryMissingField(missingFields)
  const cardsAllowed = cardsAllowedForStage(conversationStage)
  const confidenceScore = computeConfidenceScore({
    completionPercentage,
    missingFields,
    conversationStage,
  })

  return {
    ...draft,
    missingFields,
    conversationStage,
    completionPercentage,
    primaryMissing,
    cardsAllowed,
    confidenceScore,
  }
}

export function tripStateFromMemory(
  memory: AgentMemory,
  previous: TripState | null,
  userText = '',
): TripState {
  return updateTripState({
    previous,
    requirements: memory.requirements,
    userText,
    hasTripPlan: Boolean(memory.tripPlan),
  })
}

function joinFlightPreference(req: TripRequirements): string | null {
  const bits = [
    req.cabinPreference,
    req.preferredAirline,
    req.preferredDepartureTime,
  ].filter(Boolean)
  return bits.length ? bits.join(' · ') : null
}

function uniqueStrings(values: string[]): string[] {
  const out: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    if (!out.some((row) => row.toLowerCase() === trimmed.toLowerCase())) out.push(trimmed)
  }
  return out
}
