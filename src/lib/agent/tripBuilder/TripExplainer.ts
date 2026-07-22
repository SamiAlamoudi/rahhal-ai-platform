/**
 * Sprint 110 — TripExplainer
 * Facts-only explanations for trip candidates (never invents prices/dates).
 */

import type { TripCandidate, TripCostBreakdown } from './types'
import type { RahhalFlightSearchOffer } from '../liveFlightSearch/types'
import type { HotelOffer } from '../liveHotelSearch/types'

export interface TripExplainInput {
  flight: RahhalFlightSearchOffer
  hotel: HotelOffer
  cost: TripCostBreakdown
  nights: number
  travelQuality: number
  confidence: number
  destination: string
  compatible: boolean
  validationErrors: string[]
}

export function explainTrip(input: TripExplainInput): {
  explanation: string
  reasons: string[]
} {
  const reasons: string[] = []
  const { flight, hotel, cost, nights, destination } = input

  if (flight.airline) {
    reasons.push(
      `${flight.airline} ${flight.origin}→${flight.destination}`
        + (flight.stops == null
          ? ''
          : flight.stops === 0
            ? ' (nonstop)'
            : ` (${flight.stops} stop${flight.stops === 1 ? '' : 's'})`),
    )
  } else {
    reasons.push(`Flight ${flight.origin}→${flight.destination}`)
  }

  reasons.push(
    `${hotel.hotelName}`
      + (hotel.stars != null ? ` (${hotel.stars}★)` : '')
      + ` · ${nights} night${nights === 1 ? '' : 's'}`,
  )

  reasons.push(
    `Total ${cost.totalCost.toFixed(0)} ${cost.currency}`
      + ` (flight ${cost.flightCost.toFixed(0)} + hotel ${cost.hotelCost.toFixed(0)}`
      + (cost.taxes > 0 ? ` + taxes ${cost.taxes.toFixed(0)}` : '')
      + ')',
  )

  if (cost.underBudget === true && cost.estimatedSavings != null) {
    reasons.push(
      `Under budget by ${cost.estimatedSavings.toFixed(0)} ${cost.currency}`,
    )
  } else if (cost.underBudget === false) {
    reasons.push(`Over budget (${cost.totalCost.toFixed(0)} ${cost.currency})`)
  } else if (cost.estimatedSavings != null && cost.estimatedSavings > 0) {
    reasons.push(
      `Estimated savings vs peers: ${cost.estimatedSavings.toFixed(0)} ${cost.currency}`,
    )
  }

  if (hotel.freeCancellation) {
    reasons.push('Free cancellation hotel')
  }

  if (flight.refundable) {
    reasons.push('Refundable flight fare')
  }

  reasons.push(
    `Travel quality ${Math.round(input.travelQuality)}/100 · confidence ${Math.round(input.confidence * 100)}%`,
  )

  if (!input.compatible && input.validationErrors.length > 0) {
    reasons.push(`Compatibility: ${input.validationErrors[0]}`)
  }

  const explanation =
    `Trip to ${destination}: ${flight.title || flight.id} with ${hotel.hotelName}`
    + ` for ${nights} night${nights === 1 ? '' : 's'} at ${cost.totalCost.toFixed(0)} ${cost.currency}.`
    + (cost.underBudget === true
      ? ' Fits within the stated budget.'
      : cost.underBudget === false
        ? ' Exceeds the stated budget.'
        : '')

  return { explanation, reasons }
}

export function explainTripCandidate(trip: TripCandidate): {
  explanation: string
  reasons: string[]
} {
  return explainTrip({
    flight: trip.flight,
    hotel: trip.hotel,
    cost: trip.cost,
    nights: trip.nights,
    travelQuality: trip.travelQuality,
    confidence: trip.confidence,
    destination: trip.destination,
    compatible: trip.compatible,
    validationErrors: trip.validationErrors,
  })
}

export class TripExplainer {
  explain(input: TripExplainInput) {
    return explainTrip(input)
  }
}

export function createTripExplainer(): TripExplainer {
  return new TripExplainer()
}
