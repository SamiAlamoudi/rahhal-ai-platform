/**
 * Sprint 33 — BookingContext builder from selected UnifiedTravelPlanOption.
 */

import type { UnifiedTravelPlanOption } from '../brain/unifiedTravel/types'
import type {
  BookingContext,
  CreateExecutionSessionInput,
  PricingSnapshot,
  TravelerInfo,
} from './ExecutionTypes'
import { ExecutionError } from './ExecutionErrors'

export function buildBookingContext(input: CreateExecutionSessionInput): BookingContext {
  const itinerary = input.selectedItinerary
  if (!itinerary?.id) {
    throw new ExecutionError('INVALID_ITINERARY', 'Selected itinerary is required')
  }
  if (!itinerary.flight && !itinerary.hotel) {
    throw new ExecutionError(
      'INVALID_ITINERARY',
      'Selected itinerary must include a flight and/or hotel',
    )
  }

  const now = new Date().toISOString()
  const sessionId = `exe_${Math.random().toString(36).slice(2, 10)}`
  const tripId = input.tripId ?? `trip_${itinerary.id}`
  const travelers = normalizeTravelers(input.travelers)
  const pricing = pricingFromItinerary(itinerary)

  return {
    sessionId,
    tripId,
    conversationId: input.conversationId,
    userId: input.userId ?? 'anonymous',
    selectedItinerary: itinerary,
    travelers,
    pricing,
    currency: pricing.currency,
    locale: input.locale === 'ar' ? 'ar' : 'en',
    createdAt: now,
    updatedAt: now,
  }
}

export function pricingFromItinerary(option: UnifiedTravelPlanOption): PricingSnapshot {
  const currency = option.cost.currency || option.flight?.currency || option.hotel?.currency || 'SAR'
  return {
    currency,
    flights: option.cost.flights,
    hotels: option.cost.hotels,
    taxesAndFees: option.cost.taxesAndFees + option.cost.activities + option.cost.transport,
    total: option.cost.total,
  }
}

function normalizeTravelers(partial?: Partial<TravelerInfo>): TravelerInfo {
  const adults = Math.max(1, partial?.adults ?? 2)
  const children = Math.max(0, partial?.children ?? 0)
  const infants = Math.max(0, partial?.infants ?? 0)
  return {
    adults,
    children,
    infants,
    summary:
      partial?.summary
      ?? `${adults} adult(s)${children ? `, ${children} child(ren)` : ''}${infants ? `, ${infants} infant(s)` : ''}`,
  }
}

export type { BookingContext }
