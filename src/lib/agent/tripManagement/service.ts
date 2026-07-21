/**
 * Sprint 62 — Trip Management service (consumer of Booking Execution).
 */

import type { BookingExecutionResult } from '../bookingExecution/types'
import type { UnifiedBooking } from '../bookingExecution/types'
import { isTripManagementEnabled } from './feature'
import {
  bookingRefFromUnified,
  collectBookingReferences,
  collectPnrs,
  deriveTripStatusFromBookings,
  flightFromBooking,
  hotelFromBooking,
  travelersFromBookings,
} from './fromBooking'
import { ensureTripDocuments, getTripDocuments, resetTripDocumentTicketCache } from './documents'
import { aggregateTripStatus } from './lifecycle'
import { filterTrips, searchTrips, sortTrips } from './search'
import { getDefaultTripStore, resetDefaultTripStore, type TripStore } from './store'
import { refreshTripFromProviders, mergeProviderUpdates } from './sync'
import { appendTimelineEvent, createTimelineEvent, resetTimelineSeq } from './timeline'
import type {
  CreateTripFromExecutionInput,
  ManagedTrip,
  ProviderStatusUpdate,
  TripDocumentBundle,
  TripFilterMode,
  TripLifecycleStatus,
  TripPaymentStatus,
  TripPurpose,
  TripSearchQuery,
  TripSortMode,
  TripTimelineEventType,
} from './types'
import type { LiveProviderSdk } from '../liveProviders/types'

function newTripId(now: () => number): string {
  return `trip_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function buildTripShell(input: CreateTripFromExecutionInput): ManagedTrip {
  const now = input.now ?? (() => Date.now())
  const at = new Date(now()).toISOString()
  const bookings = input.bookings
  const travelers =
    input.travelers?.map((t) => ({
      firstName: t.firstName,
      lastName: t.lastName,
      email: t.email ?? null,
      phone: t.phone ?? null,
    }))
    ?? travelersFromBookings(bookings)
  const providers = [...new Set(bookings.map((b) => b.provider))]
  const flights = bookings.map(flightFromBooking).filter((f): f is NonNullable<typeof f> => f != null)
  const hotels = bookings.map(hotelFromBooking).filter((h): h is NonNullable<typeof h> => h != null)
  const executionSessionId = input.executionSessionId ?? bookings[0]?.sessionId ?? null
  const tripId = newTripId(now)

  // Enrich origin/destination from optional input or hotel check-in city placeholder.
  const origin = input.origin?.trim() || ''
  const destination = input.destination?.trim() || ''

  // Apply caller departure/return onto flight segments when provided.
  if (input.departure || input.return) {
    for (const f of flights) {
      if (input.departure && !f.departureAt) f.departureAt = input.departure
      if (input.return && !f.arrivalAt) f.arrivalAt = input.return
      if (origin && !f.origin) f.origin = origin
      if (destination && !f.destination) f.destination = destination
    }
  }
  if (destination) {
    for (const h of hotels) {
      if (!h.hotelName) h.hotelName = destination
    }
  }

  let timeline = [
    createTimelineEvent({
      type: 'BookingCreated',
      provider: providers[0] ?? null,
      now,
      details: {
        bookingIds: bookings.map((b) => b.id),
        providers,
        count: bookings.length,
      },
    }),
  ]

  for (const b of bookings) {
    if (b.domain === 'hotels' && (b.status === 'confirmed' || b.status === 'ticketed')) {
      timeline = appendTimelineEvent(
        timeline,
        createTimelineEvent({
          type: 'HotelConfirmed',
          provider: b.provider,
          now,
          details: {
            bookingId: b.id,
            confirmation: b.hotelConfirmation ?? b.confirmation,
          },
        }),
      )
    }
    if (b.domain === 'flights' && (b.status === 'ticketed' || b.ticketNumbers.length > 0)) {
      timeline = appendTimelineEvent(
        timeline,
        createTimelineEvent({
          type: 'FlightTicketIssued',
          provider: b.provider,
          now,
          details: {
            bookingId: b.id,
            ticketNumbers: b.ticketNumbers,
            pnr: b.pnr,
          },
        }),
      )
    }
  }

  if (input.paymentStatus === 'paid') {
    timeline = appendTimelineEvent(
      timeline,
      createTimelineEvent({
        type: 'PaymentCompleted',
        provider: providers[0] ?? null,
        now,
        details: { paymentStatus: 'paid' },
      }),
    )
  }

  const trip: ManagedTrip = {
    tripId,
    userId: input.userId,
    travelers,
    destination: destination || hotels[0]?.hotelName || flights[0]?.destination || '',
    origin: origin || flights[0]?.origin || '',
    departure: input.departure ?? flights[0]?.departureAt ?? hotels[0]?.checkIn ?? null,
    return: input.return ?? flights[0]?.arrivalAt ?? hotels[0]?.checkOut ?? null,
    provider: providers.join('+') || 'unknown',
    providers,
    bookingReferences: collectBookingReferences(bookings),
    pnrs: collectPnrs(bookings),
    flights,
    hotels,
    bookings: bookings.map(bookingRefFromUnified),
    bookingStatus: deriveTripStatusFromBookings(bookings),
    paymentStatus: input.paymentStatus ?? 'unpaid',
    purpose: input.purpose ?? 'unknown',
    executionSessionId,
    documentSessionId: executionSessionId ? `exec_${executionSessionId}` : `trip_${tripId}`,
    conversationId: input.conversationId ?? bookings[0]?.conversationId ?? null,
    timeline,
    createdAt: at,
    updatedAt: at,
  }

  return trip
}

export class TripManagementService {
  private readonly store: TripStore

  constructor(store: TripStore = getDefaultTripStore()) {
    this.store = store
  }

  createTripFromBookings(input: CreateTripFromExecutionInput): ManagedTrip {
    if (!isTripManagementEnabled()) {
      throw new Error('trip_management_disabled')
    }
    const trip = buildTripShell(input)
    if (input.generateDocuments !== false && input.bookings.length > 0) {
      const travelerName = trip.travelers[0]
        ? `${trip.travelers[0].firstName} ${trip.travelers[0].lastName}`
        : undefined
      ensureTripDocuments({
        trip,
        bookings: input.bookings,
        travelerName,
        now: input.now,
      })
      const withDocs = {
        ...trip,
        timeline: appendTimelineEvent(
          trip.timeline,
          createTimelineEvent({
            type: 'DocumentsGenerated',
            provider: trip.providers[0] ?? null,
            now: input.now,
            details: { documentSessionId: trip.documentSessionId },
          }),
        ),
        updatedAt: new Date((input.now ?? Date.now)()).toISOString(),
      }
      return this.store.save(withDocs)
    }
    return this.store.save(trip)
  }

  createTripFromExecution(
    result: BookingExecutionResult,
    options: {
      userId: string
      destination?: string | null
      origin?: string | null
      departure?: string | null
      return?: string | null
      purpose?: TripPurpose
      paymentStatus?: TripPaymentStatus
      generateDocuments?: boolean
      now?: () => number
    },
  ): ManagedTrip {
    return this.createTripFromBookings({
      userId: options.userId,
      bookings: result.bookings,
      travelers: result.session.travelers,
      executionSessionId: result.session.id,
      conversationId: result.bookings[0]?.conversationId ?? null,
      destination: options.destination,
      origin: options.origin,
      departure: options.departure,
      return: options.return,
      purpose: options.purpose,
      paymentStatus: options.paymentStatus,
      generateDocuments: options.generateDocuments,
      now: options.now,
    })
  }

  /** Attach additional bookings to an existing trip (multi-provider). */
  addBookingsToTrip(
    tripId: string,
    bookings: UnifiedBooking[],
    now?: () => number,
  ): ManagedTrip | null {
    const existing = this.store.get(tripId)
    if (!existing) return null
    const clock = now ?? (() => Date.now())
    const mergedBookings = [
      ...existing.bookings,
      ...bookings.map(bookingRefFromUnified),
    ]
    const flights = [
      ...existing.flights,
      ...bookings.map(flightFromBooking).filter((f): f is NonNullable<typeof f> => f != null),
    ]
    const hotels = [
      ...existing.hotels,
      ...bookings.map(hotelFromBooking).filter((h): h is NonNullable<typeof h> => h != null),
    ]
    const providers = [...new Set([...existing.providers, ...bookings.map((b) => b.provider)])]
    let timeline = [...existing.timeline]
    for (const b of bookings) {
      timeline = appendTimelineEvent(
        timeline,
        createTimelineEvent({
          type: 'BookingCreated',
          provider: b.provider,
          now: clock,
          details: { bookingId: b.id, addedToTrip: tripId },
        }),
      )
      if (b.domain === 'hotels') {
        timeline = appendTimelineEvent(
          timeline,
          createTimelineEvent({
            type: 'HotelConfirmed',
            provider: b.provider,
            now: clock,
            details: { bookingId: b.id },
          }),
        )
      }
    }
    const next: ManagedTrip = {
      ...existing,
      providers,
      provider: providers.join('+'),
      bookings: mergedBookings,
      flights,
      hotels,
      bookingReferences: [
        ...new Set([
          ...existing.bookingReferences,
          ...collectBookingReferences(bookings),
        ]),
      ],
      pnrs: [...new Set([...existing.pnrs, ...collectPnrs(bookings)])],
      travelers: [
        ...existing.travelers,
        ...travelersFromBookings(bookings).filter(
          (t) =>
            !existing.travelers.some(
              (e) => e.firstName === t.firstName && e.lastName === t.lastName,
            ),
        ),
      ],
      bookingStatus: aggregateTripStatus(mergedBookings.map((b) => b.status)),
      timeline,
      updatedAt: new Date(clock()).toISOString(),
    }
    return this.store.save(next)
  }

  getTrip(tripId: string): ManagedTrip | null {
    return this.store.get(tripId)
  }

  getTrips(userId?: string): ManagedTrip[] {
    return this.store.list(userId)
  }

  getTripStatus(tripId: string): TripLifecycleStatus | null {
    return this.store.get(tripId)?.bookingStatus ?? null
  }

  mergeProviderUpdates(
    tripId: string,
    updates: ProviderStatusUpdate[],
    now?: () => number,
  ): ManagedTrip | null {
    const trip = this.store.get(tripId)
    if (!trip) return null
    return this.store.save(mergeProviderUpdates(trip, updates, now))
  }

  async refreshTrip(input: {
    tripId: string
    sdks: Record<string, LiveProviderSdk>
    signal?: AbortSignal
    now?: () => number
  }): Promise<ManagedTrip | null> {
    const trip = this.store.get(input.tripId)
    if (!trip) return null
    const { trip: refreshed } = await refreshTripFromProviders({
      trip,
      sdks: input.sdks,
      signal: input.signal,
      now: input.now,
    })
    return this.store.save(refreshed)
  }

  search(query: TripSearchQuery): ManagedTrip[] {
    return searchTrips(this.store.list(query.userId), query)
  }

  filter(mode: TripFilterMode, userId?: string, now?: () => number): ManagedTrip[] {
    return filterTrips(this.store.list(userId), mode, now)
  }

  sort(mode: TripSortMode, userId?: string, now?: () => number): ManagedTrip[] {
    return sortTrips(this.store.list(userId), mode, now)
  }

  getDocuments(tripId: string): TripDocumentBundle | null {
    const trip = this.store.get(tripId)
    if (!trip) return null
    return getTripDocuments(trip)
  }

  appendEvent(
    tripId: string,
    type: TripTimelineEventType,
    details?: Record<string, unknown>,
    provider?: string | null,
    now?: () => number,
  ): ManagedTrip | null {
    const trip = this.store.get(tripId)
    if (!trip) return null
    const clock = now ?? (() => Date.now())
    const next: ManagedTrip = {
      ...trip,
      timeline: appendTimelineEvent(
        trip.timeline,
        createTimelineEvent({ type, provider: provider ?? null, details, now: clock }),
      ),
      updatedAt: new Date(clock()).toISOString(),
    }
    if (type === 'TripCompleted') next.bookingStatus = 'Completed'
    if (type === 'Cancellation') next.bookingStatus = 'Cancelled'
    if (type === 'Refund') {
      next.bookingStatus = 'Refunded'
      next.paymentStatus = 'refunded'
    }
    if (type === 'PaymentCompleted') next.paymentStatus = 'paid'
    if (type === 'CheckInOpened') next.bookingStatus = 'CheckedIn'
    if (type === 'FlightDeparted' || type === 'FlightArrived') {
      // keep status unless already terminal
    }
    return this.store.save(next)
  }

  updatePaymentStatus(
    tripId: string,
    paymentStatus: TripPaymentStatus,
    now?: () => number,
  ): ManagedTrip | null {
    const trip = this.store.get(tripId)
    if (!trip) return null
    const clock = now ?? (() => Date.now())
    let timeline = [...trip.timeline]
    if (paymentStatus === 'paid') {
      timeline = appendTimelineEvent(
        timeline,
        createTimelineEvent({
          type: 'PaymentCompleted',
          provider: trip.providers[0] ?? null,
          now: clock,
          details: { paymentStatus },
        }),
      )
    }
    if (paymentStatus === 'refunded' || paymentStatus === 'refund_pending') {
      timeline = appendTimelineEvent(
        timeline,
        createTimelineEvent({
          type: 'Refund',
          provider: trip.providers[0] ?? null,
          now: clock,
          details: { paymentStatus },
        }),
      )
    }
    return this.store.save({
      ...trip,
      paymentStatus,
      bookingStatus:
        paymentStatus === 'refunded'
          ? 'Refunded'
          : paymentStatus === 'refund_pending'
            ? 'RefundPending'
            : trip.bookingStatus,
      timeline,
      updatedAt: new Date(clock()).toISOString(),
    })
  }
}

let defaultService: TripManagementService | null = null

export function getDefaultTripManagementService(): TripManagementService {
  if (!defaultService) defaultService = new TripManagementService()
  return defaultService
}

export function resetDefaultTripManagementService(): void {
  resetDefaultTripStore()
  resetTimelineSeq()
  resetTripDocumentTicketCache()
  defaultService = null
}

// Convenience facades matching sprint API names
export function createTripFromBookings(input: CreateTripFromExecutionInput): ManagedTrip {
  return getDefaultTripManagementService().createTripFromBookings(input)
}

export function createTripFromExecution(
  result: BookingExecutionResult,
  options: Parameters<TripManagementService['createTripFromExecution']>[1],
): ManagedTrip {
  return getDefaultTripManagementService().createTripFromExecution(result, options)
}

export function getTrip(tripId: string): ManagedTrip | null {
  return getDefaultTripManagementService().getTrip(tripId)
}

export function getTrips(userId?: string): ManagedTrip[] {
  return getDefaultTripManagementService().getTrips(userId)
}

export function getTripStatus(tripId: string): TripLifecycleStatus | null {
  return getDefaultTripManagementService().getTripStatus(tripId)
}

export async function refreshTrip(input: {
  tripId: string
  sdks: Record<string, LiveProviderSdk>
  signal?: AbortSignal
  now?: () => number
}): Promise<ManagedTrip | null> {
  return getDefaultTripManagementService().refreshTrip(input)
}

export function mergeTripProviderUpdates(
  tripId: string,
  updates: ProviderStatusUpdate[],
  now?: () => number,
): ManagedTrip | null {
  return getDefaultTripManagementService().mergeProviderUpdates(tripId, updates, now)
}

// Re-export pure merge for tests
export { mergeProviderUpdates }
