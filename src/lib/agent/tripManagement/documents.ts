/**
 * Sprint 62 — Document Center integration for trips.
 * Reuses Booking Execution / Payments DocumentCenter — legacy path.
 * Sprint 63 — Enterprise Document Center APIs when ai.document_center_v2 is ON.
 */

import {
  generateBookingDocuments,
  getBookingDocumentCenter,
  type BookingDocumentBundle,
} from '../bookingExecution/documents'
import type { UnifiedBooking } from '../bookingExecution/types'
import type { DocumentRecord, UnifiedTicket } from '../paymentsPlatform/types'
import {
  getDefaultDocumentService,
  isDocumentCenterV2Enabled,
  type EnterpriseDocument,
} from '../documentCenter'
import type { LiveProviderSdk } from '../liveProviders/types'
import type { ManagedTrip, TripDocumentBundle } from './types'

/** Side cache of UnifiedTicket[] keyed by document session (DocumentCenter stores docs only). */
const ticketCache = new Map<string, UnifiedTicket[]>()

/** Cache last UnifiedBooking[] per trip for sync/refresh without rewriting Trip store. */
const tripBookingsCache = new Map<string, UnifiedBooking[]>()

export function documentSessionIdForTrip(
  trip: Pick<ManagedTrip, 'documentSessionId' | 'executionSessionId' | 'tripId'>,
): string {
  if (trip.documentSessionId) return trip.documentSessionId
  if (trip.executionSessionId) return `exec_${trip.executionSessionId}`
  return `trip_${trip.tripId}`
}

export function rememberTripBookings(tripId: string, bookings: UnifiedBooking[]): void {
  tripBookingsCache.set(tripId, bookings.map((b) => structuredClone(b)))
}

export function getRememberedTripBookings(tripId: string): UnifiedBooking[] {
  return (tripBookingsCache.get(tripId) ?? []).map((b) => structuredClone(b))
}

export function ensureTripDocuments(input: {
  trip: ManagedTrip
  bookings: UnifiedBooking[]
  travelerName?: string
  now?: () => number
}): BookingDocumentBundle {
  rememberTripBookings(input.trip.tripId, input.bookings)
  const sessionId = input.trip.executionSessionId ?? input.trip.tripId
  const bundle = generateBookingDocuments({
    sessionId,
    bookings: input.bookings,
    travelerName: input.travelerName,
    now: input.now,
    tripId: input.trip.tripId,
  })
  const key = documentSessionIdForTrip(input.trip)
  ticketCache.set(key, bundle.tickets)

  // If generateBookingDocuments already published (flag ON), ensure tripId is set.
  // Re-sync covers the case where flag was toggled or tripId was missing earlier.
  if (isDocumentCenterV2Enabled()) {
    getDefaultDocumentService().syncTripDocuments({
      tripId: input.trip.tripId,
      bookings: input.bookings,
      now: input.now,
    })
  }

  return bundle
}

/** Legacy Sprint 62 bundle (payments DocumentCenter). */
export function getTripDocumentsLegacy(trip: ManagedTrip): TripDocumentBundle {
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

/**
 * Backward-compatible: ManagedTrip → legacy TripDocumentBundle.
 * Prefer getTripDocuments(tripId) for Sprint 63 enterprise docs.
 */
export function getTripDocuments(trip: ManagedTrip): TripDocumentBundle {
  return getTripDocumentsLegacy(trip)
}

/** Sprint 63 — enterprise documents for a trip id. */
export function getTripDocumentsV2(tripId: string): EnterpriseDocument[] {
  if (!isDocumentCenterV2Enabled()) return []
  return getDefaultDocumentService().getByTrip(tripId)
}

export function syncTripDocuments(input: {
  tripId: string
  bookings?: UnifiedBooking[]
  now?: () => number
}): EnterpriseDocument[] {
  if (!isDocumentCenterV2Enabled()) return []
  const bookings = input.bookings ?? getRememberedTripBookings(input.tripId)
  rememberTripBookings(input.tripId, bookings)
  return getDefaultDocumentService().syncTripDocuments({
    tripId: input.tripId,
    bookings,
    now: input.now,
  })
}

export async function refreshTripDocuments(input: {
  tripId: string
  bookings?: UnifiedBooking[]
  sdks?: Record<string, LiveProviderSdk>
  now?: () => number
}): Promise<EnterpriseDocument[]> {
  if (!isDocumentCenterV2Enabled()) return []
  const bookings = input.bookings ?? getRememberedTripBookings(input.tripId)
  return getDefaultDocumentService().refreshFromProviders({
    tripId: input.tripId,
    bookings,
    sdks: input.sdks,
    now: input.now,
  })
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
  tripBookingsCache.clear()
}

export type { DocumentRecord, UnifiedTicket, EnterpriseDocument }
