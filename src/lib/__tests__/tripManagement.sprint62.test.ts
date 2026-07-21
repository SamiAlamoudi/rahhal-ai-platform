/**
 * Sprint 62 — Unified Trip Management Platform tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  createAmadeusLiveProvider,
  createBookingLiveProvider,
  type LiveFlightOffer,
  type LiveHotelOffer,
} from '../agent/liveProviders'
import {
  normalizeProviderBooking,
  resetBookingDocumentCenter,
} from '../agent/bookingExecution'
import type { UnifiedBooking } from '../agent/bookingExecution/types'
import {
  aggregateTripStatus,
  createTripFromBookings,
  filterTrips,
  getTrip,
  getTripDocuments,
  getTripStatus,
  getTrips,
  isTripManagementEnabled,
  mapBookingLifecycleToTripStatus,
  mergeProviderUpdates,
  mergeTripProviderUpdates,
  refreshTrip,
  resetDefaultTripManagementService,
  searchTrips,
  sortTrips,
  TripManagementService,
  TRIP_MANAGEMENT_FEATURE_ID,
} from '../agent/tripManagement'

function money(amount: number, currency = 'SAR') {
  return { amount, currency }
}

function flightBooking(overrides: Partial<UnifiedBooking> = {}): UnifiedBooking {
  const base = normalizeProviderBooking({
    sessionId: 'sess_1',
    conversationId: 'conv_1',
    domain: 'flights',
    providerId: 'amadeus',
    offerId: 'OFF1',
    confirmationId: 'AMD-PNR-ABC123',
    status: 'ticketed',
    travelers: [{ firstName: 'Sara', lastName: 'Alharbi', email: 'sara@example.com' }],
    pricing: money(1200),
    taxes: money(100),
    order: {
      ok: true,
      orderId: 'AMD-PNR-ABC123',
      providerBookingId: 'amd-ord-1',
      pnr: 'ABC123',
      ticketNumbers: ['172-1234567890'],
      travelerList: [{ firstName: 'Sara', lastName: 'Alharbi' }],
      price: money(1200),
    },
  })
  return { ...base, ...overrides }
}

function hotelBooking(overrides: Partial<UnifiedBooking> = {}): UnifiedBooking {
  const base = normalizeProviderBooking({
    sessionId: 'sess_1',
    conversationId: 'conv_1',
    domain: 'hotels',
    providerId: 'booking',
    offerId: 'HTL1',
    confirmationId: 'BKG-HTL-999',
    status: 'confirmed',
    travelers: [{ firstName: 'Sara', lastName: 'Alharbi' }],
    pricing: money(640),
    checkIn: '2026-11-01',
    checkOut: '2026-11-05',
    roomType: 'Deluxe King',
    order: {
      ok: true,
      orderId: 'BKG-HTL-999',
      providerBookingId: 'bkg-ord-1',
      hotelConfirmation: 'BKG-HTL-999',
      guestNames: ['Sara Alharbi'],
      checkIn: '2026-11-01',
      checkOut: '2026-11-05',
      roomType: 'Deluxe King',
      price: money(640),
    },
  })
  return { ...base, ...overrides }
}

describe('Sprint 62 — Trip Management', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetDefaultTripManagementService()
    resetBookingDocumentCenter()
  })

  afterEach(() => {
    resetDefaultTripManagementService()
    resetBookingDocumentCenter()
    vi.restoreAllMocks()
  })

  it('enables ai.trip_management by default (depends on booking execution)', () => {
    expect(TRIP_MANAGEMENT_FEATURE_ID).toBe('ai.trip_management')
    expect(isTripManagementEnabled()).toBe(true)
    expect(getFeatureRegistry().isEnabled('ai.booking_execution')).toBe(true)
  })

  it('creates a trip from bookings with required fields', () => {
    const flight = flightBooking()
    const hotel = hotelBooking()
    const trip = createTripFromBookings({
      userId: 'user_1',
      bookings: [flight, hotel],
      destination: 'Dubai',
      origin: 'Riyadh',
      departure: '2026-11-01T08:00:00Z',
      return: '2026-11-05T20:00:00Z',
      purpose: 'leisure',
      paymentStatus: 'paid',
    })

    expect(trip.tripId).toMatch(/^trip_/)
    expect(trip.travelers[0]?.firstName).toBe('Sara')
    expect(trip.destination).toBe('Dubai')
    expect(trip.origin).toBe('Riyadh')
    expect(trip.departure).toBe('2026-11-01T08:00:00Z')
    expect(trip.return).toBe('2026-11-05T20:00:00Z')
    expect(trip.providers).toEqual(expect.arrayContaining(['amadeus', 'booking']))
    expect(trip.flights).toHaveLength(1)
    expect(trip.hotels).toHaveLength(1)
    expect(trip.bookingReferences.length).toBeGreaterThan(0)
    expect(trip.pnrs).toContain('ABC123')
    expect(trip.bookingStatus).toBe('Ticketed')
    expect(trip.paymentStatus).toBe('paid')
    expect(trip.createdAt).toBeTruthy()
    expect(trip.updatedAt).toBeTruthy()
  })

  it('supports multiple bookings on one trip', () => {
    const service = new TripManagementService()
    const trip = service.createTripFromBookings({
      userId: 'user_1',
      bookings: [flightBooking()],
      destination: 'Dubai',
      origin: 'RUH',
      generateDocuments: false,
    })
    const updated = service.addBookingsToTrip(trip.tripId, [hotelBooking()])
    expect(updated).not.toBeNull()
    expect(updated!.bookings).toHaveLength(2)
    expect(updated!.flights).toHaveLength(1)
    expect(updated!.hotels).toHaveLength(1)
    expect(updated!.providers).toEqual(expect.arrayContaining(['amadeus', 'booking']))
    expect(updated!.timeline.filter((e) => e.type === 'BookingCreated').length).toBeGreaterThanOrEqual(2)
  })

  it('builds chronological timeline events (append-only)', () => {
    const trip = createTripFromBookings({
      userId: 'user_1',
      bookings: [flightBooking(), hotelBooking()],
      paymentStatus: 'paid',
      destination: 'DXB',
      origin: 'RUH',
    })
    const types = trip.timeline.map((e) => e.type)
    expect(types[0]).toBe('BookingCreated')
    expect(types).toContain('HotelConfirmed')
    expect(types).toContain('FlightTicketIssued')
    expect(types).toContain('PaymentCompleted')
    expect(types).toContain('DocumentsGenerated')
    for (const ev of trip.timeline) {
      expect(ev.timestamp).toBeTruthy()
      expect(ev.type).toBeTruthy()
      expect(ev.details).toBeTypeOf('object')
    }
    const beforeLen = trip.timeline.length
    const merged = mergeTripProviderUpdates(trip.tripId, [
      {
        bookingId: trip.bookings[0]!.bookingId,
        provider: 'amadeus',
        status: 'checked_in',
      },
    ])
    expect(merged!.timeline.length).toBeGreaterThan(beforeLen)
    expect(merged!.timeline.slice(0, beforeLen)).toEqual(trip.timeline)
  })

  it('never overwrites previous timeline events on sync', () => {
    const trip = createTripFromBookings({
      userId: 'u',
      bookings: [flightBooking({ status: 'confirmed' })],
      generateDocuments: false,
    })
    const original = [...trip.timeline]
    const next = mergeProviderUpdates(trip, [
      { bookingId: trip.bookings[0]!.bookingId, provider: 'amadeus', status: 'ticketed' },
      { bookingId: trip.bookings[0]!.bookingId, provider: 'amadeus', status: 'checked_in' },
    ])
    expect(next.timeline.slice(0, original.length)).toEqual(original)
    expect(next.timeline.length).toBe(original.length + 2)
  })

  it('maps and aggregates lifecycle statuses', () => {
    expect(mapBookingLifecycleToTripStatus('pending')).toBe('Pending')
    expect(mapBookingLifecycleToTripStatus('confirmed')).toBe('Confirmed')
    expect(mapBookingLifecycleToTripStatus('ticketed')).toBe('Ticketed')
    expect(mapBookingLifecycleToTripStatus('cancelled')).toBe('Cancelled')
    expect(mapBookingLifecycleToTripStatus('expired')).toBe('Expired')
    expect(aggregateTripStatus(['Confirmed', 'Ticketed'])).toBe('Ticketed')
    expect(aggregateTripStatus(['Cancelled', 'Cancelled'])).toBe('Cancelled')
    expect(aggregateTripStatus(['Refunded', 'Refunded'])).toBe('Refunded')
  })

  it('retrieves trips and status', () => {
    const a = createTripFromBookings({
      userId: 'user_a',
      bookings: [flightBooking()],
      generateDocuments: false,
    })
    createTripFromBookings({
      userId: 'user_b',
      bookings: [hotelBooking()],
      generateDocuments: false,
    })
    expect(getTrip(a.tripId)?.tripId).toBe(a.tripId)
    expect(getTripStatus(a.tripId)).toBe(a.bookingStatus)
    expect(getTrips('user_a')).toHaveLength(1)
    expect(getTrips()).toHaveLength(2)
  })

  it('refreshes trip via provider retrieve (Amadeus + Booking)', async () => {
    const amadeus = createAmadeusLiveProvider({
      clientId: 'cid',
      clientSecret: 'secret',
      orderLive: false,
    })
    const booking = createBookingLiveProvider({
      apiKey: 'rapid_test',
      orderLive: false,
    })
    const offer: LiveFlightOffer = {
      id: 'OFF1',
      providerId: 'amadeus',
      from: 'RUH',
      to: 'DXB',
      airline: 'SV',
      cabin: 'ECONOMY',
      stops: 0,
      durationMinutes: 180,
      departureAt: '2026-11-01T08:00:00',
      arrivalAt: '2026-11-01T11:00:00',
      price: money(1200),
      refundable: true,
      raw: { id: 'OFF1' },
    }
    ;(amadeus as unknown as { seedFlightOffer: (o: LiveFlightOffer) => void }).seedFlightOffer(offer)
    const created = await amadeus.createOrder!('OFF1')
    expect(created.ok).toBe(true)

    const hotelOffer: LiveHotelOffer = {
      id: 'HTL1',
      providerId: 'booking',
      name: 'Harbor Inn',
      address: 'Corniche',
      area: 'Jeddah',
      stars: 4,
      rating: 8.5,
      roomType: 'King',
      cancellationPolicy: 'Free',
      nightly: money(640),
      total: money(640),
      taxes: money(64),
      currency: 'SAR',
      photos: [],
      amenities: [],
      latitude: 21,
      longitude: 39,
      distanceFromCenterKm: 1,
      refundable: true,
    }
    ;(booking as unknown as { seedHotelOffer: (o: LiveHotelOffer) => void }).seedHotelOffer(hotelOffer)
    const hotelOrder = await booking.createOrder!('HTL1')
    expect(hotelOrder.ok).toBe(true)

    const flight = flightBooking({
      confirmation: created.orderId!,
      providerBookingId: created.orderId!,
      pnr: created.pnr ?? 'ABC123',
      status: 'confirmed',
    })
    const hotel = hotelBooking({
      confirmation: hotelOrder.orderId!,
      providerBookingId: hotelOrder.orderId!,
      hotelConfirmation: hotelOrder.hotelConfirmation ?? hotelOrder.orderId!,
      status: 'confirmed',
    })
    const trip = createTripFromBookings({
      userId: 'user_1',
      bookings: [flight, hotel],
      generateDocuments: false,
    })
    const timelineLen = trip.timeline.length
    const refreshed = await refreshTrip({
      tripId: trip.tripId,
      sdks: { amadeus, booking },
    })
    expect(refreshed).not.toBeNull()
    expect(refreshed!.timeline.length).toBeGreaterThanOrEqual(timelineLen)
    expect(refreshed!.bookings.length).toBe(2)
  })

  it('updates status through mergeProviderUpdates', () => {
    const trip = createTripFromBookings({
      userId: 'u',
      bookings: [flightBooking({ status: 'confirmed' })],
      generateDocuments: false,
    })
    const next = mergeTripProviderUpdates(trip.tripId, [
      {
        bookingId: trip.bookings[0]!.bookingId,
        provider: 'amadeus',
        status: 'cancelled',
      },
    ])
    expect(next!.bookingStatus).toBe('Cancelled')
    expect(next!.timeline.some((e) => e.type === 'Cancellation')).toBe(true)
  })

  it('searches by destination, traveler, booking reference, PNR, hotel, date, status', () => {
    createTripFromBookings({
      userId: 'u',
      bookings: [flightBooking(), hotelBooking()],
      destination: 'Dubai',
      origin: 'Riyadh',
      departure: '2026-11-01T08:00:00Z',
      purpose: 'leisure',
      generateDocuments: false,
    })
    const all = getTrips('u')
    expect(searchTrips(all, { destination: 'dubai' })).toHaveLength(1)
    expect(searchTrips(all, { traveler: 'sara' })).toHaveLength(1)
    expect(searchTrips(all, { pnr: 'ABC123' })).toHaveLength(1)
    expect(searchTrips(all, { bookingReference: 'AMD-PNR' })).toHaveLength(1)
    expect(searchTrips(all, { hotel: 'BKG-HTL' })).toHaveLength(1)
    expect(searchTrips(all, { date: '2026-11-01' })).toHaveLength(1)
    expect(searchTrips(all, { status: 'Ticketed' })).toHaveLength(1)
    expect(searchTrips(all, { destination: 'nowhere' })).toHaveLength(0)
  })

  it('sorts Upcoming / Recent / Completed / Cancelled', () => {
    const now = () => Date.parse('2026-06-01T00:00:00Z')
    const service = new TripManagementService()
    const upcoming = service.createTripFromBookings({
      userId: 'u',
      bookings: [flightBooking()],
      departure: '2026-12-01T08:00:00Z',
      generateDocuments: false,
      now,
    })
    const completed = service.createTripFromBookings({
      userId: 'u',
      bookings: [flightBooking({ status: 'ticketed' })],
      departure: '2026-01-01T08:00:00Z',
      generateDocuments: false,
      now: () => now() + 1000,
    })
    service.appendEvent(completed.tripId, 'TripCompleted', {}, null, () => now() + 2000)
    const cancelled = service.createTripFromBookings({
      userId: 'u',
      bookings: [flightBooking({ status: 'cancelled' })],
      departure: '2026-08-01T08:00:00Z',
      generateDocuments: false,
      now: () => now() + 3000,
    })

    const list = service.getTrips('u')
    expect(sortTrips(list, 'Upcoming', now).map((t) => t.tripId)).toContain(upcoming.tripId)
    expect(sortTrips(list, 'Recent', now)[0]?.tripId).toBe(cancelled.tripId)
    expect(sortTrips(list, 'Completed', now).every((t) => t.bookingStatus === 'Completed')).toBe(true)
    expect(sortTrips(list, 'Cancelled', now).map((t) => t.tripId)).toContain(cancelled.tripId)
  })

  it('filters Active / Past / Cancelled / Refunded / Business / Leisure', () => {
    const now = () => Date.parse('2026-06-15T00:00:00Z')
    const service = new TripManagementService()
    service.createTripFromBookings({
      userId: 'u',
      bookings: [flightBooking({ status: 'confirmed' })],
      departure: '2026-12-01T00:00:00Z',
      purpose: 'business',
      generateDocuments: false,
      now,
    })
    service.createTripFromBookings({
      userId: 'u',
      bookings: [flightBooking({ status: 'cancelled' })],
      purpose: 'leisure',
      generateDocuments: false,
      now,
    })
    const refunded = service.createTripFromBookings({
      userId: 'u',
      bookings: [hotelBooking()],
      purpose: 'leisure',
      generateDocuments: false,
      now,
    })
    service.updatePaymentStatus(refunded.tripId, 'refunded', now)
    const past = service.createTripFromBookings({
      userId: 'u',
      bookings: [flightBooking()],
      departure: '2026-01-01T00:00:00Z',
      purpose: 'leisure',
      generateDocuments: false,
      now,
    })
    service.appendEvent(past.tripId, 'TripCompleted', {}, null, now)

    const all = service.getTrips('u')
    expect(filterTrips(all, 'Active', now).length).toBeGreaterThanOrEqual(1)
    expect(filterTrips(all, 'Cancelled', now).length).toBeGreaterThanOrEqual(1)
    expect(filterTrips(all, 'Refunded', now).length).toBeGreaterThanOrEqual(1)
    expect(filterTrips(all, 'Business', now).every((t) => t.purpose === 'business')).toBe(true)
    expect(filterTrips(all, 'Leisure', now).every((t) => t.purpose === 'leisure')).toBe(true)
    expect(filterTrips(all, 'Past', now).some((t) => t.bookingStatus === 'Completed')).toBe(true)
  })

  it('exposes Document Center tickets, vouchers, invoice, receipts, summary', () => {
    const trip = createTripFromBookings({
      userId: 'u',
      bookings: [flightBooking(), hotelBooking()],
      destination: 'Dubai',
      generateDocuments: true,
    })
    const docs = getTripDocuments(trip)
    expect(docs.tickets.length).toBeGreaterThan(0)
    expect(docs.invoice).not.toBeNull()
    expect(docs.receipts.length).toBeGreaterThan(0)
    expect(docs.summary).not.toBeNull()
    // hotel domain → voucher docs
    expect(docs.hotelVouchers.length + docs.all.filter((d) => d.kind === 'eticket').length).toBeGreaterThan(0)
    expect(getTrip(trip.tripId)!.timeline.some((e) => e.type === 'DocumentsGenerated')).toBe(true)
  })

  it('handles edge cases: missing trip, empty bookings, disabled flag', () => {
    expect(getTrip('missing')).toBeNull()
    expect(getTripStatus('missing')).toBeNull()
    expect(mergeTripProviderUpdates('missing', [])).toBeNull()

    const empty = createTripFromBookings({
      userId: 'u',
      bookings: [],
      destination: 'Nowhere',
      generateDocuments: false,
    })
    expect(empty.bookingStatus).toBe('Pending')
    expect(empty.flights).toHaveLength(0)

    getFeatureRegistry().setEnabled('ai.trip_management', false)
    expect(() =>
      createTripFromBookings({
        userId: 'u',
        bookings: [flightBooking()],
        generateDocuments: false,
      }),
    ).toThrow(/trip_management_disabled/)
  })

  it('records payment, check-in, departure, arrival, completion, refund events', () => {
    const service = new TripManagementService()
    const trip = service.createTripFromBookings({
      userId: 'u',
      bookings: [flightBooking()],
      generateDocuments: false,
    })
    service.updatePaymentStatus(trip.tripId, 'paid')
    service.appendEvent(trip.tripId, 'CheckInOpened', { gate: 'A1' }, 'amadeus')
    service.appendEvent(trip.tripId, 'FlightDeparted', { flight: 'SV123' }, 'amadeus')
    service.appendEvent(trip.tripId, 'FlightArrived', { flight: 'SV123' }, 'amadeus')
    service.appendEvent(trip.tripId, 'TripCompleted')
    let current = service.getTrip(trip.tripId)!
    expect(current.bookingStatus).toBe('Completed')
    expect(current.timeline.map((e) => e.type)).toEqual(
      expect.arrayContaining([
        'PaymentCompleted',
        'CheckInOpened',
        'FlightDeparted',
        'FlightArrived',
        'TripCompleted',
      ]),
    )
    service.updatePaymentStatus(trip.tripId, 'refunded')
    current = service.getTrip(trip.tripId)!
    expect(current.bookingStatus).toBe('Refunded')
    expect(current.paymentStatus).toBe('refunded')
  })
})
