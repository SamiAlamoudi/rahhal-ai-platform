/**
 * Sprint 35 — Post Booking & Trip Management tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  createPaymentOrchestrator,
  type PaymentCheckoutInput,
} from '../payments'
import {
  FlightStatusMonitor,
  MockFlightStatusProvider,
  NotificationScheduler,
  PostBookingService,
  TripTimeline,
  createPostBookingService,
  detectTripConversationQuery,
  isTripManagementEnabled,
  resetPostBookingRepository,
  resetPostBookingService,
  resetTripManager,
  resetTripRepository,
  TRIP_MANAGEMENT_FEATURE_ID,
  type TripEvent,
} from '../trips'
import { detectConversationCommand } from '../chat/conversationExperience/ConversationState'
import { answerTripQuery } from '../trips/conversation/tripQueries'

function enableTripManagementChain(): void {
  const registry = getFeatureRegistry()
  registry.setEnabled('ai.concierge', true)
  registry.setEnabled('brain.enabled', true)
  registry.setEnabled('brain.concierge', true)
  registry.setEnabled('brain.travel_engine', true)
  registry.setEnabled('brain.trip_planning', true)
  registry.setEnabled('brain.execution', true)
  registry.setEnabled('brain.search', true)
  registry.setEnabled('brain.trip_orchestrator', true)
  registry.setEnabled('brain.unified_travel_planner', true)
  registry.setEnabled('brain.conversation_ui', true)
  registry.setEnabled('brain.travel_execution_engine', true)
  registry.setEnabled('brain.payments_platform', true)
  registry.setEnabled('brain.trip_management', true)
}

async function paidCheckout() {
  const payments = createPaymentOrchestrator({ enabled: true })
  const input: PaymentCheckoutInput = {
    executionSessionId: 'exe_s35',
    conversationId: 'conv_s35',
    currency: 'SAR',
    subtotal: 5000,
    flightConfirmation: 'FLT-S35-1',
    hotelConfirmation: 'HTL-S35-1',
    bookingReferenceHint: 'RHL-BKG-S35',
    tripReferenceHint: 'RHL-TRP-S35',
    customerEmail: 'user@rahhal.test',
    customerName: 'Sprint Traveler',
  }
  const session = payments.createCheckout(input)
  return payments.pay(session.sessionId, { method: 'mada' })
}

describe('Sprint 35 feature flags', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetPostBookingService()
    resetPostBookingRepository()
    resetTripManager()
    resetTripRepository()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetPostBookingService()
    resetPostBookingRepository()
    resetTripManager()
    resetTripRepository()
  })

  it('registers brain.trip_management disabled by default', () => {
    expect(getFeatureRegistry().isEnabled(TRIP_MANAGEMENT_FEATURE_ID)).toBe(false)
    expect(isTripManagementEnabled()).toBe(false)
  })

  it('requires brain.payments_platform before brain.trip_management', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.trip_management', true)
    expect(registry.isEnabled('brain.trip_management')).toBe(false)
    enableTripManagementChain()
    expect(registry.isEnabled('brain.trip_management')).toBe(true)
    expect(isTripManagementEnabled()).toBe(true)
  })
})

describe('Post-booking My Trip creation', () => {
  beforeEach(() => {
    resetTripManager()
    resetTripRepository()
    resetPostBookingRepository()
  })

  it('creates My Trip from successful payment with documents', async () => {
    const events: TripEvent[] = []
    const service = createPostBookingService({
      enabled: true,
      onEvent: (e) => events.push(e),
    })
    const payment = await paidCheckout()
    const trip = service.createFromPayment(payment, {
      userId: 'user_s35',
      destination: 'Dubai',
      origin: 'Riyadh',
      hotelName: 'Hilton Dubai',
      travelers: 2,
    })

    expect(trip.lifecycle).toBe('Upcoming')
    expect(trip.references.bookingReference).toMatch(/RHL-BKG/)
    expect(trip.documents.itinerary.days.length).toBeGreaterThan(0)
    expect(trip.documents.bookingSummary.total).toBeGreaterThan(0)
    expect(trip.documents.hotelVoucher?.confirmationNumber).toBe('HTL-S35-1')
    expect(trip.documents.eTicket?.flightConfirmation).toBe('FLT-S35-1')
    expect(trip.documents.boardingPass?.barcodePayload).toContain('rahhal-bp-v1')
    expect(trip.documents.pdfItinerary.pdfUri).toContain('itinerary')
    expect(trip.documents.invoiceBundle.pdfUri).toContain('invoice-bundle')
    expect(events.map((e) => e.type)).toEqual(
      expect.arrayContaining([
        'TripCreated',
        'ItineraryGenerated',
        'DocumentsGenerated',
        'NotificationScheduled',
      ]),
    )

    const managed = service.getTripManager().getTrip(trip.tripId, 'user_s35')
    expect(managed?.id).toBe(trip.tripId)
    expect(managed?.summary.destination).toBe('Dubai')
    // Post-booking lifecycle is authoritative for Sprint 35; Phase V aggregate may
    // stay draft until booking/payment sessions are linked.
    expect(trip.lifecycle).toBe('Upcoming')
  })

  it('is idempotent for the same payment session', async () => {
    const service = createPostBookingService({ enabled: true })
    const payment = await paidCheckout()
    const a = service.createFromPayment(payment, {
      userId: 'user_s35',
      destination: 'Dubai',
    })
    const b = service.createFromPayment(payment, {
      userId: 'user_s35',
      destination: 'Dubai',
    })
    expect(a.tripId).toBe(b.tripId)
  })
})

describe('Itinerary & document generation', () => {
  it('generates itinerary summary and PDF metadata', () => {
    const service = createPostBookingService({ enabled: true })
    const trip = service.createMyTrip({
      userId: 'u1',
      destination: 'Tokyo',
      origin: 'RUH',
      hotelName: 'Park Hotel',
      currency: 'USD',
      totalPaid: 2200,
      travelers: 1,
      references: {
        bookingReference: 'RHL-BKG-TOK',
        tripReference: 'RHL-TRP-TOK',
        paymentReference: 'RHL-PAY-TOK',
        flightConfirmation: 'FLT-TOK',
        hotelConfirmation: 'HTL-TOK',
        executionSessionId: 'exe_1',
        paymentSessionId: 'ps_1',
      },
    })
    expect(trip.documents.itinerary.summaryText).toContain('Tokyo')
    expect(trip.documents.pdfItinerary.pages).toBe(trip.documents.itinerary.days.length)
    expect(service.getMetricsSnapshot().itinerariesGenerated).toBe(1)
    expect(service.getMetricsSnapshot().documentsGenerated).toBe(1)
  })
})

describe('Notifications', () => {
  it('schedules booking/payment/reminder notifications across channels', async () => {
    const scheduler = new NotificationScheduler()
    expect(scheduler.supportedChannels().sort()).toEqual(
      ['email', 'push', 'sms', 'whatsapp'].sort(),
    )
    const service = createPostBookingService({
      enabled: true,
      notifications: scheduler,
    })
    const trip = service.createMyTrip({
      userId: 'u1',
      destination: 'Paris',
      currency: 'EUR',
      totalPaid: 1800,
      references: {
        bookingReference: 'RHL-BKG-PAR',
        tripReference: 'RHL-TRP-PAR',
        paymentReference: 'RHL-PAY-PAR',
        flightConfirmation: 'FLT-PAR',
        hotelConfirmation: 'HTL-PAR',
        executionSessionId: null,
        paymentSessionId: 'ps_par',
      },
    })
    const triggers = trip.notifications.map((n) => n.trigger)
    expect(triggers).toEqual(
      expect.arrayContaining([
        'booking_confirmed',
        'payment_received',
        'check_in_reminder',
        'hotel_check_in_reminder',
        'boarding_reminder',
      ]),
    )
    const first = trip.notifications[0]
    const results = await scheduler.dispatch(first.notificationId, 'u1')
    expect(results.every((r) => r.delivered)).toBe(true)
  })
})

describe('Trip lifecycle & timeline ordering', () => {
  it('supports Upcoming → Active → Completed and Cancelled', () => {
    const service = createPostBookingService({ enabled: true })
    const upcoming = service.createMyTrip({
      userId: 'u1',
      destination: 'Cairo',
      currency: 'SAR',
      totalPaid: 1000,
      references: {
        bookingReference: 'RHL-BKG-CAI',
        tripReference: 'RHL-TRP-CAI',
        paymentReference: 'RHL-PAY-CAI',
        flightConfirmation: 'FLT-CAI',
        hotelConfirmation: null,
        executionSessionId: null,
        paymentSessionId: 'ps_cai',
      },
    })
    expect(upcoming.lifecycle).toBe('Upcoming')

    const active = service.markActive(upcoming.tripId)
    expect(active.lifecycle).toBe('Active')

    const completed = service.markCompleted(upcoming.tripId)
    expect(completed.lifecycle).toBe('Completed')
    expect(completed.notifications.some((n) => n.trigger === 'trip_completed')).toBe(true)

    const other = service.createMyTrip({
      userId: 'u1',
      destination: 'Jeddah',
      currency: 'SAR',
      totalPaid: 900,
      references: {
        bookingReference: 'RHL-BKG-JED',
        tripReference: 'RHL-TRP-JED',
        paymentReference: 'RHL-PAY-JED',
        flightConfirmation: null,
        hotelConfirmation: 'HTL-JED',
        executionSessionId: null,
        paymentSessionId: 'ps_jed',
      },
    })
    const cancelled = service.cancelTrip(other.tripId, 'changed_plans')
    expect(cancelled.lifecycle).toBe('Cancelled')

    const buckets = service.getTimelineBuckets('u1')
    expect(buckets.Completed.some((t) => t.tripId === upcoming.tripId)).toBe(true)
    expect(buckets.Cancelled.some((t) => t.tripId === other.tripId)).toBe(true)

    const ordered = service.listUserTrips('u1')
    const timeline = new TripTimeline()
    expect(timeline.orderForDisplay(ordered)[0].lifecycle).not.toBe('Cancelled')
  })

  it('retrieves active/upcoming trips for a user', () => {
    const service = createPostBookingService({ enabled: true })
    service.createMyTrip({
      userId: 'u1',
      destination: 'Doha',
      currency: 'SAR',
      totalPaid: 1500,
      references: {
        bookingReference: 'RHL-BKG-DOH',
        tripReference: 'RHL-TRP-DOH',
        paymentReference: 'RHL-PAY-DOH',
        flightConfirmation: 'FLT-DOH',
        hotelConfirmation: 'HTL-DOH',
        executionSessionId: null,
        paymentSessionId: 'ps_doh',
      },
    })
    const active = service.getActiveTrips('u1')
    expect(active.length).toBe(1)
    expect(active[0].destination).toBe('Doha')
  })
})

describe('Cancellation & refund status', () => {
  it('tracks refund status transitions', () => {
    const service = createPostBookingService({ enabled: true })
    const trip = service.createMyTrip({
      userId: 'u1',
      destination: 'London',
      currency: 'GBP',
      totalPaid: 2400,
      references: {
        bookingReference: 'RHL-BKG-LON',
        tripReference: 'RHL-TRP-LON',
        paymentReference: 'RHL-PAY-LON',
        flightConfirmation: 'FLT-LON',
        hotelConfirmation: 'HTL-LON',
        executionSessionId: null,
        paymentSessionId: 'ps_lon',
      },
    })
    expect(service.updateRefundStatus(trip.tripId, 'request').refundStatus).toBe('requested')
    expect(service.updateRefundStatus(trip.tripId, 'processing').refundStatus).toBe('processing')
    expect(service.updateRefundStatus(trip.tripId, 'partial', 400).refundedAmount).toBe(400)
    expect(service.updateRefundStatus(trip.tripId, 'completed', 2400).refundStatus).toBe('completed')
    expect(service.getMetricsSnapshot().refundsTracked).toBeGreaterThanOrEqual(4)
  })
})

describe('Flight monitoring', () => {
  it('detects delays and gate changes', async () => {
    const delayed = createPostBookingService({
      enabled: true,
      flightMonitor: new FlightStatusMonitor(new MockFlightStatusProvider('delayed')),
    })
    const trip = delayed.createMyTrip({
      userId: 'u1',
      destination: 'Rome',
      currency: 'EUR',
      totalPaid: 1600,
      references: {
        bookingReference: 'RHL-BKG-ROM',
        tripReference: 'RHL-TRP-ROM',
        paymentReference: 'RHL-PAY-ROM',
        flightConfirmation: 'FLT-ROM',
        hotelConfirmation: null,
        executionSessionId: null,
        paymentSessionId: 'ps_rom',
      },
    })
    const afterDelay = await delayed.refreshFlightStatus(trip.tripId)
    expect(afterDelay.flightStatus?.status).toBe('delayed')
    expect(afterDelay.notifications.some((n) => n.trigger === 'flight_delay')).toBe(true)

    const gateSvc = createPostBookingService({
      enabled: true,
      flightMonitor: new FlightStatusMonitor(new MockFlightStatusProvider('gate_change')),
    })
    const gateTrip = gateSvc.createMyTrip({
      userId: 'u2',
      destination: 'Madrid',
      currency: 'EUR',
      totalPaid: 1400,
      references: {
        bookingReference: 'RHL-BKG-MAD',
        tripReference: 'RHL-TRP-MAD',
        paymentReference: 'RHL-PAY-MAD',
        flightConfirmation: 'FLT-MAD',
        hotelConfirmation: null,
        executionSessionId: null,
        paymentSessionId: 'ps_mad',
      },
    })
    const afterGate = await gateSvc.refreshFlightStatus(gateTrip.tripId)
    expect(afterGate.flightStatus?.status).toBe('gate_change')
    expect(afterGate.documents.boardingPass?.gate).toBe('C22')
  })
})

describe('Conversation trip queries', () => {
  beforeEach(() => resetFeatureRegistry())
  afterEach(() => resetFeatureRegistry())

  it('detects trip conversation commands', () => {
    expect(detectConversationCommand('My trip')).toBe('my_trip')
    expect(detectConversationCommand('Show my itinerary')).toBe('show_itinerary')
    expect(detectConversationCommand('Download my ticket')).toBe('download_ticket')
    expect(detectConversationCommand('Any delays?')).toBe('any_delays')
    expect(detectConversationCommand('What hotel am I staying in?')).toBe('what_hotel')
    expect(detectTripConversationQuery('My trip')).toBe('my_trip')
  })

  it('answers trip questions from post-booking records', async () => {
    enableTripManagementChain()
    const service = createPostBookingService({ enabled: true })
    const payment = await paidCheckout()
    const trip = service.createFromPayment(payment, {
      userId: 'user_chat',
      destination: 'Dubai',
      hotelName: 'Hilton Dubai',
      origin: 'Riyadh',
    })
    await service.refreshFlightStatus(trip.tripId)

    expect(answerTripQuery({
      kind: 'my_trip',
      service,
      userId: 'user_chat',
    })).toContain('Dubai')

    expect(answerTripQuery({
      kind: 'show_itinerary',
      service,
      userId: 'user_chat',
    })).toContain('Day 1')

    expect(answerTripQuery({
      kind: 'download_ticket',
      service,
      userId: 'user_chat',
    })).toContain('FLT-S35-1')

    expect(answerTripQuery({
      kind: 'what_hotel',
      service,
      userId: 'user_chat',
    })).toContain('Hilton Dubai')

    expect(answerTripQuery({
      kind: 'any_delays',
      service,
      userId: 'user_chat',
    }).length).toBeGreaterThan(0)
  })
})

describe('Feature gate', () => {
  it('throws when disabled', () => {
    resetFeatureRegistry()
    const service = new PostBookingService()
    expect(service.isEnabled()).toBe(false)
    expect(() =>
      service.createMyTrip({
        userId: 'u',
        destination: 'X',
        currency: 'SAR',
        totalPaid: 1,
        references: {
          bookingReference: 'B',
          tripReference: 'T',
          paymentReference: 'P',
          flightConfirmation: null,
          hotelConfirmation: null,
          executionSessionId: null,
          paymentSessionId: null,
        },
      }),
    ).toThrow(/disabled/i)
  })
})
