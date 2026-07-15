import { describe, it, expect, beforeEach } from 'vitest'
import { CheckoutOrchestrator } from '../payment/checkoutOrchestrator'
import { MockPaymentProvider } from '../payment/mockPaymentProvider'
import { clearAllOrders } from '../payment/orderManager'
import { clearAllLocks, releaseLock } from '../payment/bookingLock'
import { clearCoupons } from '../payment/couponValidator'
import type { CheckoutItem, TravelerInfo } from '../payment/checkoutTypes'

function sampleItem(overrides: Partial<CheckoutItem> = {}): CheckoutItem {
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

function sampleTraveler(): TravelerInfo {
  return {
    id: 't1',
    firstName: 'Ahmed',
    lastName: 'Al-Saud',
    dateOfBirth: null,
    passportNumber: 'A12345678',
    passportExpiry: null,
    nationality: 'Saudi',
    type: 'adult',
  }
}

// ── Checkout Orchestrator Integration Tests ──────────────────────────────────

describe('CheckoutOrchestrator', () => {
  let orchestrator: CheckoutOrchestrator

  beforeEach(() => {
    clearAllOrders()
    clearAllLocks()
    clearCoupons()
    orchestrator = new CheckoutOrchestrator(new MockPaymentProvider(), { persist: false })
  })

  it('initiates checkout and creates order with lock', async () => {
    const session = await orchestrator.initiateCheckout({
      userId: 'user-1',
      travelSessionId: null,
      items: [sampleItem()],
      currency: 'SAR',
      travelers: [sampleTraveler()],
      couponCode: null,
    })
    expect(session.order).toBeTruthy()
    expect(session.order.status).toBe('created')
    expect(session.lockToken).not.toBeNull()
    expect(session.cart.total).toBeGreaterThan(0)
  })

  it('creates payment session for order', async () => {
    const session = await orchestrator.initiateCheckout({
      userId: 'user-1',
      travelSessionId: null,
      items: [sampleItem()],
      currency: 'SAR',
      travelers: [],
      couponCode: null,
    })
    const result = await orchestrator.createPaymentSession(session.order.id, 'test@test.com', 'Test', 'https://example.com/return')
    expect(result.success).toBe(true)
    expect(result.paymentSession).not.toBeNull()
    expect(result.paymentSession!.status).toBe('pending')
    expect(result.order!.status).toBe('pending_payment')
  })

  it('executes full payment flow: authorize then capture then confirm', async () => {
    const session = await orchestrator.initiateCheckout({
      userId: 'user-1',
      travelSessionId: null,
      items: [sampleItem()],
      currency: 'SAR',
      travelers: [sampleTraveler()],
      couponCode: null,
    })
    await orchestrator.createPaymentSession(session.order.id, null, null, 'https://example.com/return')
    const result = await orchestrator.executePayment(session.order.id, session.lockToken!, { tokenizedCard: true })
    expect(result.success).toBe(true)
    expect(result.order!.status).toBe('confirmed')
    expect(result.order!.paidAt).not.toBeNull()
    expect(result.order!.confirmedAt).not.toBeNull()
    expect(result.invoice).not.toBeNull()
    expect(result.itinerary).not.toBeNull()
  })

  it('prevents duplicate payment with lock', async () => {
    const session = await orchestrator.initiateCheckout({
      userId: 'user-1',
      travelSessionId: null,
      items: [sampleItem()],
      currency: 'SAR',
      travelers: [],
      couponCode: null,
    })
    await orchestrator.createPaymentSession(session.order.id, null, null, 'https://example.com/return')
    const result1 = await orchestrator.executePayment(session.order.id, session.lockToken!, { tokenizedCard: true })
    expect(result1.success).toBe(true)
    // Second attempt with same lock token should fail — lock released after first payment
    const result2 = await orchestrator.executePayment(session.order.id, session.lockToken!, { tokenizedCard: true })
    expect(result2.success).toBe(false)
  })

  it('fails payment for non-existent order', async () => {
    const result = await orchestrator.createPaymentSession('non-existent', null, null, '')
    expect(result.success).toBe(false)
    expect(result.message).toContain('Order not found')
  })

  it('fails executePayment without valid lock token', async () => {
    const session = await orchestrator.initiateCheckout({
      userId: 'user-1',
      travelSessionId: null,
      items: [sampleItem()],
      currency: 'SAR',
      travelers: [],
      couponCode: null,
    })
    await orchestrator.createPaymentSession(session.order.id, null, null, 'https://example.com/return')
    const result = await orchestrator.executePayment(session.order.id, 'invalid-token', { tokenizedCard: true })
    expect(result.success).toBe(false)
    expect(result.message).toContain('lock')
  })

  it('cancels checkout and releases lock', async () => {
    const session = await orchestrator.initiateCheckout({
      userId: 'user-1',
      travelSessionId: null,
      items: [sampleItem()],
      currency: 'SAR',
      travelers: [],
      couponCode: null,
    })
    const result = await orchestrator.cancelCheckout(session.order.id, session.lockToken)
    expect(result.success).toBe(true)
    expect(result.order!.status).toBe('cancelled')
  })

  it('retries failed payment after releasing lock', async () => {
    const session = await orchestrator.initiateCheckout({
      userId: 'user-1',
      travelSessionId: null,
      items: [sampleItem()],
      currency: 'SAR',
      travelers: [],
      couponCode: null,
    })
    await orchestrator.createPaymentSession(session.order.id, null, null, 'https://example.com/return')
    // Execute payment with wrong lock token to cause failure
    const failedResult = await orchestrator.executePayment(session.order.id, 'wrong-token', { tokenizedCard: true })
    expect(failedResult.success).toBe(false)
    // Release the original lock so retry can acquire a new one
    releaseLock(session.order.id, session.lockToken!)
    // Retry should now work
    const retryResult = await orchestrator.retryPayment(session.order.id)
    expect(retryResult.success).toBe(true)
  })

  it('recovers abandoned checkout with active lock (resumed)', async () => {
    const session = await orchestrator.initiateCheckout({
      userId: 'user-1',
      travelSessionId: null,
      items: [sampleItem()],
      currency: 'SAR',
      travelers: [],
      couponCode: null,
    })
    const result = await orchestrator.recoverAbandonedCheckout(session.order.id)
    expect(result.success).toBe(true)
    expect(result.message).toContain('resumed')
  })

  it('recovers abandoned checkout with no lock (new lock acquired)', async () => {
    const session = await orchestrator.initiateCheckout({
      userId: 'user-1',
      travelSessionId: null,
      items: [sampleItem()],
      currency: 'SAR',
      travelers: [],
      couponCode: null,
    })
    // Release the lock to simulate an abandoned checkout
    releaseLock(session.order.id, session.lockToken!)
    const result = await orchestrator.recoverAbandonedCheckout(session.order.id)
    expect(result.success).toBe(true)
    expect(result.message).toContain('recovered')
  })

  it('cannot recover a cancelled order', async () => {
    const session = await orchestrator.initiateCheckout({
      userId: 'user-1',
      travelSessionId: null,
      items: [sampleItem()],
      currency: 'SAR',
      travelers: [],
      couponCode: null,
    })
    await orchestrator.cancelCheckout(session.order.id, session.lockToken)
    const result = await orchestrator.recoverAbandonedCheckout(session.order.id)
    expect(result.success).toBe(false)
    expect(result.message).toContain('cancelled')
  })

  it('cannot retry a paid order', async () => {
    const session = await orchestrator.initiateCheckout({
      userId: 'user-1',
      travelSessionId: null,
      items: [sampleItem()],
      currency: 'SAR',
      travelers: [],
      couponCode: null,
    })
    await orchestrator.createPaymentSession(session.order.id, null, null, 'https://example.com/return')
    await orchestrator.executePayment(session.order.id, session.lockToken!, { tokenizedCard: true })
    const retry = await orchestrator.retryPayment(session.order.id)
    expect(retry.success).toBe(false)
    expect(retry.message).toContain('already paid')
  })

  it('generates invoice after successful payment', async () => {
    const session = await orchestrator.initiateCheckout({
      userId: 'user-1',
      travelSessionId: null,
      items: [sampleItem(), sampleItem({ id: 'i2', type: 'hotel', title: 'Hilton', price: 850 })],
      currency: 'SAR',
      travelers: [sampleTraveler()],
      couponCode: null,
    })
    await orchestrator.createPaymentSession(session.order.id, null, null, 'https://example.com/return')
    const result = await orchestrator.executePayment(session.order.id, session.lockToken!, { tokenizedCard: true })
    expect(result.invoice).not.toBeNull()
    expect(result.invoice!.lines.length).toBeGreaterThan(2)
    expect(result.invoice!.total).toBe(result.order!.cart.total)
  })

  it('generates itinerary after successful payment', async () => {
    const session = await orchestrator.initiateCheckout({
      userId: 'user-1',
      travelSessionId: null,
      items: [sampleItem(), sampleItem({ id: 'i2', type: 'hotel', title: 'Hilton', price: 850 })],
      currency: 'SAR',
      travelers: [sampleTraveler()],
      couponCode: null,
    })
    await orchestrator.createPaymentSession(session.order.id, null, null, 'https://example.com/return')
    const result = await orchestrator.executePayment(session.order.id, session.lockToken!, { tokenizedCard: true })
    expect(result.itinerary).not.toBeNull()
    expect(result.itinerary!.segments.length).toBe(2)
    expect(result.itinerary!.travelers.length).toBe(1)
  })

  it('order is created before payment authorization', async () => {
    const session = await orchestrator.initiateCheckout({
      userId: 'user-1',
      travelSessionId: null,
      items: [sampleItem()],
      currency: 'SAR',
      travelers: [],
      couponCode: null,
    })
    // Order exists before payment
    expect(session.order.status).toBe('created')
    expect(session.order.orderNumber).toMatch(/^RH-/)
    expect(session.order.bookingNumber).toMatch(/^BK-/)
    expect(session.order.customerReference).toMatch(/^CUST-/)
    // After createPaymentSession, status moves to pending_payment
    const payResult = await orchestrator.createPaymentSession(session.order.id, null, null, 'https://example.com/return')
    expect(payResult.order!.status).toBe('pending_payment')
    // After executePayment, status moves to confirmed
    const execResult = await orchestrator.executePayment(session.order.id, session.lockToken!, { tokenizedCard: true })
    expect(execResult.order!.status).toBe('confirmed')
  })

  it('preserves cart items through full flow', async () => {
    const session = await orchestrator.initiateCheckout({
      userId: 'user-1',
      travelSessionId: null,
      items: [sampleItem(), sampleItem({ id: 'i2', type: 'hotel', title: 'Hilton', price: 850 })],
      currency: 'SAR',
      travelers: [],
      couponCode: null,
    })
    await orchestrator.createPaymentSession(session.order.id, null, null, 'https://example.com/return')
    const result = await orchestrator.executePayment(session.order.id, session.lockToken!, { tokenizedCard: true })
    expect(result.order!.cart.items.length).toBe(2)
    expect(result.order!.cart.items[0].title).toBe('JAL 462: RUH → NRT')
    expect(result.order!.cart.items[1].title).toBe('Hilton')
  })

  it('blocks legacy executePayment on normal checkout without tokenizedCard', async () => {
    const session = await orchestrator.initiateCheckout({
      userId: 'user-1',
      travelSessionId: null,
      items: [sampleItem()],
      currency: 'SAR',
      travelers: [],
      couponCode: null,
    })
    const created = await orchestrator.createPaymentSession(
      session.order.id,
      null,
      null,
      'https://example.com/checkout/return?orderId=x',
    )
    expect(created.paymentSession?.redirectUrl).toBeTruthy()

    const blocked = await orchestrator.executePayment(session.order.id, session.lockToken!)
    expect(blocked.success).toBe(false)
    expect(blocked.message).toMatch(/Hosted Moyasar|tokenizedCard/i)
  })

  it('hosted flow: create → redirect URL → refreshPaymentStatus success', async () => {
    const session = await orchestrator.initiateCheckout({
      userId: 'user-1',
      travelSessionId: null,
      items: [sampleItem()],
      currency: 'SAR',
      travelers: [sampleTraveler()],
      couponCode: null,
    })
    const returnUrl = `https://rahhal.app/checkout/return?orderId=${session.order.id}`
    const created = await orchestrator.createPaymentSession(
      session.order.id,
      'a@test.com',
      'Ahmed',
      returnUrl,
    )
    expect(created.success).toBe(true)
    expect(created.paymentSession?.redirectUrl).toBe(returnUrl)
    expect(created.order?.status).toBe('pending_payment')

    const refreshed = await orchestrator.refreshPaymentStatus(session.order.id)
    expect(refreshed.success).toBe(true)
    expect(refreshed.paymentSession?.status).toBe('paid')
    expect(refreshed.order?.status).toBe('confirmed')
  })
})
