/**
 * Sprint 102 — booking review model (itinerary, pricing, policy, travelers).
 * Omits empty sections — no placeholders.
 */

import type {
  BookingCancellationPolicy,
  BookingExecutionComposeInput,
  BookingItinerarySummary,
  BookingPriceBreakdown,
  BookingTravelerDraft,
} from './types'

export interface BookingReviewModel {
  itinerary: BookingItinerarySummary | null
  pricing: BookingPriceBreakdown | null
  cancellationPolicy: BookingCancellationPolicy | null
  travelers: BookingTravelerDraft[]
  offerRefs: {
    flightId: string | null
    hotelId: string | null
    packageId: string | null
  }
}

function norm(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t.length > 0 ? t : null
}

export function buildBookingReviewModel(
  input: BookingExecutionComposeInput,
): BookingReviewModel {
  const currency = (input.currency || 'SAR').toUpperCase()
  const itinerary: BookingItinerarySummary = {
    destination: norm(input.destination),
    origin: norm(input.origin),
    startDate: norm(input.startDate),
    endDate: norm(input.endDate),
    flightLabel: norm(input.flightLabel),
    hotelLabel: norm(input.hotelLabel),
    packageLabel: norm(input.packageLabel),
    travelerCount: input.travelerCount ?? input.travelers?.length ?? null,
  }

  const hasItinerary = Boolean(
    itinerary.destination
    || itinerary.flightLabel
    || itinerary.hotelLabel
    || itinerary.packageLabel
    || itinerary.startDate,
  )

  const total = typeof input.total === 'number' && Number.isFinite(input.total)
    ? input.total
    : null
  const baseFare = typeof input.baseFare === 'number' && Number.isFinite(input.baseFare)
    ? input.baseFare
    : null
  const taxes = typeof input.taxes === 'number' && Number.isFinite(input.taxes)
    ? input.taxes
    : null
  const fees = typeof input.fees === 'number' && Number.isFinite(input.fees)
    ? input.fees
    : null
  const savings = typeof input.savings === 'number' && Number.isFinite(input.savings)
    ? input.savings
    : null

  const hasPricing = total != null || baseFare != null || taxes != null || fees != null

  const policy = input.cancellationPolicy ?? null
  const hasPolicy = Boolean(
    policy
    && (policy.summary
      || policy.deadline
      || policy.refundable != null),
  )

  return {
    itinerary: hasItinerary ? itinerary : null,
    pricing: hasPricing
      ? {
        baseFare,
        taxes,
        fees,
        total: total
          ?? ((baseFare ?? 0) + (taxes ?? 0) + (fees ?? 0) || null),
        currency,
        savings,
      }
      : null,
    cancellationPolicy: hasPolicy ? policy : null,
    travelers: [...(input.travelers ?? [])],
    offerRefs: {
      flightId: input.offerRefs?.flightId ?? null,
      hotelId: input.offerRefs?.hotelId ?? null,
      packageId: input.offerRefs?.packageId ?? null,
    },
  }
}
