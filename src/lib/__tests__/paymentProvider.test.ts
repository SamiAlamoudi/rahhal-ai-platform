import { describe, it, expect, beforeEach } from 'vitest'
import { MockPaymentProvider } from '../payment/mockPaymentProvider'
import { createPaymentProvider, resetPaymentProviderFactory, getDefaultPaymentProviderType } from '../payment/paymentProviderFactory'
import type { PaymentRequest } from '../payment/paymentTypes'

function samplePaymentRequest(overrides: Partial<PaymentRequest> = {}): PaymentRequest {
  return {
    orderId: 'order-001',
    orderNumber: 'RH-20260713-AB123',
    amount: 6800,
    currency: 'SAR',
    description: 'Bilamo Order RH-20260713-AB123',
    customerEmail: 'test@example.com',
    customerName: 'Test User',
    returnUrl: 'https://rahhal.app/checkout/success',
    metadata: {},
    ...overrides,
  }
}

// ── MockPaymentProvider Tests ────────────────────────────────────────────────

describe('MockPaymentProvider', () => {
  let provider: MockPaymentProvider

  beforeEach(() => {
    provider = new MockPaymentProvider()
  })

  it('creates a payment session with pending status and hosted return URL', async () => {
    const result = await provider.createPaymentSession(samplePaymentRequest())
    expect(result.success).toBe(true)
    expect(result.status).toBe('pending')
    expect(result.paymentSessionId).toBeTruthy()
    expect(result.providerReference).toBeTruthy()
    expect(result.redirectUrl).toBe('https://rahhal.app/checkout/success')
  })

  it('authorizes a payment session', async () => {
    const created = await provider.createPaymentSession(samplePaymentRequest())
    const authResult = await provider.authorizePayment(created.paymentSessionId)
    expect(authResult.success).toBe(true)
    expect(authResult.status).toBe('authorized')
    expect(authResult.authorizationCode).toBeTruthy()
  })

  it('captures an authorized payment', async () => {
    const created = await provider.createPaymentSession(samplePaymentRequest())
    await provider.authorizePayment(created.paymentSessionId)
    const captureResult = await provider.capturePayment(created.paymentSessionId)
    expect(captureResult.success).toBe(true)
    expect(captureResult.status).toBe('paid')
    expect(captureResult.paidAt).not.toBeNull()
  })

  it('refunds a paid payment', async () => {
    const created = await provider.createPaymentSession(samplePaymentRequest())
    await provider.authorizePayment(created.paymentSessionId)
    await provider.capturePayment(created.paymentSessionId)
    const refundResult = await provider.refundPayment({
      paymentId: created.paymentSessionId,
      amount: 6800,
      currency: 'SAR',
      reason: 'Customer requested refund',
    })
    expect(refundResult.success).toBe(true)
    expect(refundResult.refundedAmount).toBe(6800)
  })

  it('fails to authorize non-existent session', async () => {
    const result = await provider.authorizePayment('non-existent')
    expect(result.success).toBe(false)
    expect(result.status).toBe('failed')
  })

  it('fails to refund a non-paid payment', async () => {
    const created = await provider.createPaymentSession(samplePaymentRequest())
    const refundResult = await provider.refundPayment({
      paymentId: created.paymentSessionId,
      amount: 100,
      currency: 'SAR',
      reason: 'test',
    })
    expect(refundResult.success).toBe(false)
  })

  it('simulates hosted payment completion on status refresh', async () => {
    const created = await provider.createPaymentSession(samplePaymentRequest())
    expect(created.status).toBe('pending')
    const status = await provider.getPaymentStatus(created.paymentSessionId)
    expect(status).toBe('paid')
  })

  it('returns null status for non-existent session', async () => {
    const status = await provider.getPaymentStatus('non-existent')
    expect(status).toBeNull()
  })
})

// ── PaymentProviderFactory Tests ─────────────────────────────────────────────

describe('PaymentProviderFactory', () => {
  beforeEach(() => {
    resetPaymentProviderFactory()
  })

  it('creates mock provider', () => {
    const provider = createPaymentProvider('mock')
    expect(provider.providerId).toBe('mock')
  })

  it('caches provider instances', () => {
    const p1 = createPaymentProvider('mock')
    const p2 = createPaymentProvider('mock')
    expect(p1).toBe(p2)
  })

  it('creates moyasar provider', () => {
    const provider = createPaymentProvider('moyasar')
    expect(provider.providerId).toBe('moyasar')
  })

  it('creates future-ready sandbox stubs for stripe/hyperpay/checkout_com (Sprint 67)', () => {
    const stripe = createPaymentProvider('stripe')
    expect(stripe.providerId).toBe('stripe')
    expect(stripe.displayName.toLowerCase()).toContain('sandbox')
    const hyperpay = createPaymentProvider('hyperpay')
    expect(hyperpay.providerId).toBe('hyperpay')
    const checkout = createPaymentProvider('checkout_com')
    expect(checkout.providerId).toBe('checkout_com')
  })

  it('returns mock as default provider type', () => {
    expect(getDefaultPaymentProviderType()).toBe('mock')
  })
})
