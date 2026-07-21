/**
 * Sprint 62 — Document Center integration for trips.
 * Reuses Booking Execution / Payments DocumentCenter — no second document system.
 */

import {
  generateBookingDocuments,
  getBookingDocumentCenter,
  type BookingDocumentBundle,
} from '../bookingExecution/documents'
import type { UnifiedBooking } from '../bookingExecution/types'
import type { DocumentRecord, UnifiedTicket } from '../paymentsPlatform/types'
import type { ManagedTrip, TripDocumentBundle } from './types'

/** Side cache of UnifiedTicket[] keyed by document session (DocumentCenter stores docs only). */
const ticketCache = new Map<string, UnifiedTicket[]>()

export function documentSessionIdForTrip(
  trip: Pick<ManagedTrip, 'documentSessionId' | 'executionSessionId' | 'tripId'>,
): string {
  if (trip.documentSessionId) return trip.documentSessionId
  if (trip.executionSessionId) return `exec_${trip.executionSessionId}`
  return `trip_${trip.tripId}`
}

export function ensureTripDocuments(input: {
  trip: ManagedTrip
  bookings: UnifiedBooking[]
  travelerName?: string
  now?: () => number
}): BookingDocumentBundle {
  const sessionId = input.trip.executionSessionId ?? input.trip.tripId
  const bundle = generateBookingDocuments({
    sessionId,
    bookings: input.bookings,
    travelerName: input.travelerName,
    now: input.now,
  })
  const key = documentSessionIdForTrip(input.trip)
  ticketCache.set(key, bundle.tickets)
  return bundle
}

export function getTripDocuments(trip: ManagedTrip): TripDocumentBundle {
  const center = getBookingDocumentCenter()
  const sessionKey = documentSessionIdForTrip(trip)
  const all = center.list(sessionKey)
  const tickets = ticketCache.get(sessionKey) ?? []
  return {
    tickets: [...tickets],
    hotelVouchers: all.filter((d) => d.kind === 'voucher'),
    invoice: all.find((d) => d.kind === 'invoice') ?? null,
    receipts: all.filter((d) => d.kind === 'receipt'),
    summary:
      all.find((d) => d.kind === 'confirmation_pdf' && d.label === 'Booking summary')
      ?? all.find((d) => d.kind === 'confirmation_pdf')
      ?? null,
    all,
  }
}

export function emptyTripDocuments(): TripDocumentBundle {
  return {
    tickets: [],
    hotelVouchers: [],
    invoice: null,
    receipts: [],
    summary: null,
    all: [],
  }
}

export function resetTripDocumentTicketCache(): void {
  ticketCache.clear()
}

export type { DocumentRecord, UnifiedTicket }
