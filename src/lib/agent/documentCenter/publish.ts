/**
 * Sprint 63 — publish documents from bookings / providers.
 * Provider-agnostic: Amadeus, Booking.com, Duffel, and future providers work unchanged.
 */

import type { UnifiedBooking } from '../bookingExecution/types'
import type { CreateDocumentInput, EnterpriseDocumentType } from './types'

function travelerIdFromBooking(b: UnifiedBooking, index = 0): string {
  const t = b.travelerInfo[index]
  if (!t) return `traveler_${b.id}`
  return `traveler_${t.firstName}_${t.lastName}`.toLowerCase().replace(/\s+/g, '_')
}

function draftsForBooking(input: {
  booking: UnifiedBooking
  tripId?: string | null
  now?: () => number
}): CreateDocumentInput[] {
  const b = input.booking
  const travelerId = travelerIdFromBooking(b)
  const base = {
    tripId: input.tripId ?? null,
    bookingId: b.id,
    providerId: b.provider,
    travelerId,
    now: input.now,
    metadata: {
      source: 'provider' as const,
      offlineCacheable: true,
      custom: { domain: b.domain },
    },
  }

  const drafts: CreateDocumentInput[] = []

  if (b.domain === 'flights') {
    drafts.push({
      ...base,
      documentType: 'E_TICKET',
      title: `E-Ticket ${b.pnr ?? b.confirmation ?? b.id}`,
      providerReference: b.pnr ?? b.confirmation,
      contentBody: [
        `PNR: ${b.pnr ?? 'n/a'}`,
        `Tickets: ${(b.ticketNumbers ?? []).join(', ') || 'n/a'}`,
        `Provider: ${b.provider}`,
        `Confirmation: ${b.confirmation ?? 'n/a'}`,
      ].join('\n'),
      expiresAt: b.expiresAt,
    })
    drafts.push({
      ...base,
      documentType: 'BOARDING_PASS',
      title: `Boarding pass ${b.pnr ?? b.id}`,
      providerReference: b.confirmation,
      contentBody: `Boarding pass placeholder for ${b.pnr ?? b.id}`,
      status: 'pending',
      expiresAt: b.expiresAt,
    })
  }

  if (b.domain === 'hotels') {
    drafts.push({
      ...base,
      documentType: 'HOTEL_VOUCHER',
      title: `Hotel voucher ${b.hotelConfirmation ?? b.confirmation ?? b.id}`,
      providerReference: b.hotelConfirmation ?? b.confirmation,
      contentBody: [
        `Confirmation: ${b.hotelConfirmation ?? b.confirmation ?? 'n/a'}`,
        `Room: ${b.roomType ?? 'n/a'}`,
        `Check-in: ${b.checkIn ?? 'n/a'}`,
        `Check-out: ${b.checkOut ?? 'n/a'}`,
        `Guests: ${b.guestNames.join(', ') || 'n/a'}`,
      ].join('\n'),
    })
    drafts.push({
      ...base,
      documentType: 'HOTEL_CONFIRMATION',
      title: `Hotel confirmation ${b.hotelConfirmation ?? b.id}`,
      providerReference: b.hotelConfirmation ?? b.reservationId,
      contentBody: `Hotel confirmation for ${b.hotelConfirmation ?? b.id}`,
    })
  }

  // Shared financial docs per booking
  drafts.push({
    ...base,
    documentType: 'INVOICE',
    title: `Invoice ${b.id}`,
    providerReference: b.confirmation,
    contentBody: `Invoice ${b.pricing.amount} ${b.pricing.currency} — booking ${b.id}`,
  })
  drafts.push({
    ...base,
    documentType: 'RECEIPT',
    title: `Receipt ${b.id}`,
    providerReference: b.confirmation,
    contentBody: `Receipt ${b.pricing.amount} ${b.pricing.currency} — booking ${b.id}`,
  })

  return drafts
}

/** Map any provider booking → document drafts (future providers need no changes). */
export function draftsFromBookings(input: {
  bookings: UnifiedBooking[]
  tripId?: string | null
  includeItinerary?: boolean
  now?: () => number
}): CreateDocumentInput[] {
  const drafts = input.bookings.flatMap((booking) =>
    draftsForBooking({ booking, tripId: input.tripId, now: input.now }),
  )

  if (input.includeItinerary !== false && input.bookings.length > 0) {
    drafts.push({
      tripId: input.tripId ?? null,
      bookingId: input.bookings[0]?.id ?? null,
      providerId: input.bookings[0]?.provider ?? 'system',
      travelerId: travelerIdFromBooking(input.bookings[0]!),
      documentType: 'ITINERARY' satisfies EnterpriseDocumentType,
      title: 'Trip itinerary',
      contentBody: input.bookings
        .map((b) => `${b.domain}:${b.provider}:${b.confirmation ?? b.id}`)
        .join('\n'),
      metadata: { source: 'system', offlineCacheable: true },
      now: input.now,
    })
  }

  return drafts
}

export function draftsFromBookingExecution(input: {
  sessionId: string
  bookings: UnifiedBooking[]
  tripId?: string | null
  now?: () => number
}): CreateDocumentInput[] {
  return draftsFromBookings({
    bookings: input.bookings,
    tripId: input.tripId ?? null,
    includeItinerary: true,
    now: input.now,
  }).map((d) => ({
    ...d,
    metadata: {
      ...d.metadata,
      source: 'booking_execution',
      custom: { ...d.metadata?.custom, sessionId: input.sessionId },
    },
  }))
}
