/**
 * Sprint 93 — serialize unified Trip for transport / UI.
 */

import type { Trip } from './types'

export function serializeTrip(trip: Trip): string {
  return JSON.stringify(trip)
}

export function deserializeTrip(raw: string): Trip {
  const parsed = JSON.parse(raw) as Trip
  if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'string') {
    throw new Error('invalid_trip_payload')
  }
  return parsed
}

/** Compact projection for chat / cards without full component payloads. */
export function serializeTripSummaryCard(trip: Trip): Record<string, unknown> {
  return {
    id: trip.id,
    destination: trip.destination,
    dates: trip.dates,
    travelers: trip.travelers.total,
    total: trip.pricingSummary.total,
    currency: trip.currency,
    confidence: trip.confidence.overall,
    recommendation: trip.recommendation,
    valid: trip.valid,
    alternativeCount: trip.alternatives.length,
    timelineCount: trip.timeline.length,
    executiveSummary: trip.summary.executive,
  }
}
