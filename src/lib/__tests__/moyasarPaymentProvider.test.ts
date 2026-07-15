import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  MoyasarPaymentProvider,
  mapMoyasarStatus,
  resolveMoyasarPaymentUrl,
} from '../payment/moyasarPaymentProvider'
import {
  createPaymentProvider,
  resetPaymentProviderFactory,
  getDefaultPaymentProviderType,
} from '../payment/paymentProviderFactory'
import { CheckoutOrchestrator } from '../payment/checkoutOrchestrator'
import { clearAllOrders } from '../payment/orderManager'
import { clearAllLocks } from '../payment/bookingLock'
import { clearCoupons } from '../payment/couponValidator'
import type { PaymentRequest } from '../payment/paymentTypes'
import type { CheckoutItem } from '../payment/checkoutTypes'

function samplePaymentRequest(overrides: Partial<PaymentRequest> = {}): PaymentRequest {
  return {
    orderId: 'order-001',
    orderNumber: 'RH-20260715-AB123',
    amount: 11155,
    currency: 'SAR',
    description: 'Rahhal Order RH-20260715-AB123',
    customerEmail: 'test@example.com',
    customerName: 'Test User',
    returnUrl: 'https://rahhal.app/checkout/success',
    metadata: { bookingNumber: 'BK-1' },
    ...overrides,
  }
}

function mockEdgeResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response
}

function sampleItem(): CheckoutItem {
  return {
    id: 'item-1',
    type: 'flight',
    providerId: 'amadeus-1',
    providerName: 'Amadeus',
    providerOfferId: 'offer-1',
    title: 'RUH → TYO',
    price: 5500,
    currency: 'SAR',
    bookingUrl: 'https://example.com/book',
    expiresAt: null,
    travelerSummary: '2 adults',
    metadata: {},
  }
}

describe('mapMoyasarStatus', () => {
  it('maps paid / pending / failed / cancelled states', () => {
    expect(mapMoyasarStatus('paid')).toBe('paid')
    expect(mapMoyasarStatus('captured')).toBe('paid')
    expect(mapMoyasarStatus('pending')).toBe('pending')
    expect(mapMoyasarStatus('initiated')).toBe('pending')
    expect(mapMoyasarStatus('failed')).toBe('failed')
    expect(mapMoyasarStatus('cancelled')).toBe('cancelled')
    expect(mapMoyasarStatus('canceled')).toBe('cancelled')
    expect(mapMoyasarStatus('voided')).toBe('cancelled')
  })
})

describe('MoyasarPaymentProvider', () => {
  let provider: MoyasarPaymentProvider

  beforeEach(() => {
    provider = new MoyasarPaymentProvider(null, {
      supabaseUrl: 'https://example.supabase.co',
      invokeApiKey: 'test-anon-key',
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves edge function URL from Supabase env options', () => {
    expect(resolveMoyasarPaymentUrl({
      supabaseUrl: 'https://example.supabase.co',
    })).toBe('https://example.supabase.co/functions/v1/moyasar-payment')
  })

  it('allows paymentUrl override', () => {
    expect(resolveMoyasarPaymentUrl({
      paymentUrl: 'https://example.supabase.co/functions/v1/custom-moyasar/',
    })).toBe('https://example.supabase.co/functions/v1/custom-moyasar')
  })

  it('creates a payment via the Moyasar edge proxy (mocked HTTP)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockEdgeResponse({
      paymentSessionId: 'pay_abc123',
      providerId: 'moyasar',
      status: 'pending',
      providerReference: 'pay_abc123',
      redirectUrl: 'https://moyasar.com/pay/abc',
      message: 'Moyasar payment session created',
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await provider.createPaymentSession(samplePaymentRequest())

    expect(result.success).toBe(true)
    expect(result.status).toBe('pending')
    expect(result.paymentSessionId).toBe('pay_abc123')
    expect(result.redirectUrl).toContain('moyasar.com')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/functions/v1/moyasar-payment')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer test-anon-key')
    expect(headers.apikey).toBe('test-anon-key')
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.action).toBe('create_session')
    expect(body.amount).toBe(11155)
    expect(body.currency).toBe('SAR')
    expect(body.successUrl).toBe('https://rahhal.app/checkout/success')
    expect(body.backUrl).toBe('https://rahhal.app/checkout/success')
  })

  it('returns a hosted invoice.moyasar.com URL for redirect', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockEdgeResponse({
      paymentSessionId: 'inv_abc123',
      providerId: 'moyasar',
      status: 'pending',
      providerReference: 'inv_abc123',
      redirectUrl: 'https://invoice.moyasar.com/i/abc123',
      message: 'Moyasar hosted payment session created',
      kind: 'invoice',
    })))

    const result = await provider.createPaymentSession(samplePaymentRequest({
      returnUrl: 'https://rahhal.app/checkout/return?orderId=order-001',
    }))

    expect(result.success).toBe(true)
    expect(result.redirectUrl).toBe('https://invoice.moyasar.com/i/abc123')
    expect(result.redirectUrl).toMatch(/\.moyasar\.com/)
  })

  it('retrieves payment status (paid)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockEdgeResponse({
      paymentSessionId: 'pay_abc123',
      status: 'paid',
      providerReference: 'pay_abc123',
    })))
    const status = await provider.getPaymentStatus('pay_abc123')
    expect(status).toBe('paid')
  })

  it('retrieves payment status (failed / cancelled)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockEdgeResponse({
      paymentSessionId: 'pay_fail',
      status: 'failed',
    })))
    expect(await provider.getPaymentStatus('pay_fail')).toBe('failed')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockEdgeResponse({
      paymentSessionId: 'pay_cancel',
      status: 'cancelled',
    })))
    expect(await provider.getPaymentStatus('pay_cancel')).toBe('cancelled')
  })

  it('rejects invalid create requests without calling fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const badAmount = await provider.createPaymentSession(samplePaymentRequest({ amount: 0 }))
    expect(badAmount.success).toBe(false)
    expect(badAmount.message).toContain('amount')

    const badReturn = await provider.createPaymentSession(samplePaymentRequest({ returnUrl: '' }))
    expect(badReturn.success).toBe(false)
    expect(badReturn.message).toContain('returnUrl')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('handles edge/network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const result = await provider.createPaymentSession(samplePaymentRequest())
    expect(result.success).toBe(false)
    expect(result.status).toBe('failed')
    expect(result.metadata.code).toBe('MOYASAR_NETWORK')
  })

  it('maps HTTP errors from the edge function', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockEdgeResponse({
      error: 'Moyasar create payment failed',
      code: 'MOYASAR_CREATE_FAILED',
    }, 502)))
    const result = await provider.createPaymentSession(samplePaymentRequest())
    expect(result.success).toBe(false)
    expect(result.status).toBe('failed')
    expect(result.message).toContain('create payment failed')
  })
})

describe('PaymentProviderFactory — Moyasar', () => {
  beforeEach(() => {
    resetPaymentProviderFactory()
  })

  it('creates Moyasar when requested', () => {
    const provider = createPaymentProvider('moyasar')
    expect(provider.providerId).toBe('moyasar')
    expect(provider.displayName).toBe('Moyasar')
  })

  it('reads VITE_PAYMENT_PROVIDER when set to moyasar', () => {
    const previous = import.meta.env.VITE_PAYMENT_PROVIDER
    // Vitest exposes import.meta.env as a mutable object for VITE_* keys.
    ;(import.meta.env as Record<string, string>).VITE_PAYMENT_PROVIDER = 'moyasar'
    try {
      expect(getDefaultPaymentProviderType()).toBe('moyasar')
    } finally {
      if (previous === undefined) {
        delete (import.meta.env as Record<string, string | undefined>).VITE_PAYMENT_PROVIDER
      } else {
        ;(import.meta.env as Record<string, string>).VITE_PAYMENT_PROVIDER = previous
      }
    }
  })
})

describe('CheckoutOrchestrator + Moyasar persistence', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    clearAllOrders()
    clearAllLocks()
    clearCoupons()
  })

  it('creates a Moyasar payment and refreshes status onto the checkout session', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { action?: string }
      if (body.action === 'create_session') {
        return Promise.resolve(mockEdgeResponse({
          paymentSessionId: 'pay_live_1',
          status: 'pending',
          providerReference: 'pay_live_1',
          redirectUrl: 'https://moyasar.com/pay/live_1',
          message: 'created',
        }))
      }
      if (body.action === 'status') {
        return Promise.resolve(mockEdgeResponse({
          paymentSessionId: 'pay_live_1',
          status: 'paid',
          providerReference: 'pay_live_1',
        }))
      }
      return Promise.resolve(mockEdgeResponse({ error: 'unexpected' }, 400))
    })
    vi.stubGlobal('fetch', fetchMock)

    const moyasar = new MoyasarPaymentProvider(null, {
      supabaseUrl: 'https://example.supabase.co',
      invokeApiKey: 'test-anon-key',
    })
    // persist:false — unit test validates orchestration without Supabase DB
    const orchestrator = new CheckoutOrchestrator(moyasar, { persist: false })

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
      't@example.com',
      'Test',
      'https://rahhal.app/checkout/success',
    )
    expect(created.success).toBe(true)
    expect(created.paymentSession?.providerId).toBe('moyasar')
    expect(created.paymentSession?.status).toBe('pending')
    expect(created.order?.status).toBe('pending_payment')

    const refreshed = await orchestrator.refreshPaymentStatus(session.order.id)
    expect(refreshed.success).toBe(true)
    expect(refreshed.paymentSession?.status).toBe('paid')
    expect(refreshed.order?.status).toBe('confirmed')
  })
})
