import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  PaymentOrchestrator,
  resetPaymentOrchestrator,
  createMockPaymentAdapter,
  prepareBookingPayment,
  bookingItemToCheckoutItem,
  canTransitionPaymentSession,
  transitionPaymentSession,
  applyPaymentSessionEvent,
  PAYMENT_SESSION_TRANSITIONS,
  PaymentSessionTransitionError,
  getDefaultPaymentProviderType,
  clearAllOrders,
  clearAllLocks,
  clearCoupons,
  type PaymentSession,
} from '../payment'
import { getBookingOrchestrator, resetBookingOrchestrator } from '../booking'
import type { BookingItem } from '../booking/bookingTypes'
import type { CheckoutItem } from '../payment/checkoutTypes'

function sampleCheckoutItem(overrides: Partial<CheckoutItem> = {}): CheckoutItem {
  return {
    id: 'item-1',
    type: 'flight',
    providerId: 'amadeus-1',
    providerName: 'Amadeus',
    providerOfferId: 'offer-1',
    title: 'JAL 462: RUH → NRT',
    price: 5500,
    currency: 'SAR',
    bookingUrl: 'https://example.com/book',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    travelerSummary: '2 adults',
    metadata: {},
    ...overrides,
  }
}

function baseSession(overrides: Partial<PaymentSession> = {}): PaymentSession {
  return {
    id: 'ps-1',
    orderId: 'ord-1',
    orderNumber: 'RH-1',
    providerId: 'mock',
    status: 'created',
    amount: 100,
    currency: 'SAR',
    paymentMethod: null,
    providerReference: null,
    authorizationCode: null,
    transactionId: null,
    redirectUrl: null,
    description: 'test',
    customerEmail: null,
    customerName: null,
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    paidAt: null,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

describe('Phase S PaymentSession state machine', () => {
  it('allows the canonical happy path created → pending → authorized → paid → refunded', () => {
    expect(canTransitionPaymentSession('created', 'pending')).toBe(true)
    expect(canTransitionPaymentSession('pending', 'authorized')).toBe(true)
    expect(canTransitionPaymentSession('authorized', 'paid')).toBe(true)
    expect(canTransitionPaymentSession('paid', 'refunded')).toBe(true)
    expect(PAYMENT_SESSION_TRANSITIONS.paid).toEqual(['refunded'])
  })

  it('rejects impossible transitions', () => {
    expect(canTransitionPaymentSession('paid', 'pending')).toBe(false)
    expect(() => transitionPaymentSession({
      session: baseSession({ status: 'paid' }),
      to: 'pending',
    })).toThrow(PaymentSessionTransitionError)
  })

  it('applies events through resolve + transition', () => {
    const pending = applyPaymentSessionEvent(baseSession({ status: 'created' }), 'submit')
    expect(pending.session.status).toBe('pending')
    const paid = applyPaymentSessionEvent(pending.session, 'mark_paid', {
      paidAt: '2026-07-15T00:00:00.000Z',
    })
    expect(paid.session.status).toBe('paid')
    expect(paid.session.paidAt).toBe('2026-07-15T00:00:00.000Z')
  })
})

describe('Phase S PaymentOrchestrator + mock adapter', () => {
  let orchestrator: PaymentOrchestrator

  beforeEach(() => {
    clearAllOrders()
    clearAllLocks()
    clearCoupons()
    resetPaymentOrchestrator()
    resetBookingOrchestrator()
    orchestrator = new PaymentOrchestrator({
      adapter: createMockPaymentAdapter(),
      persist: false,
    })
  })

  afterEach(() => {
    resetPaymentOrchestrator()
    resetBookingOrchestrator()
  })

  it('keeps default provider on mock', () => {
    expect(getDefaultPaymentProviderType()).toBe('mock')
    expect(orchestrator.getCapabilities()).toMatchObject({
      providerId: 'mock',
      mocked: true,
      supportsHostedCheckout: true,
    })
  })

  it('starts checkout payment and seeds FSM at pending', async () => {
    const started = await orchestrator.startCheckoutPayment({
      checkoutInit: {
        userId: 'user-1',
        travelSessionId: null,
        items: [sampleCheckoutItem()],
        currency: 'SAR',
        travelers: [],
        couponCode: null,
      },
      customerEmail: 'guest@example.com',
      customerName: 'Guest',
      returnUrl: 'https://app.example/checkout/return',
    })

    expect(started.success).toBe(true)
    expect(started.paymentSession?.status).toBe('pending')
    expect(started.paymentSession?.metadata.orchestration).toBe('payment_orchestrator_v1')
    expect(started.redirectUrl).toBe('https://app.example/checkout/return')
    expect(started.checkoutSession?.order.status).toBe('pending_payment')
    expect(orchestrator.getSession(started.paymentSession!.id)?.status).toBe('pending')
  })

  it('captures tokenized payments via adapter and ends in paid', async () => {
    const started = await orchestrator.startCheckoutPayment({
      checkoutInit: {
        userId: 'user-1',
        travelSessionId: null,
        items: [sampleCheckoutItem({ price: 1200 })],
        currency: 'SAR',
        travelers: [],
        couponCode: null,
      },
      customerEmail: null,
      customerName: null,
      returnUrl: 'https://app.example/return',
    })

    const captured = await orchestrator.captureTokenizedPayment(
      started.checkoutSession!.order.id,
      started.checkoutSession!.lockToken!,
    )
    expect(captured.success).toBe(true)
    expect(captured.paymentSession?.status).toBe('paid')
    expect(captured.order?.status).toBe('confirmed')
    expect(orchestrator.getSession(captured.paymentSession!.id)?.status).toBe('paid')
  })

  it('syncs hosted payment status through the FSM', async () => {
    const started = await orchestrator.startCheckoutPayment({
      checkoutInit: {
        userId: 'user-1',
        travelSessionId: null,
        items: [sampleCheckoutItem()],
        currency: 'SAR',
        travelers: [],
        couponCode: null,
      },
      customerEmail: null,
      customerName: null,
      returnUrl: 'https://app.example/return',
    })

    const synced = await orchestrator.syncHostedPaymentStatus(started.checkoutSession!.order.id)
    expect(synced.success).toBe(true)
    // Mock provider auto-completes hosted status to paid on refresh
    expect(['paid', 'pending', 'authorized']).toContain(synced.paymentSession?.status)
    expect(orchestrator.getSession(started.paymentSession!.id)).toBeTruthy()
  })

  it('cancels a pending payment through the orchestrator', async () => {
    const started = await orchestrator.startCheckoutPayment({
      checkoutInit: {
        userId: 'user-1',
        travelSessionId: null,
        items: [sampleCheckoutItem()],
        currency: 'SAR',
        travelers: [],
        couponCode: null,
      },
      customerEmail: null,
      customerName: null,
      returnUrl: 'https://app.example/return',
    })

    const cancelled = await orchestrator.cancelOrderPayment(
      started.checkoutSession!.order.id,
      started.checkoutSession!.lockToken,
    )
    expect(cancelled.success).toBe(true)
    expect(cancelled.order?.status).toBe('cancelled')
    expect(orchestrator.getSession(started.paymentSession!.id)?.status).toBe('cancelled')
  })
})

describe('Phase S booking ↔ payment integration (library)', () => {
  beforeEach(() => {
    clearAllOrders()
    clearAllLocks()
    clearCoupons()
    resetPaymentOrchestrator()
    resetBookingOrchestrator()
  })

  afterEach(() => {
    resetPaymentOrchestrator()
    resetBookingOrchestrator()
  })

  it('maps booking items into checkout items without UI side effects', () => {
    const bookingItem: BookingItem = {
      id: 'b1',
      type: 'hotel',
      providerId: 'booking_com',
      providerName: 'Booking.com',
      providerOfferId: 'H1',
      title: 'Tokyo Central',
      price: 900,
      currency: 'USD',
      bookingUrl: 'https://example.com/h',
      bookingMode: 'redirect',
      expiresAt: null,
      travelerSummary: '2 adults',
      selectedAt: new Date().toISOString(),
      metadata: { area: 'Shinjuku' },
    }
    const checkoutItem = bookingItemToCheckoutItem(bookingItem)
    expect(checkoutItem).toMatchObject({
      id: 'b1',
      type: 'hotel',
      providerId: 'booking_com',
      title: 'Tokyo Central',
      price: 900,
      metadata: expect.objectContaining({ source: 'booking_session', area: 'Shinjuku' }),
    })
  })

  it('prepares booking payment and starts PaymentOrchestrator flow', async () => {
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
      providerName: 'Amadeus',
      providerOfferId: 'F1',
      title: 'RUH → HND',
      price: 2200,
      currency: 'SAR',
      bookingUrl: 'https://example.com/f',
      expiresAt: null,
      travelerSummary: '1 adult',
      metadata: {},
    })
    const updated = booking.getBookingSession(session.id)!
    const prepared = prepareBookingPayment({
      bookingSession: updated,
      returnUrl: 'https://app.example/checkout/return',
      customerEmail: 'a@example.com',
      customerName: 'Ahmed',
    })
    expect(prepared.itemCount).toBe(1)
    expect(prepared.checkoutInit.items[0]?.title).toBe('RUH → HND')

    const orchestrator = new PaymentOrchestrator({
      adapter: createMockPaymentAdapter(),
      persist: false,
    })
    const started = await orchestrator.startFromBooking({
      bookingSession: updated,
      returnUrl: 'https://app.example/checkout/return',
      customerEmail: 'a@example.com',
      customerName: 'Ahmed',
    })
    expect(started.success).toBe(true)
    expect(started.bookingSessionId).toBe(updated.id)
    expect(started.paymentSession?.status).toBe('pending')
    expect(orchestrator.getBookingSessionIdForOrder(started.checkoutSession!.order.id)).toBe(updated.id)
  })

  it('does not import or mutate TripPlan APIs', async () => {
    // Structural guard: orchestration module surface stays payment/booking scoped.
    const mod = await import('../payment/orchestration')
    expect(mod.PaymentOrchestrator).toBeTypeOf('function')
    expect(mod.prepareBookingPayment).toBeTypeOf('function')
    expect(Object.keys(mod)).not.toContain('buildTripPlan')
    expect(Object.keys(mod)).not.toContain('TravelAgentService')
  })
})
