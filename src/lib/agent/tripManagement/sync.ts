/**
 * Sprint 62 — provider synchronization for trips.
 * Uses existing liveProviders retrieveBooking — does not duplicate providers.
 */

import { retrieveBooking } from '../liveProviders/bookingOps'
import type { LiveOrderResult, LiveProviderSdk } from '../liveProviders/types'
import {
  aggregateTripStatus,
  mapProviderStatusToTripStatus,
} from './lifecycle'
import { appendTimelineEvent, createTimelineEvent } from './timeline'
import type {
  ManagedTrip,
  ProviderStatusUpdate,
  TripLifecycleStatus,
  TripTimelineEventType,
} from './types'

function timelineTypeForStatus(
  status: TripLifecycleStatus,
  domain: 'flights' | 'hotels' | 'other',
): TripTimelineEventType | null {
  switch (status) {
    case 'Ticketed':
      return domain === 'flights' ? 'FlightTicketIssued' : 'DocumentsGenerated'
    case 'Confirmed':
      return domain === 'hotels' ? 'HotelConfirmed' : null
    case 'CheckedIn':
      return 'CheckInOpened'
    case 'Completed':
      return 'TripCompleted'
    case 'Cancelled':
      return 'Cancellation'
    case 'RefundPending':
    case 'Refunded':
      return 'Refund'
    default:
      return null
  }
}

function findBookingIndex(trip: ManagedTrip, update: ProviderStatusUpdate): number {
  if (update.bookingId) {
    const i = trip.bookings.findIndex((b) => b.bookingId === update.bookingId)
    if (i >= 0) return i
  }
  if (update.orderId) {
    const i = trip.bookings.findIndex(
      (b) =>
        b.confirmation === update.orderId
        || b.providerBookingId === update.orderId
        || b.hotelConfirmation === update.orderId
        || b.pnr === update.orderId,
    )
    if (i >= 0) return i
  }
  return trip.bookings.findIndex((b) => b.provider === update.provider)
}

/**
 * Merge provider status updates into a trip.
 * Preserves history; appends timeline events; never overwrites previous events.
 */
export function mergeProviderUpdates(
  trip: ManagedTrip,
  updates: ProviderStatusUpdate[],
  now?: () => number,
): ManagedTrip {
  const clock = now ?? (() => Date.now())
  let next: ManagedTrip = {
    ...trip,
    bookings: trip.bookings.map((b) => ({ ...b })),
    flights: trip.flights.map((f) => ({ ...f, ticketNumbers: [...f.ticketNumbers] })),
    hotels: trip.hotels.map((h) => ({ ...h, guestNames: [...h.guestNames] })),
    timeline: [...trip.timeline],
    bookingReferences: [...trip.bookingReferences],
    pnrs: [...trip.pnrs],
    providers: [...trip.providers],
    travelers: trip.travelers.map((t) => ({ ...t })),
  }

  for (const update of updates) {
    const idx = findBookingIndex(next, update)
    const mapped = mapProviderStatusToTripStatus(update.status)
    const at = update.at ?? new Date(clock()).toISOString()

    if (idx >= 0) {
      const prev = next.bookings[idx]!
      const domain = prev.domain === 'flights' ? 'flights' : prev.domain === 'hotels' ? 'hotels' : 'other'
      next.bookings[idx] = {
        ...prev,
        status: mapped,
        pnr: update.pnr !== undefined ? update.pnr : prev.pnr,
        hotelConfirmation:
          update.hotelConfirmation !== undefined
            ? update.hotelConfirmation
            : prev.hotelConfirmation,
        confirmation: update.orderId ?? prev.confirmation,
      }

      if (domain === 'flights') {
        next.flights = next.flights.map((f) =>
          f.bookingId === prev.bookingId
            ? {
                ...f,
                status: mapped,
                pnr: update.pnr !== undefined ? update.pnr : f.pnr,
                ticketNumbers: update.ticketNumbers?.length
                  ? [...update.ticketNumbers]
                  : f.ticketNumbers,
              }
            : f,
        )
      }
      if (domain === 'hotels') {
        next.hotels = next.hotels.map((h) =>
          h.bookingId === prev.bookingId
            ? {
                ...h,
                status: mapped,
                confirmation:
                  update.hotelConfirmation !== undefined
                    ? update.hotelConfirmation
                    : h.confirmation,
                checkIn: update.checkIn ?? h.checkIn,
                checkOut: update.checkOut ?? h.checkOut,
              }
            : h,
        )
      }

      if (update.pnr && !next.pnrs.includes(update.pnr)) {
        next.pnrs = [...next.pnrs, update.pnr]
      }
      if (update.orderId && !next.bookingReferences.includes(update.orderId)) {
        next.bookingReferences = [...next.bookingReferences, update.orderId]
      }

      const eventType = timelineTypeForStatus(mapped, domain)
      if (eventType) {
        const details: Record<string, unknown> = {
          bookingId: prev.bookingId,
          fromStatus: prev.status,
          toStatus: mapped,
        }
        if (update.details) {
          Object.assign(details, update.details)
        }
        next.timeline = appendTimelineEvent(
          next.timeline,
          createTimelineEvent({
            type: eventType,
            provider: update.provider,
            timestamp: at,
            now: clock,
            details,
          }),
        )
      }
    } else {
      // Unknown booking — still record a timeline note without dropping history.
      const details: Record<string, unknown> = {
        unmatched: true,
        status: update.status,
        orderId: update.orderId ?? null,
      }
      if (update.details) {
        Object.assign(details, update.details)
      }
      next.timeline = appendTimelineEvent(
        next.timeline,
        createTimelineEvent({
          type: timelineTypeForStatus(mapped, 'other') ?? 'BookingCreated',
          provider: update.provider,
          timestamp: at,
          now: clock,
          details,
        }),
      )
    }
  }

  next.bookingStatus = aggregateTripStatus(next.bookings.map((b) => b.status))
  next.updatedAt = new Date(clock()).toISOString()
  return next
}

export function liveOrderToProviderUpdate(
  result: LiveOrderResult,
  provider: string,
  bookingId?: string,
): ProviderStatusUpdate | null {
  if (!result.ok) return null
  return {
    bookingId,
    orderId: result.orderId,
    provider,
    status: result.status ?? 'confirmed',
    pnr: result.pnr ?? null,
    ticketNumbers: result.ticketNumbers,
    hotelConfirmation: result.hotelConfirmation ?? null,
    checkIn: result.checkIn ?? null,
    checkOut: result.checkOut ?? null,
    details: { rawStatus: result.status },
  }
}

/**
 * Refresh local trip by retrieving each booking from provider SDKs.
 */
export async function refreshTripFromProviders(input: {
  trip: ManagedTrip
  sdks: Record<string, LiveProviderSdk>
  signal?: AbortSignal
  now?: () => number
}): Promise<{ trip: ManagedTrip; retrieved: number; failed: number }> {
  const updates: ProviderStatusUpdate[] = []
  let retrieved = 0
  let failed = 0

  for (const booking of input.trip.bookings) {
    const sdk = input.sdks[booking.provider]
    if (!sdk?.retrieveOrder) continue
    const orderId =
      booking.providerBookingId
      ?? booking.confirmation
      ?? booking.hotelConfirmation
      ?? null
    if (!orderId) continue
    try {
      const result = await retrieveBooking({
        sdk,
        orderId,
        signal: input.signal,
      })
      if (!result || !result.ok) {
        failed += 1
        continue
      }
      const update = liveOrderToProviderUpdate(result, booking.provider, booking.bookingId)
      if (update) {
        updates.push(update)
        retrieved += 1
      }
    } catch {
      failed += 1
    }
  }

  const trip = updates.length
    ? mergeProviderUpdates(input.trip, updates, input.now)
    : { ...input.trip, timeline: [...input.trip.timeline] }

  return { trip, retrieved, failed }
}
