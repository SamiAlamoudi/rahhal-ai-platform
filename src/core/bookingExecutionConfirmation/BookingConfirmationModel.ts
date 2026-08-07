/**
 * Sprint 102 — booking confirmation presentation model.
 */

import type { BookingLifecycleSnapshot } from './BookingLifecycle'
import type { BookingItinerarySummary, BookingPriceBreakdown } from './types'

export interface BookingConfirmationModel {
  bookingId: string
  bookingReference: string | null
  /** Explicit PNR placeholder until a live adapter supplies a real locator. */
  pnrPlaceholder: string | null
  lifecycle: BookingLifecycleSnapshot
  itinerary: BookingItinerarySummary | null
  pricing: BookingPriceBreakdown | null
  actions: {
    canDownload: boolean
    canShare: boolean
    downloadLabel: string
    shareLabel: string
  }
}

export function buildBookingConfirmationModel(input: {
  bookingId: string
  bookingReference: string | null
  pnrPlaceholder: string | null
  lifecycle: BookingLifecycleSnapshot
  itinerary: BookingItinerarySummary | null
  pricing: BookingPriceBreakdown | null
}): BookingConfirmationModel {
  const confirmed = input.lifecycle.status === 'confirmed'
  return {
    bookingId: input.bookingId,
    bookingReference: input.bookingReference,
    pnrPlaceholder: input.pnrPlaceholder ?? (confirmed ? `PNR-PENDING-${input.bookingId.slice(-6).toUpperCase()}` : null),
    lifecycle: input.lifecycle,
    itinerary: input.itinerary,
    pricing: input.pricing,
    actions: {
      canDownload: confirmed,
      canShare: confirmed,
      downloadLabel: 'Download confirmation',
      shareLabel: 'Share booking',
    },
  }
}

/** Build a simple text payload for download/share actions (no network). */
export function formatConfirmationShareText(model: BookingConfirmationModel): string {
  const lines = [
    'Bilamo booking confirmation',
    model.bookingReference ? `Reference: ${model.bookingReference}` : null,
    model.pnrPlaceholder ? `PNR: ${model.pnrPlaceholder}` : null,
    model.itinerary?.destination ? `Destination: ${model.itinerary.destination}` : null,
    model.itinerary?.flightLabel ? `Flight: ${model.itinerary.flightLabel}` : null,
    model.itinerary?.hotelLabel ? `Hotel: ${model.itinerary.hotelLabel}` : null,
    model.pricing?.total != null
      ? `Total: ${model.pricing.total} ${model.pricing.currency}`
      : null,
    `Status: ${model.lifecycle.status}`,
  ].filter(Boolean)
  return lines.join('\n')
}
