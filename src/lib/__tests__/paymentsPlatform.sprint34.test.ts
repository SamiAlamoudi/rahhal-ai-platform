/**
 * Sprint 34 — Payments & Checkout Platform tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  PaymentOrchestrator,
  PaymentProviderRegistry,
  buildPayNowOffer,
  createAdyenPaymentAdapter,
  createCheckoutComPaymentAdapter,
  createHyperPayPaymentAdapter,
  createMockPaymentProvider,
  createPaymentOrchestrator,
  createStripePaymentAdapter,
  isPaymentsPlatformEnabled,
  PAYMENTS_PLATFORM_FEATURE_ID,
  type PaymentEvent,
  type PaymentCheckoutInput,
} from '../payments'
import type { ExecutionResult } from '../execution'
import { detectConversationCommand } from '../chat/conversationExperience/ConversationState'
import { ResponseComposer } from '../chat/conversationExperience/ResponseComposer'
import type { UnifiedTravelPlanOption } from '../brain'

function enablePaymentsChain(): void {
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
}

function checkoutInput(overrides: Partial<PaymentCheckoutInput> = {}): PaymentCheckoutInput {
  return {
    executionSessionId: 'exe_test_1',
    conversationId: 'conv_pay_1',
    tripId: 'trip_pay_1',
    currency: 'SAR',
    subtotal: 5000,
    flightConfirmation: 'FLT-MOCK-1',
    hotelConfirmation: 'HTL-HB-1',
    bookingReferenceHint: 'RHL-BKG-TEST01',
    tripReferenceHint: 'RHL-TRP-TEST01',
    customerEmail: 'traveler@example.com',
    customerName: 'Bilamo Traveler',
    locale: 'en',
    ...overrides,
  }
}

function fakeExecutionResult(total = 5320): ExecutionResult {
  return {
    session: {
      context: {
        sessionId: 'exe_bridge_1',
        tripId: 'trip_bridge',
        conversationId: 'conv_bridge',
        userId: 'user_1',
        selectedItinerary: { id: 'plan_1' } as UnifiedTravelPlanOption,
        travelers: { adults: 2, children: 0, infants: 0, summary: '2 adults' },
        pricing: {
          currency: 'SAR',
          flights: 2000,
          hotels: 3000,
          taxesAndFees: 320,
          total,
        },
        currency: 'SAR',
        locale: 'en',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      state: 'COMPLETED',
      references: {
        bookingReference: 'RHL-BKG-BRIDGE',
        tripReference: 'RHL-TRP-BRIDGE',
        executionReference: 'RHL-EXE-BRIDGE',
        flightConfirmation: 'FLT-1',
        hotelConfirmation: 'HTL-1',
      },
      flightReservation: null,
      hotelReservation: null,
      warnings: [],
      retryCount: 0,
      error: null,
      timeline: [],
      audit: [],
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    },
    summary: {
      sessionId: 'exe_bridge_1',
      state: 'COMPLETED',
      references: {
        bookingReference: 'RHL-BKG-BRIDGE',
        tripReference: 'RHL-TRP-BRIDGE',
        executionReference: 'RHL-EXE-BRIDGE',
        flightConfirmation: 'FLT-1',
        hotelConfirmation: 'HTL-1',
      },
      flightConfirmation: null,
      hotelConfirmation: null,
      pricing: {
        currency: 'SAR',
        flights: 2000,
        hotels: 3000,
        taxesAndFees: 320,
        total,
      },
      currency: 'SAR',
      warnings: [],
      providersUsed: ['mock'],
      confidenceScore: 0.9,
      executionDurationMs: 12,
      retryCount: 0,
      success: true,
      error: null,
    },
    events: [],
  }
}

describe('Sprint 34 feature flags', () => {
  beforeEach(() => resetFeatureRegistry())
  afterEach(() => resetFeatureRegistry())

  it('registers brain.payments_platform disabled by default', () => {
    expect(getFeatureRegistry().isEnabled(PAYMENTS_PLATFORM_FEATURE_ID)).toBe(false)
    expect(isPaymentsPlatformEnabled()).toBe(false)
  })

  it('requires brain.travel_execution_engine before brain.payments_platform', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.payments_platform', true)
    expect(registry.isEnabled('brain.payments_platform')).toBe(false)
    enablePaymentsChain()
    expect(registry.isEnabled('brain.payments_platform')).toBe(true)
    expect(isPaymentsPlatformEnabled()).toBe(true)
  })
})

describe('Successful payment workflow', () => {
  it('runs intent → reserve → pay → confirm → invoice', async () => {
    const events: PaymentEvent[] = []
    const orchestrator = createPaymentOrchestrator({
      enabled: true,
      onEvent: (e) => events.push(e),
    })

    const session = orchestrator.createCheckout(checkoutInput({ couponCode: 'RAHHAL10' }))
    expect(session.state).toBe('AWAITING_PAYMENT')
    expect(session.inventory?.status).toBe('held')
    expect(session.pricing.couponDiscount).toBeGreaterThan(0)
    expect(session.pricing.vatAmount).toBeGreaterThan(0)
    expect(session.pricing.total).toBeGreaterThan(session.pricing.subtotal - session.pricing.couponDiscount)

    const result = await orchestrator.pay(session.sessionId, { method: 'mada' })
    expect(result.success).toBe(true)
    expect(result.session.state).toBe('COMPLETED')
    expect(result.session.bookingRefs?.bookingReference).toBeTruthy()
    expect(result.session.bookingRefs?.paymentReference).toMatch(/^RHL-PAY-/)
    expect(result.receipt?.receiptId).toMatch(/^RCPT-/)
    expect(result.invoice?.invoiceNumber).toMatch(/^INV-/)
    expect(result.invoice?.status).toBe('paid')
    expect(events.map((e) => e.type)).toEqual(
      expect.arrayContaining([
        'PaymentIntentCreated',
        'InventoryReserved',
        'PaymentStarted',
        'PaymentSucceeded',
        'BookingConfirmed',
        'InvoiceGenerated',
        'CheckoutCompleted',
      ]),
    )
    expect(orchestrator.getAuditLog().list(session.sessionId).length).toBeGreaterThan(3)
    const metrics = orchestrator.getMetricsSnapshot()
    expect(metrics.paymentsSucceeded).toBe(1)
    expect(metrics.successRate).toBe(1)
  })

  it('bridges from TravelExecutionEngine result', async () => {
    const orchestrator = createPaymentOrchestrator({ enabled: true })
    const session = orchestrator.startFromExecution(fakeExecutionResult(5320))
    expect(session.intent.executionSessionId).toBe('exe_bridge_1')
    expect(session.pricing.subtotal).toBe(5320)
    const paid = await orchestrator.pay(session.sessionId, { method: 'apple_pay' })
    expect(paid.success).toBe(true)
  })
})

describe('Declined card, timeout, duplicate payment', () => {
  it('declines card, rolls back inventory, preserves audit', async () => {
    const release = vi.fn(async () => undefined)
    const orchestrator = createPaymentOrchestrator({
      enabled: true,
      releaseExecutionHold: release,
    })
    const session = orchestrator.createCheckout(checkoutInput())
    const result = await orchestrator.pay(session.sessionId, {
      method: 'card',
      simulate: 'declined',
    })
    expect(result.success).toBe(false)
    expect(result.session.state).toBe('ROLLED_BACK')
    expect(result.session.inventory?.status).toBe('released')
    expect(release).toHaveBeenCalledWith('exe_test_1', expect.stringMatching(/declined/i))
    expect(orchestrator.getAuditLog().list(session.sessionId).some((a) => a.action === 'rollback.completed')).toBe(true)
    expect(orchestrator.getMetricsSnapshot().paymentsDeclined).toBe(1)
    expect(orchestrator.getMetricsSnapshot().rollbacks).toBe(1)
  })

  it('handles payment timeout with rollback', async () => {
    const orchestrator = createPaymentOrchestrator({ enabled: true })
    const session = orchestrator.createCheckout(checkoutInput())
    const result = await orchestrator.pay(session.sessionId, {
      method: 'google_pay',
      simulate: 'timeout',
    })
    expect(result.success).toBe(false)
    expect(result.session.state).toBe('ROLLED_BACK')
    expect(orchestrator.getMetricsSnapshot().paymentsTimedOut).toBe(1)
  })

  it('rejects duplicate payment on an already completed session', async () => {
    const orchestrator = createPaymentOrchestrator({ enabled: true })
    const session = orchestrator.createCheckout(checkoutInput())
    await orchestrator.pay(session.sessionId, { method: 'card' })
    await expect(
      orchestrator.pay(session.sessionId, { method: 'card' }),
    ).rejects.toThrow(/duplicate|already/i)
  })

  it('returns existing intent for identical idempotency key', () => {
    const orchestrator = createPaymentOrchestrator({ enabled: true })
    const a = orchestrator.createCheckout(
      checkoutInput({ idempotencyKey: 'same-key-1' }),
    )
    const b = orchestrator.createCheckout(
      checkoutInput({ idempotencyKey: 'same-key-1' }),
    )
    expect(a.sessionId).toBe(b.sessionId)
  })
})

describe('Refunds & invoice', () => {
  it('supports full and partial refunds', async () => {
    const orchestrator = createPaymentOrchestrator({ enabled: true })
    const session = orchestrator.createCheckout(checkoutInput())
    await orchestrator.pay(session.sessionId, { method: 'card' })

    const partial = await orchestrator.refund(session.sessionId, {
      kind: 'partial',
      amount: 100,
      reason: 'goodwill',
    })
    expect(partial.success).toBe(true)
    expect(partial.session.state).toBe('PARTIALLY_REFUNDED')
    expect(partial.refundedAmount).toBe(100)

    const full = await orchestrator.refund(session.sessionId, {
      kind: 'full',
      reason: 'cancel trip',
    })
    expect(full.success).toBe(true)
    expect(full.session.state).toBe('REFUNDED')
  })

  it('supports cancellation refund', async () => {
    const orchestrator = createPaymentOrchestrator({ enabled: true })
    const session = orchestrator.createCheckout(checkoutInput())
    await orchestrator.pay(session.sessionId, { method: 'bank_transfer' })
    const outcome = await orchestrator.refund(session.sessionId, {
      kind: 'cancellation',
      reason: 'user_cancelled',
    })
    expect(outcome.success).toBe(true)
    expect(outcome.session.state).toBe('REFUNDED')
    expect(outcome.session.inventory?.status).toBe('released')
  })

  it('generates payment receipt and booking invoice lines', async () => {
    const orchestrator = createPaymentOrchestrator({ enabled: true })
    const session = orchestrator.createCheckout(
      checkoutInput({ couponCode: 'WELCOME50', currency: 'SAR' }),
    )
    const result = await orchestrator.pay(session.sessionId, { method: 'stc_pay' })
    expect(result.receipt?.lines.some((l) => /VAT/i.test(l.label))).toBe(true)
    expect(result.invoice?.lines.some((l) => l.type === 'discount')).toBe(true)
    expect(result.invoice?.currency).toBe('SAR')
    expect(orchestrator.getInvoice(session.sessionId)?.invoiceId).toBe(result.invoice?.invoiceId)
  })
})

describe('Multi-currency', () => {
  it.each(['SAR', 'USD', 'EUR', 'GBP'] as const)('prices checkout in %s', async (currency) => {
    const orchestrator = createPaymentOrchestrator({ enabled: true })
    const session = orchestrator.createCheckout(
      checkoutInput({ currency, subtotal: 1000, couponCode: null }),
    )
    expect(session.pricing.currency).toBe(currency)
    expect(session.pricing.total).toBeGreaterThan(0)
    const paid = await orchestrator.pay(session.sessionId, { method: 'card' })
    expect(paid.success).toBe(true)
    expect(paid.session.pricing.currency).toBe(currency)
  })
})

describe('Provider failover', () => {
  it('fails over from unhealthy preferred provider to next healthy one', async () => {
    const registry = new PaymentProviderRegistry([
      createStripePaymentAdapter({ unhealthy: true }),
      createAdyenPaymentAdapter(),
      createCheckoutComPaymentAdapter(),
      createHyperPayPaymentAdapter(),
      createMockPaymentProvider(),
    ])
    const orchestrator = createPaymentOrchestrator({ enabled: true, registry })
    const session = orchestrator.createCheckout(
      checkoutInput({ preferredProviderId: 'stripe' }),
    )
    const result = await orchestrator.pay(session.sessionId, {
      method: 'card',
      preferredProviderId: 'stripe',
    })
    expect(result.success).toBe(true)
    expect(result.session.providerId).not.toBe('stripe')
    expect(result.session.warnings.some((w) => /failover/i.test(w))).toBe(true)
    expect(orchestrator.getMetricsSnapshot().providerFailovers).toBeGreaterThanOrEqual(1)
  })

  it('exposes all five sandbox provider adapters via registry', () => {
    const registry = new PaymentProviderRegistry()
    const ids = registry.list().map((p) => p.id).sort()
    expect(ids).toEqual(['adyen', 'checkout_com', 'hyperpay', 'mock', 'stripe'].sort())
  })
})

describe('Conversation pay-now integration', () => {
  beforeEach(() => resetFeatureRegistry())
  afterEach(() => resetFeatureRegistry())

  it('builds the pay-now offer copy', () => {
    const offer = buildPayNowOffer({ total: 5320, currency: 'SAR', locale: 'en' })
    expect(offer.combinedText).toContain('I found the best itinerary')
    expect(offer.combinedText).toContain('5,320 SAR')
    expect(offer.combinedText).toContain('Would you like to pay now?')
    expect(offer.suggestedAction.id).toBe('pay_now')
  })

  it('detects pay_now conversation command', () => {
    expect(detectConversationCommand('Pay now')).toBe('pay_now')
    expect(detectConversationCommand('Would you like to pay? Yes, pay')).toBe('pay_now')
  })

  it('adds pay-now action in ResponseComposer when flag chain is on', () => {
    enablePaymentsChain()
    const composer = new ResponseComposer()
    const topPlan = {
      id: 'plan_pay',
      rank: 1,
      title: 'RUH-DXB',
      summary: 'Best',
      confidence: 0.9,
      score: 0.9,
      factors: {
        budget: 1,
        duration: 1,
        preferences: 1,
        loyalty: 1,
        conversation_context: 1,
        flight_hotel_match: 1,
      },
      reasons: [],
      flight: null,
      hotel: null,
      cost: {
        currency: 'SAR',
        flights: 2000,
        hotels: 3000,
        activities: 0,
        transport: 0,
        taxesAndFees: 320,
        total: 5320,
        nights: 3,
        withinBudget: true,
        budgetAmount: 9000,
        remainingBudget: 3680,
      },
      itinerary: [],
      matchedPreferences: [],
      loyaltyAligned: false,
    } satisfies UnifiedTravelPlanOption

    const structured = composer.compose({
      planResult: {
        conversationId: 'c1',
        stage: 'complete',
        intent: 'AskRecommendation',
        headline: 'Your Dubai trip',
        plans: [topPlan],
        topPlan,
        alternatives: [],
        followUps: [],
        missingFields: [],
        recommendation: null,
        confidenceScore: 0.9,
        reasoning: [],
        costSummary: topPlan.cost,
        providers: {
          flightsUsed: 0,
          hotelsUsed: 0,
          hotelProviderId: null,
          flightProviderIds: [],
          fromHotelFoundation: false,
          fromOrchestrator: false,
        },
        durationMs: 1,
        error: null,
        orchestrator: null,
        memory: null,
      },
      phase: 'presenting',
      locale: 'en',
    })

    expect(structured.summary).toContain('Would you like to pay now?')
    expect(structured.suggestedFollowUpActions[0]?.id).toBe('pay_now')
  })

  it('does not offer pay-now when payments platform flag is off', () => {
    const composer = new ResponseComposer()
    const structured = composer.compose({
      planResult: null,
      phase: 'presenting',
      locale: 'en',
      clarificationQuestion: null,
    })
    expect(structured.suggestedFollowUpActions.some((a) => a.id === 'pay_now')).toBe(false)
  })
})

describe('Feature gate', () => {
  it('throws when orchestrator used while disabled', () => {
    resetFeatureRegistry()
    const orchestrator = new PaymentOrchestrator()
    expect(orchestrator.isEnabled()).toBe(false)
    expect(() => orchestrator.createCheckout(checkoutInput())).toThrow(/disabled/i)
  })
})
