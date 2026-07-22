/**
 * Sprint 93 — natural-language trip summaries.
 */

import type {
  Trip,
  TripPricingSummary,
  TripSummary,
} from './types'

export function buildTripSummary(input: {
  destination: string | null
  origin: string | null
  travelersTotal: number
  startDate: string | null
  endDate: string | null
  pricing: TripPricingSummary
  recommendation: string
  flightAirline?: string | null
  hotelName?: string | null
  priceTimingNote?: string | null
}): TripSummary {
  const dest = input.destination ?? 'your destination'
  const origin = input.origin ?? 'your city'
  const dates = input.startDate && input.endDate
    ? `${input.startDate} → ${input.endDate}`
    : input.startDate ?? 'flexible dates'
  const people = input.travelersTotal === 1
    ? '1 traveler'
    : `${input.travelersTotal} travelers`

  const executive = [
    `Complete trip plan to ${dest} from ${origin} (${dates}).`,
    input.flightAirline ? `Primary flight with ${input.flightAirline}.` : null,
    input.hotelName ? `Stay at ${input.hotelName}.` : null,
    `Estimated total ${input.pricing.total} ${input.pricing.currency}.`,
  ].filter(Boolean).join(' ')

  const traveler = `Plan covers ${people} with flights, lodging, and supporting services assembled into one itinerary.`

  let budget = `Estimated trip cost is ${input.pricing.total} ${input.pricing.currency}`
  if (input.pricing.budgetCap != null && input.pricing.budgetDelta != null) {
    if (input.pricing.budgetDelta > 0) {
      budget += ` (${input.pricing.budgetDelta} above your ${input.pricing.budgetCap} budget).`
    } else {
      budget += ` (${Math.abs(input.pricing.budgetDelta)} under your ${input.pricing.budgetCap} budget).`
    }
  } else {
    budget += '.'
  }
  if (input.priceTimingNote) {
    budget += ` Timing note: ${input.priceTimingNote}`
  }

  return {
    executive,
    traveler,
    budget,
    recommendation: input.recommendation,
  }
}

export function recommendationFromSources(input: {
  packageExplanation?: string | null
  decisionExplanation?: string | null
  destination?: string | null
}): string {
  const pkg = input.packageExplanation?.split('\n')[0]?.trim()
  const decision = input.decisionExplanation?.split('\n')[0]?.trim()
  if (pkg && decision) return `${pkg} ${decision}`
  if (pkg) return pkg
  if (decision) return decision
  return `Recommended balanced trip${input.destination ? ` for ${input.destination}` : ''}.`
}

/** Keep Trip type import used for future summary helpers. */
export type TripSummarySource = Pick<Trip, 'destination' | 'summary'>
