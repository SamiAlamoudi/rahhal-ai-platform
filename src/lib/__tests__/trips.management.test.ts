import { describe, it, expect, beforeEach } from 'vitest'
import {
  TripManager,
  TripRepository,
  TripHistory,
  BookingHistory,
  buildTripTimeline,
  aggregateBookingStatus,
  deriveManagedTripStatus,
  maskEmail,
  maskPassport,
  sanitizeAuditMetadata,
  resetTripRepository,
  resetTravelerProfileStore,
  resetSavedTripsStore,
  resetFavoriteDestinationsStore,
  resetRecentSearchesStore,
  resetTripManager,
} from '../trips'
import {
  TicketOrchestrator,
  resetTicketOrchestrator,
  buildConfirmationDocument,
} from '../ticketing'
import {
  NotificationOrchestrator,
  resetNotificationOrchestrator,
  notifyBookingConfirmed,
  notifyPaymentCaptured,
  notifyTicketIssued,
} from '../notifications'
import {
  PaymentOrchestrator,
  createMockPaymentAdapter,
  resetPaymentOrchestrator,
  clearAllOrders,
  clearAllLocks,
  clearCoupons,
} from '../payment'
import {
  getBookingOrchestrator,
  resetBookingOrchestrator,
} from '../booking'
import type { BookingSession } from '../booking/bookingTypes'
import type { RahhalOrder } from '../payment/checkoutTypes'
import type { PaymentSession } from '../payment/paymentTypes'
import type { TravelerInfo } from '../payment/checkoutTypes'

function travelers(): TravelerInfo[] {
  return [{
    id: 't1',
    firstName: 'Ahmed',
    lastName: 'Al-Saud',
    dateOfBirth: null,
    passportNumber: 'A12345678',
    passportExpiry: null,
    nationality: 'SA',
    type: 'adult',
  }]
}

async function paidBookingBundle(): Promise<{
  bookingSession: BookingSession
  order: RahhalOrder
  paymentSession: PaymentSession
  payment: PaymentOrchestrator
  booking: ReturnType<typeof getBookingOrchestrator>
  tickets: TicketOrchestrator
  notifications: NotificationOrchestrator
}> {
  const booking = getBookingOrchestrator()
  const session = booking.createBookingSession({
    userId: 'user-1',
    travelSessionId: 'travel-1',
    currency: 'SAR',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  })
  booking.addBookingItem(session.id, {
    type: 'flight',
    providerId: 'amadeus',
    providerName: 'Mock Air',
    providerOfferId: 'F1',
    title: 'Mock Air: RUH → HND',
    price: 2400,
    currency: 'SAR',
    bookingUrl: 'https://example.com/f',
    expiresAt: null,
    travelerSummary: '1 adult',
    metadata: {
      flightNumber: 'MA200',
      segments: [{
        airline: 'Mock Air',
        flightNumber: 'MA200',
        from: 'RUH',
        to: 'HND',
        departureAt: '2027-04-01T10:00:00.000Z',
        arrivalAt: '2027-04-01T23:00:00.000Z',
        cabin: 'economy',
        baggage: '1 x 23kg',
      }],
    },
  })
  booking.addBookingItem(session.id, {
    type: 'hotel',
    providerId: 'booking_com',
    providerName: 'Booking.com',
    providerOfferId: 'H1',
    title: 'Tokyo Central Inn',
    price: 1800,
    currency: 'SAR',
    bookingUrl: 'https://example.com/h',
    expiresAt: null,
    travelerSummary: '1 adult',
    metadata: {
      hotelName: 'Tokyo Central Inn',
      address: '1-1 Shinjuku, Tokyo',
      area: 'Shinjuku',
      checkIn: '2027-04-01',
      checkOut: '2027-04-05',
      roomType: 'Deluxe Twin',
      rooms: 1,
    },
  })

  const bookingSession = booking.getBookingSession(session.id)!
  const payment = new PaymentOrchestrator({
    adapter: createMockPaymentAdapter(),
    persist: false,
  })
  const started = await payment.startFromBooking({
    bookingSession,
    returnUrl: 'https://app.example/checkout/return',
    travelers: travelers(),
    customerEmail: 'ahmed@example.com',
    customerName: 'Ahmed Al-Saud',
  })
  expect(started.success).toBe(true)
  const captured = await payment.captureTokenizedPayment(
    started.checkoutSession!.order.id,
    started.checkoutSession!.lockToken!,
  )
  expect(captured.success).toBe(true)

  const tickets = new TicketOrchestrator({ bookingOrchestrator: booking })
  const issued = await tickets.startAndIssue({
    bookingSession: booking.getBookingSession(session.id)!,
    order: captured.order!,
    paymentSession: captured.paymentSession!,
  })
  expect(issued.success).toBe(true)

  const notifications = new NotificationOrchestrator()
  await notifyBookingConfirmed(notifications, {
    recipient: {
      userId: 'user-1',
      displayName: 'Ahmed',
      email: 'ahmed@example.com',
      phoneE164: '+966501234567',
      locale: 'en',
    },
    bookingSessionId: bookingSession.id,
    orderId: captured.order!.id,
    bookingReference: issued.session?.bookingReference,
    orderNumber: captured.order!.orderNumber,
    channels: ['email'],
  })
  await notifyPaymentCaptured(notifications, {
    recipient: {
      userId: 'user-1',
      displayName: 'Ahmed',
      email: 'ahmed@example.com',
      locale: 'en',
    },
    paymentSessionId: captured.paymentSession!.id,
    orderId: captured.order!.id,
    orderNumber: captured.order!.orderNumber,
    amount: String(captured.order!.cart.total),
    currency: 'SAR',
    channels: ['email'],
  })
  await notifyTicketIssued(notifications, {
    recipient: {
      userId: 'user-1',
      displayName: 'Ahmed',
      email: 'ahmed@example.com',
      locale: 'en',
    },
    ticketSessionId: issued.session!.id,
    orderId: captured.order!.id,
    confirmationNumber: issued.session!.confirmationNumber,
    orderNumber: captured.order!.orderNumber,
    bookingSessionId: bookingSession.id,
    channels: ['email'],
  })

  return {
    bookingSession: booking.getBookingSession(session.id)!,
    order: captured.order!,
    paymentSession: captured.paymentSession!,
    payment,
    booking,
    tickets,
    notifications,
  }
}

describe('Phase V privacy', () => {
  it('masks personal data and redacts payment secrets', () => {
    expect(maskEmail('ahmed@example.com')).toBe('a***@example.com')
    expect(maskPassport('A12345678')).toMatch(/\*{4}5678/)
    expect(sanitizeAuditMetadata({
      card: '4111',
      secret: 'x',
      email: 'sara@example.com',
      providerId: 'mock',
    })).toMatchObject({
      card: '[redacted]',
      secret: '[redacted]',
      email: 's***@example.com',
      providerId: 'mock',
    })
  })
})

describe('Phase V TripRepository', () => {
  let repo: TripRepository

  beforeEach(() => {
    resetTripRepository()
    repo = new TripRepository()
  })

  it('persists versioned trip records with ownership checks', () => {
    const now = new Date().toISOString()
    const created = repo.create({
      id: 'trip_1',
      userId: 'user-1',
      version: 1,
      status: 'upcoming',
      title: 'Tokyo',
      favorite: false,
      archived: false,
      travelerIds: ['trav_1'],
      links: {
        tripPlanId: null,
        savedTripId: null,
        bookingSessionIds: [],
        orderIds: [],
        paymentSessionIds: [],
        ticketSessionIds: [],
        notificationSessionIds: [],
      },
      summary: {
        destination: 'Tokyo',
        destinations: ['Tokyo'],
        startDate: '2027-04-01',
        endDate: '2027-04-05',
        currency: 'SAR',
        estimatedTotal: 1000,
        travelerCount: 1,
        primaryBookingStatus: null,
        primaryPaymentStatus: null,
        primaryTicketStatus: null,
      },
      itinerarySnapshot: { title: 'Tokyo', destinations: ['Tokyo'], notes: null },
      audit: [],
      createdAt: now,
      updatedAt: now,
      cancelledAt: null,
      archivedAt: null,
    })
    expect(created.version).toBe(1)
    expect(repo.getByIdForUser('trip_1', 'user-2')).toBeNull()

    const updated = repo.update({ ...created, title: 'Tokyo Spring' })
    expect(updated.version).toBe(2)
    expect(repo.listVersions('trip_1', 'user-1')).toHaveLength(2)
    expect(repo.delete('trip_1', 'user-2')).toBe(false)
    expect(repo.delete('trip_1', 'user-1')).toBe(true)
  })

  it('filters by status, destination, search and sorts by date', () => {
    const now = new Date().toISOString()
    const base = {
      favorite: false,
      archived: false,
      travelerIds: ['trav_1'] as string[],
      links: {
        tripPlanId: null,
        savedTripId: null,
        bookingSessionIds: [] as string[],
        orderIds: [] as string[],
        paymentSessionIds: [] as string[],
        ticketSessionIds: [] as string[],
        notificationSessionIds: [] as string[],
      },
      itinerarySnapshot: null,
      audit: [],
      createdAt: now,
      updatedAt: now,
      cancelledAt: null,
      archivedAt: null,
    }
    repo.create({
      ...base,
      id: 'a',
      userId: 'user-1',
      version: 1,
      status: 'upcoming',
      title: 'Tokyo Escape',
      summary: {
        destination: 'Tokyo',
        destinations: ['Tokyo'],
        startDate: '2027-05-01',
        endDate: '2027-05-05',
        currency: 'SAR',
        estimatedTotal: 1,
        travelerCount: 1,
        primaryBookingStatus: null,
        primaryPaymentStatus: null,
        primaryTicketStatus: null,
      },
    })
    repo.create({
      ...base,
      id: 'b',
      userId: 'user-1',
      version: 1,
      status: 'completed',
      title: 'Jeddah Weekend',
      summary: {
        destination: 'Jeddah',
        destinations: ['Jeddah'],
        startDate: '2026-01-01',
        endDate: '2026-01-03',
        currency: 'SAR',
        estimatedTotal: 1,
        travelerCount: 1,
        primaryBookingStatus: null,
        primaryPaymentStatus: null,
        primaryTicketStatus: null,
      },
    })

    expect(repo.list({ userId: 'user-1', status: 'upcoming' })).toHaveLength(1)
    expect(repo.list({ userId: 'user-1', destination: 'jeddah' })[0]?.id).toBe('b')
    expect(repo.list({ userId: 'user-1', search: 'escape' })[0]?.id).toBe('a')
    expect(repo.list({
      userId: 'user-1',
      sortBy: 'startDate',
      sortDirection: 'asc',
    }).map((t) => t.id)).toEqual(['b', 'a'])
  })
})

describe('Phase V TripManager', () => {
  let manager: TripManager

  beforeEach(() => {
    clearAllOrders()
    clearAllLocks()
    clearCoupons()
    resetPaymentOrchestrator()
    resetBookingOrchestrator()
    resetTicketOrchestrator()
    resetNotificationOrchestrator()
    resetTripRepository()
    resetTravelerProfileStore()
    resetSavedTripsStore()
    resetFavoriteDestinationsStore()
    resetRecentSearchesStore()
    resetTripManager()
  })

  it('lists upcoming/past/cancelled, archives, favorites, search and filters', async () => {
    const bundle = await paidBookingBundle()
    manager = new TripManager({
      bookingOrchestrator: bundle.booking,
      paymentOrchestrator: bundle.payment,
      ticketOrchestrator: bundle.tickets,
      notificationOrchestrator: bundle.notifications,
    })

    const traveler = manager.upsertTraveler({
      userId: 'user-1',
      firstName: 'Ahmed',
      lastName: 'Al-Saud',
      passportNumber: 'A12345678',
      email: 'ahmed@example.com',
      phone: '+966501234567',
    })
    expect(traveler.passportMasked).toMatch(/5678/)
    expect(traveler.emailMasked).toBe('a***@example.com')

    const trip = manager.createTrip({
      userId: 'user-1',
      title: 'Tokyo Spring',
      destination: 'Tokyo',
      startDate: '2027-04-01',
      endDate: '2027-04-05',
      travelerIds: [traveler.id],
      bookingSessionId: bundle.bookingSession.id,
      orderId: bundle.order.id,
      paymentSessionId: bundle.paymentSession.id,
      ticketSessionId: bundle.tickets.listSessions()[0]!.id,
      status: 'upcoming',
    })

    expect(manager.listAllUserTrips('user-1')).toHaveLength(1)
    expect(manager.upcomingTrips('user-1').map((t) => t.id)).toContain(trip.id)
    expect(manager.searchTrips('user-1', 'tokyo')[0]?.id).toBe(trip.id)
    expect(manager.filterByDestination('user-1', 'Tokyo')).toHaveLength(1)
    expect(manager.filterByTraveler('user-1', 'Ahmed')).toHaveLength(1)
    expect(manager.filterByStatus('user-1', 'upcoming')).toHaveLength(1)
    expect(manager.sortTrips('user-1', 'destination', 'asc')[0]?.summary.destination).toBe('Tokyo')

    const favorited = manager.favoriteTrip(trip.id, 'user-1', true)
    expect(favorited.favorite).toBe(true)

    const archived = manager.archiveTrip(trip.id, 'user-1')
    expect(archived.status).toBe('archived')
    expect(manager.listTrips({ userId: 'user-1', includeArchived: false })).toHaveLength(0)

    const past = manager.createTrip({
      userId: 'user-1',
      title: 'Old Riyadh',
      destination: 'Riyadh',
      startDate: '2020-01-01',
      endDate: '2020-01-05',
      status: 'completed',
    })
    expect(manager.pastTrips('user-1').map((t) => t.id)).toContain(past.id)

    const toCancel = manager.createTrip({
      userId: 'user-1',
      title: 'Cancel me',
      destination: 'Jeddah',
      bookingSessionId: bundle.bookingSession.id,
      status: 'upcoming',
    })
    const cancelled = manager.cancelBooking(toCancel.id, 'user-1', 'changed plans')
    expect(cancelled.status).toBe('cancelled')
    expect(manager.cancelledTrips('user-1').map((t) => t.id)).toContain(toCancel.id)
  })

  it('duplicates itinerary, rebooks, and blocks cross-user access', async () => {
    manager = new TripManager()
    const trip = manager.createTrip({
      userId: 'user-1',
      title: 'Paris',
      destination: 'Paris',
      destinations: ['Paris', 'Lyon'],
      itinerarySnapshot: {
        title: 'Paris',
        destinations: ['Paris', 'Lyon'],
        notes: 'Museum day',
      },
    })

    const dup = manager.duplicateItinerary(trip.id, 'user-1')
    expect(dup.id).not.toBe(trip.id)
    expect(dup.title).toContain('copy')
    expect(dup.links.bookingSessionIds).toEqual([])
    expect(dup.itinerarySnapshot?.notes).toBe('Museum day')

    const rebooked = manager.rebook(trip.id, 'user-1')
    expect(rebooked.title).toContain('rebook')
    expect(rebooked.status).toBe('draft')
    expect(rebooked.audit.some((a) => a.type === 'trip.rebooked_from')).toBe(true)

    expect(() => manager.getTrip(trip.id, 'user-2')).not.toThrow()
    expect(manager.getTrip(trip.id, 'user-2')).toBeNull()
    expect(() => manager.cancelBooking(trip.id, 'user-2')).toThrow(/ownership/i)
  })

  it('aggregates booking details, payments, tickets, vouchers, notifications, timeline, docs', async () => {
    const bundle = await paidBookingBundle()
    const ticketSession = bundle.tickets.listSessions()[0]!
    manager = new TripManager({
      bookingOrchestrator: bundle.booking,
      paymentOrchestrator: bundle.payment,
      ticketOrchestrator: bundle.tickets,
      notificationOrchestrator: bundle.notifications,
    })

    const trip = manager.createTrip({
      userId: 'user-1',
      title: 'Tokyo Spring',
      destination: 'Tokyo',
      startDate: '2027-04-01',
      endDate: '2027-04-05',
      bookingSessionId: bundle.bookingSession.id,
      orderId: bundle.order.id,
      paymentSessionId: bundle.paymentSession.id,
      ticketSessionId: ticketSession.id,
    })

    const bookings = manager.getBookingDetails(trip.id, 'user-1')
    expect(bookings[0]?.itemCount).toBe(2)
    expect(bookings[0]?.itemTitles.join(' ')).toMatch(/Mock Air|Tokyo Central/)

    const payments = manager.getPaymentHistory(trip.id, 'user-1')
    expect(payments[0]?.status).toMatch(/paid|confirmed/)
    expect(payments[0]?.customerEmailMasked).toBe('a***@example.com')
    expect(JSON.stringify(payments)).not.toMatch(/A12345678/)

    const tickets = manager.getIssuedTickets(trip.id, 'user-1')
    expect(tickets[0]?.flightTitles.length).toBeGreaterThan(0)
    const vouchers = manager.getHotelVouchers(trip.id, 'user-1')
    expect(vouchers.length).toBeGreaterThan(0)
    expect(vouchers[0]?.hotelConfirmationNumber || vouchers[0]?.title).toBeTruthy()

    const notifs = manager.getNotificationHistory(trip.id, 'user-1')
    expect(notifs.length).toBeGreaterThanOrEqual(1)
    expect(notifs.some((n) => n.eventType === 'ticket_issued' || n.eventType === 'booking_confirmed')).toBe(true)

    const timeline = manager.getTimeline(trip.id, 'user-1')
    const sources = new Set(timeline.map((e) => e.source))
    expect(sources.has('trip')).toBe(true)
    expect(sources.has('booking') || sources.has('payment')).toBe(true)
    expect(sources.has('ticketing') || sources.has('notification')).toBe(true)
    for (let i = 1; i < timeline.length; i += 1) {
      expect(timeline[i].at >= timeline[i - 1].at).toBe(true)
    }

    const doc = manager.downloadConfirmation(trip.id, 'user-1')
    expect(doc?.confirmationNumber).toBeTruthy()
    expect(doc?.id).toBe(buildConfirmationDocument(ticketSession).id)

    const status = manager.getAggregatedStatus(trip.id, 'user-1')
    expect(status.paid).toBe(true)
    expect(status.ticketed).toBe(true)

    const saved = manager.saveTrip('user-1', trip.id)
    expect(manager.listSavedTrips('user-1')[0]?.id).toBe(saved.id)
    manager.addFavoriteDestination('user-1', 'Tokyo')
    expect(manager.listFavoriteDestinations('user-1')[0]?.destination).toBe('Tokyo')
    manager.recordSearch('user-1', 'flights to tokyo', 'Tokyo')
    expect(manager.listRecentSearches('user-1')[0]?.query).toMatch(/tokyo/i)

    expect(manager.listVersions(trip.id, 'user-1').length).toBeGreaterThanOrEqual(1)
    expect(manager.activeBookings('user-1').length).toBeGreaterThanOrEqual(0)
  })
})

describe('Phase V timeline + aggregator helpers', () => {
  it('derives trip status and aggregates booking state', () => {
    expect(deriveManagedTripStatus({
      archived: false,
      cancelled: false,
      startDate: '2027-01-01',
      endDate: '2027-01-10',
      paid: true,
      bookingStatus: 'confirmed',
    })).toBe('upcoming')

    expect(deriveManagedTripStatus({
      archived: false,
      cancelled: false,
      startDate: '2020-01-01',
      endDate: '2020-01-10',
      paid: true,
      bookingStatus: 'confirmed',
    })).toBe('completed')

    const aggregated = aggregateBookingStatus({
      trip: {
        id: 't',
        userId: 'u',
        version: 1,
        status: 'upcoming',
        title: 'X',
        favorite: false,
        archived: false,
        travelerIds: [],
        links: {
          tripPlanId: null,
          savedTripId: null,
          bookingSessionIds: ['b1'],
          orderIds: ['o1'],
          paymentSessionIds: ['p1'],
          ticketSessionIds: ['tk1'],
          notificationSessionIds: [],
        },
        summary: {
          destination: 'Tokyo',
          destinations: ['Tokyo'],
          startDate: '2027-04-01',
          endDate: '2027-04-05',
          currency: 'SAR',
          estimatedTotal: 1,
          travelerCount: 0,
          primaryBookingStatus: 'confirmed',
          primaryPaymentStatus: 'paid',
          primaryTicketStatus: 'delivered',
        },
        itinerarySnapshot: null,
        audit: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        cancelledAt: null,
        archivedAt: null,
      },
      booking: null,
      order: null,
      payment: null,
      ticket: null,
    })
    expect(aggregated.paid).toBe(true)
    expect(aggregated.ticketed).toBe(true)
    expect(aggregated.active).toBe(true)
  })

  it('builds chronological timeline from trip audit alone', () => {
    const now = new Date().toISOString()
    const timeline = buildTripTimeline({
      trip: {
        id: 'trip_x',
        userId: 'user-1',
        version: 1,
        status: 'draft',
        title: 'Solo',
        favorite: false,
        archived: false,
        travelerIds: [],
        links: {
          tripPlanId: null,
          savedTripId: null,
          bookingSessionIds: [],
          orderIds: [],
          paymentSessionIds: [],
          ticketSessionIds: [],
          notificationSessionIds: [],
        },
        summary: {
          destination: 'Doha',
          destinations: ['Doha'],
          startDate: null,
          endDate: null,
          currency: 'SAR',
          estimatedTotal: null,
          travelerCount: 0,
          primaryBookingStatus: null,
          primaryPaymentStatus: null,
          primaryTicketStatus: null,
        },
        itinerarySnapshot: null,
        audit: [{
          id: 'a1',
          at: now,
          type: 'trip.created',
          message: 'created',
          fromStatus: null,
          toStatus: 'draft',
          actorUserId: 'user-1',
          metadata: { email: 'hidden@example.com' },
        }],
        createdAt: now,
        updatedAt: now,
        cancelledAt: null,
        archivedAt: null,
      },
    })
    expect(timeline).toHaveLength(1)
    expect(timeline[0].metadata.email).toBe('h***@example.com')
  })

  it('TripHistory partitions buckets', () => {
    const history = new TripHistory()
    const bookingHistory = new BookingHistory()
    expect(bookingHistory.listBookings([])).toEqual([])
    const buckets = history.partition([{
      id: '1',
      userId: 'u',
      version: 1,
      status: 'upcoming',
      title: 'A',
      favorite: false,
      archived: false,
      travelerIds: [],
      links: {
        tripPlanId: null,
        savedTripId: null,
        bookingSessionIds: [],
        orderIds: [],
        paymentSessionIds: [],
        ticketSessionIds: [],
        notificationSessionIds: [],
      },
      summary: {
        destination: 'A',
        destinations: ['A'],
        startDate: null,
        endDate: null,
        currency: 'SAR',
        estimatedTotal: null,
        travelerCount: 0,
        primaryBookingStatus: 'confirmed',
        primaryPaymentStatus: null,
        primaryTicketStatus: null,
      },
      itinerarySnapshot: null,
      audit: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cancelledAt: null,
      archivedAt: null,
    }])
    expect(buckets.upcoming).toHaveLength(1)
    expect(buckets.activeBookings).toHaveLength(1)
  })
})
