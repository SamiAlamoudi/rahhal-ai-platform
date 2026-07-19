/**
 * Sprint 36 — Universal Cancellation & Refund Policy Engine tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createPaymentOrchestrator } from '../payments'
import {
  createPolicyEngine,
  demoBasket,
  detectRefundConversationQuery,
  answerRefundQuery,
  isRefundPolicyEngineEnabled,
  PolicyEngine,
  REFUND_POLICY_ENGINE_FEATURE_ID,
  type BookedServiceLine,
  type PolicyQuoteInput,
} from '../refunds'
import { detectConversationCommand } from '../chat/conversationExperience/ConversationState'
import {
  createPostBookingService,
  resetPostBookingRepository,
  resetPostBookingService,
  resetTripManager,
  resetTripRepository,
} from '../trips'

function enableRefundPolicyChain(): void {
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
  registry.setEnabled('brain.refund_policy_engine', true)
}

function quoteInput(
  overrides: Partial<PolicyQuoteInput> = {},
  lines?: BookedServiceLine[],
): PolicyQuoteInput {
  return {
    tripId: 'trip_s36',
    userId: 'user_s36',
    currency: 'SAR',
    scope: 'full_booking',
    reason: 'customer_request',
    lines: lines ?? demoBasket('SAR'),
    platformFee: 40,
    passengersTotal: 2,
    passengersCancelling: 1,
    ...overrides,
  }
}

describe('Sprint 36 feature flags', () => {
  beforeEach(() => resetFeatureRegistry())
  afterEach(() => resetFeatureRegistry())

  it('registers brain.refund_policy_engine disabled by default', () => {
    expect(getFeatureRegistry().isEnabled(REFUND_POLICY_ENGINE_FEATURE_ID)).toBe(false)
    expect(isRefundPolicyEngineEnabled()).toBe(false)
  })

  it('requires brain.trip_management before brain.refund_policy_engine', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.refund_policy_engine', true)
    expect(registry.isEnabled('brain.refund_policy_engine')).toBe(false)
    enableRefundPolicyChain()
    expect(registry.isEnabled('brain.refund_policy_engine')).toBe(true)
    expect(isRefundPolicyEngineEnabled()).toBe(true)
  })
})

describe('Refund calculations — flights, hotels, cars, activities', () => {
  it('matches the sample multi-service breakdown', () => {
    const engine = createPolicyEngine({ enabled: true })
    const quote = engine.quote(quoteInput())
    const byTitle = Object.fromEntries(
      quote.breakdown.lines.map((l) => [l.title, l.refundAmount]),
    )
    expect(byTitle.Flight).toBe(2050)
    expect(byTitle.Hotel).toBe(1600)
    expect(byTitle.Car).toBe(540)
    expect(quote.breakdown.platformFeeRefunded).toBe(0)
    expect(quote.breakdown.totalRefund).toBe(4190)
    expect(quote.breakdown.expectedArrivalBusinessDaysMin).toBe(5)
    expect(quote.breakdown.expectedArrivalBusinessDaysMax).toBe(7)
    expect(quote.simpleExplanation).toContain('Total refund')
  })

  it('handles non-refundable flight with tax return only', () => {
    const engine = createPolicyEngine({ enabled: true })
    const quote = engine.quote(
      quoteInput({ scope: 'flight_only' }, [
        {
          lineId: 'f1',
          serviceKind: 'flight',
          title: 'Flight',
          amountPaid: 2000,
          currency: 'SAR',
          quantity: 1,
          providerId: 'mock-flight-001',
          rawPolicy: {
            nonRefundable: true,
            refundPercent: 0,
            airportTaxesRefundable: 220,
          },
        },
      ]),
    )
    expect(quote.breakdown.lines[0].refundAmount).toBe(220)
  })

  it('applies hotel free cancellation vs first-night penalty after deadline', () => {
    const engine = createPolicyEngine({ enabled: true })
    const future = engine.quote(
      quoteInput({ scope: 'hotel_only' }, [
        {
          lineId: 'h1',
          serviceKind: 'hotel',
          title: 'Hotel',
          amountPaid: 1600,
          currency: 'SAR',
          quantity: 1,
          providerId: 'hotelbeds',
          rawPolicy: {
            freeCancellation: true,
            deadline: new Date(Date.now() + 86400000).toISOString(),
          },
          metadata: { nightly: 400 },
        },
      ]),
    )
    expect(future.breakdown.totalRefund).toBe(1600)

    const past = engine.quote(
      quoteInput(
        {
          scope: 'hotel_only',
          asOf: new Date().toISOString(),
        },
        [
          {
            lineId: 'h2',
            serviceKind: 'hotel',
            title: 'Hotel',
            amountPaid: 1600,
            currency: 'SAR',
            quantity: 1,
            providerId: 'hotelbeds',
            rawPolicy: {
              freeCancellation: true,
              firstNightPenalty: true,
              lateCancellationPenalty: true,
              deadline: new Date(Date.now() - 86400000).toISOString(),
              nightly: 400,
            },
            metadata: { nightly: 400 },
          },
        ],
      ),
    )
    expect(past.breakdown.lines[0].penaltyAmount).toBeGreaterThan(0)
    expect(past.breakdown.totalRefund).toBeLessThan(1600)
  })

  it('supports activity percentage and weather full refund', () => {
    const engine = createPolicyEngine({ enabled: true })
    const activity: BookedServiceLine = {
      lineId: 'a1',
      serviceKind: 'activity',
      title: 'Desert Safari',
      amountPaid: 400,
      currency: 'SAR',
      quantity: 1,
      providerId: 'activity_generic',
      rawPolicy: { refundPercent: 50, weatherCancellationFullRefund: true },
    }
    const partial = engine.quote(
      quoteInput({ scope: 'activity_only', reason: 'customer_request' }, [activity]),
    )
    expect(partial.breakdown.totalRefund).toBe(200)

    const weather = engine.quote(
      quoteInput({ scope: 'activity_only', reason: 'weather' }, [activity]),
    )
    expect(weather.breakdown.totalRefund).toBe(400)
  })

  it('exposes visa/insurance framework-only policies', () => {
    const engine = createPolicyEngine({ enabled: true })
    const quote = engine.quote(
      quoteInput({ scope: 'full_booking' }, [
        {
          lineId: 'v1',
          serviceKind: 'visa',
          title: 'Visa',
          amountPaid: 300,
          currency: 'SAR',
          quantity: 1,
          providerId: 'visa_framework',
          rawPolicy: {},
        },
        {
          lineId: 'i1',
          serviceKind: 'insurance',
          title: 'Insurance',
          amountPaid: 120,
          currency: 'SAR',
          quantity: 1,
          providerId: 'insurance_framework',
          rawPolicy: {},
        },
      ]),
    )
    expect(quote.policies.every((p) => p.attributes.frameworkOnly)).toBe(true)
  })
})

describe('Partial cancellations', () => {
  it('cancels hotel only / flight only / one passenger / return flight', () => {
    const engine = createPolicyEngine({ enabled: true })
    const hotelOnly = engine.quote(quoteInput({ scope: 'hotel_only' }))
    expect(hotelOnly.breakdown.lines).toHaveLength(1)
    expect(hotelOnly.breakdown.lines[0].serviceKind).toBe('hotel')

    const flightOnly = engine.quote(quoteInput({ scope: 'flight_only' }))
    expect(flightOnly.breakdown.lines[0].serviceKind).toBe('flight')

    const onePax = engine.quote(
      quoteInput({
        scope: 'one_passenger',
        passengersTotal: 2,
        passengersCancelling: 1,
      }),
    )
    expect(onePax.breakdown.lines[0].amountPaid).toBe(1200)

    const ret = engine.quote(quoteInput({ scope: 'return_flight_only' }))
    expect(ret.breakdown.lines[0].amountPaid).toBe(1200)
  })
})

describe('Execution, rollback, retry', () => {
  beforeEach(() => {
    resetTripManager()
    resetTripRepository()
    resetPostBookingRepository()
    resetPostBookingService()
  })

  it('executes cancellation and completes refund with payment orchestrator', async () => {
    const payments = createPaymentOrchestrator({ enabled: true })
    const checkout = payments.createCheckout({
      executionSessionId: 'exe_s36',
      conversationId: 'conv_s36',
      currency: 'SAR',
      subtotal: 4640,
      flightConfirmation: 'FLT-1',
      hotelConfirmation: 'HTL-1',
    })
    const paid = await payments.pay(checkout.sessionId, { method: 'card' })
    expect(paid.success).toBe(true)

    const trips = createPostBookingService({ enabled: true })
    const trip = trips.createFromPayment(paid, {
      userId: 'user_s36',
      destination: 'Dubai',
      hotelName: 'Hilton',
    })

    const engine = createPolicyEngine({
      enabled: true,
      paymentOrchestrator: payments,
      postBookingService: trips,
    })

    const result = await engine.executeCancellation({
      ...quoteInput({ tripId: trip.tripId, userId: 'user_s36' }),
      paymentSessionId: paid.session.sessionId,
    })

    expect(result.success).toBe(true)
    expect(result.status).toBe('refund_completed')
    expect(result.tripLifecycle).toBe('Refund Completed')
    expect(result.paymentRefundedAmount).toBe(4190)
    expect(engine.listNotifications(trip.tripId).map((n) => n.trigger)).toEqual(
      expect.arrayContaining([
        'Refund requested',
        'Refund approved',
        'Refund completed',
        'Timeline changed',
      ]),
    )
    expect(engine.getAuditLog().list(result.caseId).length).toBeGreaterThan(0)
    expect(engine.getMetricsSnapshot().refundSuccessRate).toBeGreaterThan(0)
  })

  it('rolls back on provider failure and retries successfully', async () => {
    const engine = createPolicyEngine({ enabled: true })
    const failed = await engine.executeCancellation({
      ...quoteInput(),
      simulateProviderFailure: true,
    })
    expect(failed.success).toBe(false)
    expect(failed.rolledBack).toBe(true)
    expect(failed.status).toBe('rolled_back')
    expect(engine.getMetricsSnapshot().rollbacks).toBe(1)

    const retried = await engine.retryCancellation(failed.caseId, quoteInput())
    expect(retried.success).toBe(true)
    expect(retried.status).toBe('refund_completed')
  })
})

describe('Conversation responses', () => {
  beforeEach(() => resetFeatureRegistry())
  afterEach(() => resetFeatureRegistry())

  it('detects refund conversation intents', () => {
    expect(detectConversationCommand('If I cancel now how much will I get back?')).toBe(
      'cancel_refund_quote',
    )
    expect(detectConversationCommand('Can I cancel only the hotel?')).toBe('cancel_hotel_only')
    expect(detectConversationCommand('What happens if my flight is delayed?')).toBe(
      'flight_delay_policy',
    )
    expect(detectConversationCommand('Will I lose my deposit?')).toBe('deposit_refund')
    expect(detectConversationCommand('Can I cancel after check-in?')).toBe('cancel_after_checkin')
    expect(detectConversationCommand('What if the airline cancels?')).toBe('airline_cancels')
    expect(detectConversationCommand('What if only one traveler cancels?')).toBe(
      'one_traveler_cancels',
    )
    expect(detectRefundConversationQuery('If I cancel now how much will I get back?')).toBe(
      'cancel_refund_quote',
    )
  })

  it('answers refund questions with simple explanations', () => {
    enableRefundPolicyChain()
    const engine = createPolicyEngine({ enabled: true })
    const reply = answerRefundQuery({
      kind: 'cancel_refund_quote',
      engine,
      tripId: 't1',
      userId: 'u1',
      lines: demoBasket(),
      currency: 'SAR',
      platformFee: 40,
    })
    expect(reply).toContain('4,190')
    expect(reply).toContain('business days')

    const airline = answerRefundQuery({
      kind: 'airline_cancels',
      engine,
      tripId: 't1',
      userId: 'u1',
      lines: demoBasket(),
      currency: 'SAR',
    })
    expect(airline).toMatch(/2,400|2400/)
  })
})

describe('Car rental & same-day flight rules', () => {
  it('keeps one-way fee and respects deposit refundable notes', () => {
    const engine = createPolicyEngine({ enabled: true })
    const quote = engine.quote(
      quoteInput({ scope: 'car_only' }, [
        {
          lineId: 'c1',
          serviceKind: 'car_rental',
          title: 'Car',
          amountPaid: 800,
          currency: 'SAR',
          quantity: 1,
          providerId: 'car_generic',
          rawPolicy: {
            freeCancellation: true,
            oneWayFeeNonRefundable: true,
            depositRefundable: true,
            insuranceRefundable: false,
          },
          metadata: { oneWayFee: 100, insurance: 50, deposit: 300 },
        },
      ]),
    )
    expect(quote.breakdown.totalRefund).toBe(650)
    expect(quote.breakdown.lines[0].notes.join(' ')).toMatch(/deposit|Insurance|One-way/i)
  })

  it('supports airline-initiated full refund regardless of fare', () => {
    const engine = createPolicyEngine({ enabled: true })
    const quote = engine.quote(
      quoteInput(
        { scope: 'flight_only', reason: 'airline_initiated', airlineCancelled: true },
        [
          {
            lineId: 'f1',
            serviceKind: 'flight',
            title: 'Flight',
            amountPaid: 2400,
            currency: 'SAR',
            quantity: 1,
            providerId: 'mock-flight-001',
            rawPolicy: { nonRefundable: true, refundPercent: 0 },
          },
        ],
      ),
    )
    expect(quote.breakdown.totalRefund).toBe(2400)
    expect(quote.cancellable).toBe(true)
  })

  it('blocks cancelling a lone non-refundable hotel', () => {
    const engine = createPolicyEngine({ enabled: true })
    const quote = engine.quote(
      quoteInput({ scope: 'hotel_only' }, [
        {
          lineId: 'h1',
          serviceKind: 'hotel',
          title: 'Hotel',
          amountPaid: 900,
          currency: 'SAR',
          quantity: 1,
          providerId: 'hotelbeds',
          rawPolicy: { nonRefundable: true, freeCancellation: false },
        },
      ]),
    )
    expect(quote.cancellable).toBe(false)
  })
})

describe('Admin metrics', () => {
  it('tracks refund reasons and volume', async () => {
    const engine = createPolicyEngine({ enabled: true })
    await engine.executeCancellation(quoteInput({ reason: 'customer_request' }))
    const snap = engine.getMetricsSnapshot()
    expect(snap.refundVolume).toBeGreaterThan(0)
    expect(snap.cancellationReasons.customer_request).toBeGreaterThan(0)
    expect(snap.refundReasons.customer_request).toBeGreaterThan(0)
    expect(snap.averageRefundBusinessDays).toBeGreaterThan(0)
  })

  it('lists policy adapters for all supported service kinds', () => {
    const engine = createPolicyEngine({ enabled: true })
    const quote = engine.quote(quoteInput())
    const kinds = new Set(quote.policies.map((p) => p.serviceKind))
    expect(kinds.has('flight')).toBe(true)
    expect(kinds.has('hotel')).toBe(true)
    expect(kinds.has('car_rental')).toBe(true)
  })
})

describe('Feature gate', () => {
  it('throws when disabled', () => {
    resetFeatureRegistry()
    const engine = new PolicyEngine()
    expect(engine.isEnabled()).toBe(false)
    expect(() => engine.quote(quoteInput())).toThrow(/disabled/i)
  })
})
