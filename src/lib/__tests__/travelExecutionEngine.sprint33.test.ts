/**
 * Sprint 33 — Travel Execution Engine (booking) tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import type { UnifiedFlightLeg, UnifiedHotelStay, UnifiedTravelPlanOption } from '../brain'
import {
  BookingStateMachine,
  BookingReferenceGenerator,
  TravelExecutionEngine,
  createSandboxFlightReserver,
  createSandboxHotelReserver,
  createTravelExecutionEngine,
  isTravelExecutionEngineEnabled,
  TRAVEL_EXECUTION_ENGINE_FEATURE_ID,
  type CreateExecutionSessionInput,
  type ExecutionEvent,
} from '../execution'

function enableTravelExecutionChain(): void {
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
}

const sampleFlight = (overrides: Partial<UnifiedFlightLeg> = {}): UnifiedFlightLeg => ({
  id: 'flt_1',
  from: 'RUH',
  to: 'DXB',
  airline: 'Saudia',
  cabin: 'economy',
  price: 1200,
  currency: 'SAR',
  stops: 0,
  durationHours: 3.2,
  providerId: 'mock-flight-001',
  ...overrides,
})

const sampleHotel = (overrides: Partial<UnifiedHotelStay> = {}): UnifiedHotelStay => ({
  id: 'htl_1',
  name: 'Hilton Dubai Central',
  area: 'Downtown',
  stars: 5,
  nightly: 480,
  nights: 3,
  stayTotal: 1440,
  currency: 'SAR',
  providerId: 'hotelbeds',
  amenities: ['WiFi', 'Pool'],
  freeCancellation: true,
  guestScore: 8.9,
  ...overrides,
})

function samplePlan(overrides: Partial<UnifiedTravelPlanOption> = {}): UnifiedTravelPlanOption {
  const flight = 'flight' in overrides ? (overrides.flight ?? null) : sampleFlight()
  const hotel = 'hotel' in overrides ? (overrides.hotel ?? null) : sampleHotel()
  const flights = flight?.price ?? 0
  const hotels = hotel?.stayTotal ?? 0
  const taxesAndFees = 180
  const { flight: _f, hotel: _h, cost: costOverride, ...rest } = overrides
  return {
    id: 'plan_1',
    rank: 1,
    title: 'Riyadh → Dubai',
    summary: 'Saudia + Hilton',
    confidence: 0.88,
    score: 0.9,
    factors: {
      budget: 0.9,
      duration: 0.8,
      preferences: 0.85,
      loyalty: 0.7,
      conversation_context: 0.8,
      flight_hotel_match: 0.9,
    },
    reasons: ['Balanced price and comfort'],
    flight,
    hotel,
    cost: costOverride ?? {
      currency: 'SAR',
      flights,
      hotels,
      activities: 0,
      transport: 0,
      taxesAndFees,
      total: flights + hotels + taxesAndFees,
      nights: hotel?.nights ?? 0,
      withinBudget: true,
      budgetAmount: 9000,
      remainingBudget: 9000 - (flights + hotels + taxesAndFees),
    },
    itinerary: [],
    matchedPreferences: [],
    loyaltyAligned: false,
    ...rest,
  }
}

function sessionInput(
  overrides: Partial<CreateExecutionSessionInput> = {},
): CreateExecutionSessionInput {
  return {
    conversationId: 'conv_sprint33',
    tripId: 'trip_sprint33',
    userId: 'user_1',
    selectedItinerary: samplePlan(),
    travelers: { adults: 2, children: 0, infants: 0 },
    locale: 'en',
    ...overrides,
  }
}

describe('Sprint 33 feature flags', () => {
  beforeEach(() => resetFeatureRegistry())
  afterEach(() => resetFeatureRegistry())

  it('registers brain.travel_execution_engine disabled by default', () => {
    expect(getFeatureRegistry().isEnabled(TRAVEL_EXECUTION_ENGINE_FEATURE_ID)).toBe(false)
    expect(isTravelExecutionEngineEnabled()).toBe(false)
  })

  it('requires brain.conversation_ui before brain.travel_execution_engine', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.travel_execution_engine', true)
    expect(registry.isEnabled('brain.travel_execution_engine')).toBe(false)
    enableTravelExecutionChain()
    expect(registry.isEnabled('brain.travel_execution_engine')).toBe(true)
    expect(isTravelExecutionEngineEnabled()).toBe(true)
  })
})

describe('Booking session', () => {
  it('creates a session with ids, itinerary, pricing, travelers, timestamps', () => {
    const engine = createTravelExecutionEngine({ enabled: true })
    const session = engine.createBookingSession(sessionInput())
    expect(session.context.sessionId).toMatch(/^exe_/)
    expect(session.context.tripId).toBe('trip_sprint33')
    expect(session.context.conversationId).toBe('conv_sprint33')
    expect(session.context.selectedItinerary.id).toBe('plan_1')
    expect(session.context.pricing.total).toBeGreaterThan(0)
    expect(session.context.currency).toBe('SAR')
    expect(session.context.travelers.adults).toBe(2)
    expect(session.state).toBe('CREATED')
    expect(session.references.bookingReference).toMatch(/^RHL-BKG-/)
    expect(session.references.tripReference).toMatch(/^RHL-TRP-/)
    expect(session.references.executionReference).toMatch(/^RHL-EXE-/)
    expect(session.context.createdAt).toBeTruthy()
    expect(session.timeline.length).toBeGreaterThan(0)
    expect(session.audit.some((a) => a.action === 'session.created')).toBe(true)
  })
})

describe('Booking state machine', () => {
  it('allows the happy-path transitions and blocks illegal ones', () => {
    const machine = new BookingStateMachine('CREATED')
    expect(machine.transition('VALIDATED')).toBe('VALIDATED')
    expect(machine.transition('FLIGHT_RESERVED')).toBe('FLIGHT_RESERVED')
    expect(machine.transition('HOTEL_RESERVED')).toBe('HOTEL_RESERVED')
    expect(machine.transition('COMPLETED')).toBe('COMPLETED')
    expect(machine.canTransition('FAILED')).toBe(false)
  })

  it('supports hotel-only and flight-only paths', () => {
    const hotelOnly = new BookingStateMachine('VALIDATED')
    expect(hotelOnly.canTransition('HOTEL_RESERVED')).toBe(true)
    const flightOnly = new BookingStateMachine('FLIGHT_RESERVED')
    expect(flightOnly.canTransition('COMPLETED')).toBe(true)
  })

  it('allows retry from FAILED and cancel from mid-pipeline', () => {
    const machine = new BookingStateMachine('FAILED')
    expect(machine.canRetry()).toBe(true)
    expect(machine.transition('CREATED')).toBe('CREATED')
    const mid = new BookingStateMachine('FLIGHT_RESERVED')
    expect(mid.canCancel()).toBe(true)
  })
})

describe('Booking references', () => {
  it('generates booking, trip, execution, and confirmation references', () => {
    const refs = new BookingReferenceGenerator()
    expect(refs.bookingReference('exe_abc')).toMatch(/^RHL-BKG-/)
    expect(refs.tripReference('trip_1')).toMatch(/^RHL-TRP-/)
    expect(refs.executionReference('exe_abc')).toMatch(/^RHL-EXE-/)
    expect(refs.flightConfirmation('mock-flight')).toMatch(/^FLT-/)
    expect(refs.hotelConfirmation('hotelbeds')).toMatch(/^HTL-/)
  })
})

describe('Pipeline happy path', () => {
  it('reserves flight + hotel and returns a complete summary', async () => {
    const events: ExecutionEvent[] = []
    const engine = createTravelExecutionEngine({
      enabled: true,
      onEvent: (e) => events.push(e),
    })
    const result = await engine.execute(sessionInput())
    expect(result.session.state).toBe('COMPLETED')
    expect(result.summary.success).toBe(true)
    expect(result.summary.flightConfirmation?.confirmationNumber).toMatch(/^FLT-/)
    expect(result.summary.hotelConfirmation?.confirmationNumber).toMatch(/^HTL-/)
    expect(result.summary.pricing.currency).toBe('SAR')
    expect(result.summary.providersUsed).toEqual(
      expect.arrayContaining(['mock-flight-001', 'hotelbeds']),
    )
    expect(result.summary.confidenceScore).toBeGreaterThan(0)
    expect(result.summary.executionDurationMs).toBeGreaterThanOrEqual(0)
    expect(events.map((e) => e.type)).toEqual(
      expect.arrayContaining([
        'ExecutionStarted',
        'FlightReserved',
        'HotelReserved',
        'ExecutionCompleted',
      ]),
    )
    expect(result.session.audit.some((a) => a.action === 'pipeline.completed')).toBe(true)
  })

  it('supports hotel-only itineraries', async () => {
    const engine = createTravelExecutionEngine({ enabled: true })
    const result = await engine.execute(
      sessionInput({ selectedItinerary: samplePlan({ flight: null }) }),
    )
    expect(result.session.state).toBe('COMPLETED')
    expect(result.summary.flightConfirmation).toBeNull()
    expect(result.summary.hotelConfirmation?.success).toBe(true)
  })

  it('supports flight-only itineraries', async () => {
    const engine = createTravelExecutionEngine({ enabled: true })
    const result = await engine.execute(
      sessionInput({ selectedItinerary: samplePlan({ hotel: null }) }),
    )
    expect(result.session.state).toBe('COMPLETED')
    expect(result.summary.hotelConfirmation).toBeNull()
    expect(result.summary.flightConfirmation?.success).toBe(true)
  })
})

describe('Mock hotel providers', () => {
  it.each([
    ['booking_connectivity', 'Booking.com Connectivity'],
    ['hotelbeds', 'Hotelbeds'],
    ['expedia_rapid', 'Expedia Rapid'],
    ['mock_hotels', 'Mock Hotels'],
  ] as const)('reserves via sandbox port for %s', async (providerId, providerName) => {
    const engine = createTravelExecutionEngine({
      enabled: true,
      hotelReserver: createSandboxHotelReserver(),
    })
    const result = await engine.execute(
      sessionInput({
        selectedItinerary: samplePlan({
          hotel: sampleHotel({ providerId }),
        }),
      }),
    )
    expect(result.summary.success).toBe(true)
    expect(result.summary.hotelConfirmation?.providerId).toBe(providerId)
    expect(result.summary.hotelConfirmation?.providerName).toBe(providerName)
  })
})

describe('Rollback & failure', () => {
  it('aborts immediately when flight reservation fails', async () => {
    const events: ExecutionEvent[] = []
    const hotelReserve = vi.fn(async () => {
      throw new Error('hotel should not be called')
    })
    const engine = createTravelExecutionEngine({
      enabled: true,
      retryPolicy: { maxAttempts: 1 },
      flightReserver: createSandboxFlightReserver({ fail: true }),
      hotelReserver: { reserve: hotelReserve },
      onEvent: (e) => events.push(e),
    })
    const result = await engine.execute(sessionInput())
    expect(result.session.state).toBe('FAILED')
    expect(result.summary.success).toBe(false)
    expect(hotelReserve).not.toHaveBeenCalled()
    expect(events.map((e) => e.type)).toContain('ExecutionFailed')
    expect(events.map((e) => e.type)).not.toContain('RollbackStarted')
  })

  it('rolls back flight hold when hotel reservation fails', async () => {
    const events: ExecutionEvent[] = []
    const cancel = vi.fn(async () => ({ success: true, latencyMs: 1 }))
    const flightReserver = createSandboxFlightReserver()
    flightReserver.cancel = cancel
    const engine = createTravelExecutionEngine({
      enabled: true,
      retryPolicy: { maxAttempts: 1 },
      flightReserver,
      hotelReserver: createSandboxHotelReserver({ fail: true }),
      onEvent: (e) => events.push(e),
    })
    const result = await engine.execute(sessionInput())
    expect(result.session.state).toBe('FAILED')
    expect(cancel).toHaveBeenCalled()
    expect(events.map((e) => e.type)).toEqual(
      expect.arrayContaining([
        'FlightReserved',
        'RollbackStarted',
        'RollbackCompleted',
        'ExecutionFailed',
      ]),
    )
    expect(result.session.warnings.some((w) => /cancelled/i.test(w))).toBe(true)
  })
})

describe('Retry', () => {
  it('retries a FAILED session and can complete on second attempt', async () => {
    let hotelCalls = 0
    const engine = createTravelExecutionEngine({
      enabled: true,
      retryPolicy: { maxAttempts: 1 },
      hotelReserver: {
        async reserve(req) {
          hotelCalls += 1
          if (hotelCalls === 1) {
            return {
              success: false,
              providerId: String(req.hotel.providerId),
              providerName: 'Hotelbeds',
              confirmationNumber: null,
              latencyMs: 1,
              cancellable: false,
              errorCode: 'HOTEL_RESERVE_FAILED',
              errorMessage: 'transient',
            }
          }
          return createSandboxHotelReserver().reserve(req)
        },
      },
    })
    const first = await engine.execute(sessionInput())
    expect(first.session.state).toBe('FAILED')
    const second = await engine.retry(first.session.context.sessionId)
    expect(second.session.state).toBe('COMPLETED')
    expect(second.session.retryCount).toBe(1)
    expect(second.summary.success).toBe(true)
  })
})

describe('Metrics, audit, events, cancel', () => {
  it('records metrics for success and failure', async () => {
    const engine = createTravelExecutionEngine({
      enabled: true,
      retryPolicy: { maxAttempts: 1 },
    })
    await engine.execute(sessionInput())
    await engine.execute(
      sessionInput({
        selectedItinerary: samplePlan(),
      }),
    )
    const failing = createTravelExecutionEngine({
      enabled: true,
      retryPolicy: { maxAttempts: 1 },
      flightReserver: createSandboxFlightReserver({ fail: true }),
    })
    // share metrics via first engine's coordinator only — assert on first engine after one success
    const snap = engine.getMetricsSnapshot()
    expect(snap.executionsStarted).toBe(2)
    expect(snap.executionsCompleted).toBe(2)
    expect(snap.successRate).toBe(1)
    expect(snap.avgDurationMs).toBeGreaterThanOrEqual(0)

    const failResult = await failing.execute(sessionInput())
    expect(failResult.session.state).toBe('FAILED')
    const failSnap = failing.getMetricsSnapshot()
    expect(failSnap.executionsFailed).toBe(1)
    expect(failSnap.failureRate).toBe(1)
  })

  it('persists audit history on the session', async () => {
    const engine = createTravelExecutionEngine({ enabled: true })
    const result = await engine.execute(sessionInput())
    const actions = result.session.audit.map((a) => a.action)
    expect(actions).toEqual(
      expect.arrayContaining([
        'session.created',
        'pipeline.started',
        'pipeline.validated',
        'flight.reserved',
        'hotel.reserved',
        'pipeline.completed',
      ]),
    )
  })

  it('cancels a CREATED session', () => {
    const engine = createTravelExecutionEngine({ enabled: true })
    const session = engine.createBookingSession(sessionInput())
    const cancelled = engine.cancel(session.context.sessionId, 'user_abort')
    expect(cancelled.state).toBe('CANCELLED')
    expect(cancelled.error).toBe('user_abort')
  })

  it('throws when feature flag is off', async () => {
    resetFeatureRegistry()
    const engine = new TravelExecutionEngine()
    expect(engine.isEnabled()).toBe(false)
    expect(() => engine.createBookingSession(sessionInput())).toThrow(/disabled/i)
  })
})

describe('Sandbox flight provider port', () => {
  it('returns confirmation and supports cancel', async () => {
    const port = createSandboxFlightReserver()
    const reserved = await port.reserve({
      flight: sampleFlight(),
      adults: 2,
      currency: 'SAR',
    })
    expect(reserved.success).toBe(true)
    expect(reserved.cancellable).toBe(true)
    const cancelled = await port.cancel?.(reserved.confirmationNumber!, reserved.providerId)
    expect(cancelled?.success).toBe(true)
  })
})
