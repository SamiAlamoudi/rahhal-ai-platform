/**
 * Smart Itinerary engine — generate TripItinerary from BookingRecord (+ Order pointer).
 */

import type { BookingRecord } from '../booking/bookingRecord'
import { findManagedOrderBySessionId } from '../orderManagement'
import { buildDailyPlans } from './dailyPlanner'
import { buildItineraryTimeline } from './timeline'
import { buildTravelInsights } from './travelInsights'
import { tripDurationDays } from './timeHelpers'
import type { GenerateItineraryInput, TripItinerary } from './types'

const cache = new Map<string, TripItinerary>()

function generateId(sessionId: string): string {
  return `itin_${sessionId.slice(0, 8)}_${Date.now().toString(36)}`
}

export function generateTripItinerary(
  record: BookingRecord,
  opts?: Omit<GenerateItineraryInput, 'bookingSessionId'> & {
    includeInsights?: boolean
    includeDailyPlanner?: boolean
  },
): TripItinerary {
  const includeInsights = opts?.includeInsights !== false
  const includeDailyPlanner = opts?.includeDailyPlanner !== false
  const order = findManagedOrderBySessionId(record.sessionId)
  const now = (opts?.now ?? new Date()).toISOString()
  const durationDays = tripDurationDays(
    record.flight?.departureTime,
    record.flight?.arrivalTime,
    3,
  )

  const destination = record.flight?.destination || 'Trip'
  const origin = record.flight?.origin || '—'

  const itinerary: TripItinerary = {
    id: generateId(record.sessionId),
    bookingSessionId: record.sessionId,
    orderId: order?.orderId ?? null,
    summary: {
      titleAr: `رحلة ${origin} → ${destination}`,
      titleEn: `${origin} → ${destination} trip`,
      origin,
      destination,
      departureTime: record.flight?.departureTime ?? null,
      arrivalTime: record.flight?.arrivalTime ?? null,
      durationDays,
      passengerCount: record.passengers.length,
      airline: record.flight?.airline || '—',
      bookingReference: record.bookingReference,
      orderId: order?.orderId ?? null,
      orderNumber: order?.orderNumber ?? null,
    },
    timeline: buildItineraryTimeline(record),
    days: includeDailyPlanner ? buildDailyPlans(record, { dayCount: durationDays }) : [],
    insights: includeInsights ? buildTravelInsights(record) : [],
    createdAt: now,
    updatedAt: now,
    generationMode: 'rule_based',
    version: 1,
  }

  cache.set(record.sessionId, itinerary)
  return itinerary
}

export function getCachedItinerary(bookingSessionId: string): TripItinerary | null {
  return cache.get(bookingSessionId) ?? null
}

export function getOrGenerateItinerary(
  record: BookingRecord,
  opts?: Parameters<typeof generateTripItinerary>[1],
): TripItinerary {
  const existing = cache.get(record.sessionId)
  if (existing) return existing
  return generateTripItinerary(record, opts)
}

/** Force rebuild (e.g. after booking metadata changes). */
export function regenerateTripItinerary(
  record: BookingRecord,
  opts?: Parameters<typeof generateTripItinerary>[1],
): TripItinerary {
  cache.delete(record.sessionId)
  return generateTripItinerary(record, opts)
}

export function clearItineraryCache(): void {
  cache.clear()
}

export function itineraryPath(bookingSessionId: string): string {
  return `/itinerary/${encodeURIComponent(bookingSessionId)}`
}
