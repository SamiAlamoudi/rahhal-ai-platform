/**
 * Sprint 106 — TravelInsights + booking / fare / layover warnings.
 * Optional insights only when supported by provider / trip facts.
 */

import type {
  ResponseComposerFlightFacts,
  ResponseComposerTripContext,
  ResponseInsight,
  ResponseWarning,
} from './types'

function layoverExplanation(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h <= 0) return `${m}-minute layover`
  if (m === 0) return `${h}-hour layover`
  return `${h}h ${m}m layover`
}

export function buildTravelInsights(input: {
  flights: ResponseComposerFlightFacts[]
  trip?: ResponseComposerTripContext | null
  best?: ResponseComposerFlightFacts | null
}): ResponseInsight[] {
  const insights: ResponseInsight[] = []
  const trip = input.trip
  const best = input.best
  const pool = input.flights

  if (trip?.visaNote?.trim()) {
    insights.push({
      kind: 'visa_reminder',
      title: 'Visa reminder',
      message: trip.visaNote.trim(),
      priority: 'high',
    })
  }

  if (trip?.timeDifferenceHours != null && Number.isFinite(trip.timeDifferenceHours)) {
    const hours = trip.timeDifferenceHours
    const abs = Math.abs(hours)
    insights.push({
      kind: 'time_difference',
      title: 'Time difference',
      message:
        hours === 0
          ? 'No time difference between origin and destination.'
          : `Destination is about ${abs} hour${abs === 1 ? '' : 's'} ${hours > 0 ? 'ahead of' : 'behind'} origin.`,
      priority: 'medium',
    })
  }

  if (best?.arrivalAt) {
    insights.push({
      kind: 'arrival_time',
      title: 'Arrival time',
      message: `Scheduled arrival ${best.arrivalAt}.`,
      priority: 'medium',
    })
  } else if (best?.arrivalHour != null) {
    insights.push({
      kind: 'arrival_time',
      title: 'Arrival time',
      message: `Arrives around ${String(best.arrivalHour).padStart(2, '0')}:00 local hour (from provider schedule).`,
      priority: 'medium',
    })
  }

  const nightHour = best?.arrivalHour
  if (nightHour != null && (nightHour >= 22 || nightHour < 6)) {
    insights.push({
      kind: 'night_arrival',
      title: 'Night arrival',
      message: 'This itinerary arrives late at night or early morning based on provider schedule.',
      priority: 'high',
    })
  }

  const shortConnection = pool.find(
    (f) => f.layoverMinutes != null && f.layoverMinutes > 0 && f.layoverMinutes < 60,
  )
  if (shortConnection?.layoverMinutes != null) {
    insights.push({
      kind: 'short_connection',
      title: 'Short connection warning',
      message: `A ${layoverExplanation(shortConnection.layoverMinutes)} may be tight for connecting passengers.`,
      priority: 'high',
    })
  }

  const longLayover = pool.find(
    (f) => f.layoverMinutes != null && f.layoverMinutes >= 180,
  )
  if (longLayover?.layoverMinutes != null) {
    insights.push({
      kind: 'long_layover',
      title: 'Long layover',
      message: `Provider data shows a ${layoverExplanation(longLayover.layoverMinutes)}.`,
      priority: 'medium',
    })
  }

  if (best && (best.stops ?? 0) >= 1) {
    insights.push({
      kind: 'airport_transfer',
      title: 'Airport transfer note',
      message:
        best.layoverMinutes != null
          ? `Itinerary includes ${best.stops} stop(s) with a ${layoverExplanation(best.layoverMinutes)} — plan airport transfer time between flights.`
          : `Itinerary includes ${best.stops} stop(s) — plan airport transfer time between flights.`,
      priority: 'medium',
    })
  }

  if (trip?.departureDate) {
    const month = Number(trip.departureDate.slice(5, 7))
    if (Number.isFinite(month) && (month === 7 || month === 8 || month === 12)) {
      insights.push({
        kind: 'peak_travel',
        title: 'Peak travel reminder',
        message: `Departure ${trip.departureDate} falls in a commonly busy travel month — book flexible fares when available.`,
        priority: 'low',
      })
    }
  }

  // Weather is explicitly a placeholder — no invented forecast
  if (trip?.destination) {
    insights.push({
      kind: 'weather_reminder',
      title: 'Weather reminder',
      message: `Check local weather for ${trip.destination} before departure (forecast not provided by the flight provider).`,
      priority: 'low',
    })
  }

  if (best?.airline && best.origin && best.destination) {
    insights.push({
      kind: 'travel_tip',
      title: 'Travel tip',
      message: `Arrive early for your ${best.airline} flight from ${best.origin} to ${best.destination}.`,
      priority: 'low',
    })
  }

  return insights
}

export function buildResponseWarnings(input: {
  flights: ResponseComposerFlightFacts[]
  validFlights: ResponseComposerFlightFacts[]
  best?: ResponseComposerFlightFacts | null
  invalidCount?: number
}): ResponseWarning[] {
  const warnings: ResponseWarning[] = []
  const { flights, validFlights, best } = input

  if (flights.length === 0 || validFlights.length === 0) {
    warnings.push({
      kind: 'empty_results',
      code: 'EMPTY_OFFERS',
      message: 'No flight offers were available to compose a recommendation.',
      severity: 'warning',
    })
  }

  if ((input.invalidCount ?? 0) > 0) {
    warnings.push({
      kind: 'incomplete_data',
      code: 'INVALID_OFFERS_DROPPED',
      message: `${input.invalidCount} offer(s) lacked usable provider fields and were skipped.`,
      severity: 'info',
    })
  }

  if (best?.refundable === false) {
    warnings.push({
      kind: 'fare',
      code: 'NON_REFUNDABLE',
      message: 'Selected fare is non-refundable according to provider data.',
      severity: 'warning',
    })
  }

  if (best?.seatsRemaining != null && best.seatsRemaining > 0 && best.seatsRemaining <= 3) {
    warnings.push({
      kind: 'booking',
      code: 'LIMITED_SEATS',
      message: `Only ${best.seatsRemaining} seat(s) remaining on the selected offer.`,
      severity: 'warning',
    })
  }

  if (best?.baggageIncluded === false) {
    warnings.push({
      kind: 'fare',
      code: 'BAGGAGE_NOT_INCLUDED',
      message: 'Checked baggage is not included in the selected fare.',
      severity: 'info',
    })
  }

  if (best?.layoverMinutes != null && best.layoverMinutes > 0 && best.layoverMinutes < 60) {
    warnings.push({
      kind: 'short_connection',
      code: 'SHORT_CONNECTION',
      message: `Short connection: ${best.layoverMinutes} minutes layover.`,
      severity: 'critical',
    })
  }

  if (best?.layoverMinutes != null && best.layoverMinutes >= 180) {
    warnings.push({
      kind: 'layover',
      code: 'LONG_LAYOVER',
      message: `Long layover: ${best.layoverMinutes} minutes between flights.`,
      severity: 'info',
    })
  }

  const nightHour = best?.arrivalHour
  if (nightHour != null && (nightHour >= 22 || nightHour < 6)) {
    warnings.push({
      kind: 'night_arrival',
      code: 'NIGHT_ARRIVAL',
      message: 'Arrival is late night or early morning based on provider schedule.',
      severity: 'warning',
    })
  }

  return warnings
}

export class TravelInsights {
  build(input: {
    flights: ResponseComposerFlightFacts[]
    trip?: ResponseComposerTripContext | null
    best?: ResponseComposerFlightFacts | null
  }): ResponseInsight[] {
    return buildTravelInsights(input)
  }

  warnings(input: {
    flights: ResponseComposerFlightFacts[]
    validFlights: ResponseComposerFlightFacts[]
    best?: ResponseComposerFlightFacts | null
    invalidCount?: number
  }): ResponseWarning[] {
    return buildResponseWarnings(input)
  }
}

export function createTravelInsights(): TravelInsights {
  return new TravelInsights()
}
