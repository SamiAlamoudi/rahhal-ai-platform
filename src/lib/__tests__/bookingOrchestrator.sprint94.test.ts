/**
 * Sprint 94 — Live Booking Orchestrator tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  canTransition,
  composeUnifiedTrip,
  createBookingPlan,
  createBookingSession,
  deserializeBookingSession,
  deriveStateFromReservations,
  executeBookingStep,
  runBookingOrchestrator,
  serializeBookingSession,
  toBookableTrip,
  validateBooking,
  SPRINT94_BOOKING_ORCHESTRATOR_VERSION,
  type BookableTrip,
} from '../../core'
import {
  isBookingOrchestratorEnabled,
  runLiveBookingOrchestrator,
  BOOKING_ORCHESTRATOR_FEATURE_ID,
} from '../agent/bookingOrchestrator'

function sampleTrip(overrides: Partial<BookableTrip> = {}): BookableTrip {
  return {
    id: 'trip_94',
    destination: 'Dubai',
    origin: 'Riyadh',
    currency: 'SAR',
    valid: true,
    dates: { start: '2026-08-15', end: '2026-08-20' },
    travelers: { adults: 2, children: 0, total: 2 },
    flights: [{
      id: 'flt_1',
      airline: 'Saudia',
      origin: 'RUH',
      destination: 'DXB',
      departureAt: '2026-08-15T08:00:00.000Z',
      arrivalAt: '2026-08-15T11:00:00.000Z',
      price: 1200,
      currency: 'SAR',
      providerId: 'amadeus',
      confidence: 0.9,
    }],
    hotel: {
      id: 'htl_1',
      name: 'City Hotel',
      checkIn: '2026-08-15',
      checkOut: '2026-08-20',
      price: 1800,
      currency: 'SAR',
      providerId: 'placeholder',
    },
    transfers: [{
      id: 'xfer_1',
      title: 'Airport transfer',
      price: 120,
      currency: 'SAR',
      providerId: 'placeholder',
    }],
    insurance: {
      id: 'ins_1',
      title: 'Travel insurance',
      price: 80,
      currency: 'SAR',
      providerId: 'placeholder',
    },
    pricingSummary: {
      total: 3200,
      currency: 'SAR',
      flightCost: 1200,
      hotelCost: 1800,
    },
    ...overrides,
  }
}

const travelers = [
  { firstName: 'Sara', lastName: 'Alami', email: 'sara@example.com', type: 'adult' as const },
  { firstName: 'Omar', lastName: 'Alami', type: 'adult' as const },
]

describe('Sprint 94 — Live Booking Orchestrator', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('registers booking.orchestrator enabled by default', () => {
    expect(getFeatureRegistry().isEnabled('booking.orchestrator')).toBe(true)
    expect(isBookingOrchestratorEnabled()).toBe(true)
    expect(BOOKING_ORCHESTRATOR_FEATURE_ID).toBe('booking.orchestrator')
    expect(SPRINT94_BOOKING_ORCHESTRATOR_VERSION).toMatch(/booking-orchestrator/)
  })

  describe('states', () => {
    it('allows valid transitions and derives states from reservations', () => {
      expect(canTransition('Pending', 'Started')).toBe(true)
      expect(canTransition('Started', 'Completed')).toBe(false)
      expect(canTransition('Confirmed', 'Completed')).toBe(true)

      expect(deriveStateFromReservations({
        reservations: [{ status: 'reserved', placeholder: false }],
        started: true,
        retrying: false,
        cancelled: false,
        expired: false,
      })).toBe('Confirmed')

      expect(deriveStateFromReservations({
        reservations: [
          { status: 'reserved', placeholder: false },
          { status: 'failed', placeholder: false },
        ],
        started: true,
        retrying: false,
        cancelled: false,
        expired: false,
      })).toBe('PartiallyConfirmed')
    })
  })

  describe('session / plan / serialization', () => {
    it('creates plan + session and round-trips serialization', () => {
      const plan = createBookingPlan({ trip: sampleTrip(), providerId: 'amadeus' })
      expect(plan.steps.some((s) => s.kind === 'flight' && !s.placeholder)).toBe(true)
      expect(plan.steps.some((s) => s.kind === 'hotel' && s.placeholder)).toBe(true)
      expect(plan.steps.some((s) => s.kind === 'transfer' && s.placeholder)).toBe(true)
      expect(plan.steps.some((s) => s.kind === 'insurance' && s.placeholder)).toBe(true)

      const session = createBookingSession({
        sessionId: 'sess_1',
        tripId: 'trip_94',
        provider: 'amadeus',
        plan,
        travelers,
        quotedTotal: 3200,
        currency: 'SAR',
      })
      expect(session.state).toBe('Pending')
      expect(session.rollback.required).toBe(false)

      const round = deserializeBookingSession(serializeBookingSession(session))
      expect(round.sessionId).toBe('sess_1')
      expect(round.plan.steps.length).toBe(plan.steps.length)
    })
  })

  describe('validation', () => {
    it('checks price, currency, travelers, timeout, provider health', () => {
      const ok = validateBooking({
        trip: sampleTrip(),
        travelers,
        quotedTotal: 3200,
        currentTotal: 3200,
        currency: 'SAR',
        now: Date.now(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        providerHealthy: true,
      })
      expect(ok.ok).toBe(true)

      const price = validateBooking({
        trip: sampleTrip(),
        travelers,
        quotedTotal: 3200,
        currentTotal: 3500,
        currency: 'SAR',
        now: Date.now(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        providerHealthy: true,
      })
      expect(price.errors).toContain('price unchanged check failed')

      const timeout = validateBooking({
        trip: sampleTrip(),
        travelers,
        quotedTotal: 3200,
        currentTotal: 3200,
        currency: 'SAR',
        now: Date.now(),
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
        providerHealthy: true,
      })
      expect(timeout.errors).toContain('Booking timeout')

      const health = validateBooking({
        trip: sampleTrip(),
        travelers,
        quotedTotal: 3200,
        currentTotal: 3200,
        currency: 'SAR',
        now: Date.now(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        providerHealthy: false,
      })
      expect(health.errors).toContain('Provider unhealthy')
    })
  })

  describe('executor / recovery', () => {
    it('reserves flights and placeholders for hotel/transfer/insurance', async () => {
      const plan = createBookingPlan({ trip: sampleTrip() })
      const flightStep = plan.steps.find((s) => s.kind === 'flight')!
      const hotelStep = plan.steps.find((s) => s.kind === 'hotel')!

      const flight = await executeBookingStep(flightStep, { providerId: 'amadeus' })
      expect(flight.status).toBe('reserved')
      expect(flight.confirmationCode).toMatch(/^FLT-/)

      const hotel = await executeBookingStep(hotelStep, { providerId: 'placeholder' })
      expect(hotel.status).toBe('placeholder')
      expect(hotel.placeholder).toBe(true)
    })
  })

  describe('reservation flow / audit', () => {
    it('runs end-to-end booking orchestration to Completed with audit trail', async () => {
      const result = await runBookingOrchestrator({
        trip: sampleTrip(),
        travelers,
        quotedTotal: 3200,
        currentTotal: 3200,
        providerId: 'amadeus',
      })

      expect(result.session.state).toBe('Completed')
      expect(result.summary.paymentRequired).toBe(true)
      expect(result.summary.reservationIds.length).toBeGreaterThan(0)
      expect(result.session.reservations.some((r) => r.kind === 'flight' && r.status === 'reserved')).toBe(true)
      expect(result.session.reservations.some((r) => r.kind === 'hotel' && r.placeholder)).toBe(true)

      const names = result.audit.map((e) => e.name)
      expect(names).toContain('booking.session.created')
      expect(names).toContain('booking.validated')
      expect(names).toContain('booking.started')
      expect(names).toContain('booking.completed')
      expect(JSON.stringify(result.audit)).not.toMatch(/password|secret|token/i)
    })

    it('cancels and rolls back when flight reservation fails', async () => {
      const result = await runBookingOrchestrator({
        trip: sampleTrip(),
        travelers,
        quotedTotal: 3200,
        currentTotal: 3200,
        failFlight: true,
        maxRetries: 2,
      })
      expect(result.session.state).toBe('Cancelled')
      expect(result.session.rollback.required).toBe(true)
      expect(result.session.rollback.completed).toBe(true)
      expect(result.audit.some((e) => e.name === 'booking.rollback')).toBe(true)
    })

    it('agent bridge respects feature flag', async () => {
      const on = await runLiveBookingOrchestrator({
        trip: sampleTrip(),
        travelers,
      })
      expect(on.enabled).toBe(true)
      expect(on.meta?.sessionId).toBeTruthy()

      getFeatureRegistry().setEnabled('booking.orchestrator', false)
      const off = await runLiveBookingOrchestrator({
        trip: sampleTrip(),
        travelers,
      })
      expect(off.enabled).toBe(false)
      expect(off.result).toBeNull()
    })

    it('consumes Sprint 93 Unified Trip via toBookableTrip', async () => {
      const { trip } = composeUnifiedTrip({
        destination: 'Dubai',
        origin: 'Riyadh',
        startDate: '2026-08-15',
        endDate: '2026-08-20',
        adults: 2,
        currency: 'SAR',
        budget: 5000,
        flightOffers: [{
          id: 'flt_1',
          airline: 'Saudia',
          origin: 'RUH',
          destination: 'DXB',
          departureAt: '2026-08-15T08:00:00.000Z',
          arrivalAt: '2026-08-15T11:00:00.000Z',
          price: 1200,
          currency: 'SAR',
          providerId: 'amadeus',
          providerConfidence: 0.9,
        }],
        hotelOffers: [{
          id: 'htl_1',
          name: 'City Hotel',
          checkIn: '2026-08-15',
          checkOut: '2026-08-20',
          price: 1800,
          currency: 'SAR',
          providerId: 'placeholder',
        }],
        usePlaceholders: true,
      })

      expect(trip.version).toMatch(/unified-trip/)
      const bookable = toBookableTrip(trip)
      expect(bookable.id).toBe(trip.id)
      expect(bookable.flights?.[0]?.origin).toBe('RUH')

      const result = await runBookingOrchestrator({
        trip,
        travelers,
        quotedTotal: trip.pricingSummary.total,
        currentTotal: trip.pricingSummary.total,
      })
      expect(result.session.tripId).toBe(trip.id)
      expect(result.session.state).toBe('Completed')
      expect(result.session.reservations.length).toBeGreaterThan(0)
    })
  })
})
