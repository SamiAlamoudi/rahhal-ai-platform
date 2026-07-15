import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  saveCheckoutReturnContext,
  loadCheckoutReturnContext,
  clearCheckoutReturnContext,
  isHostedMoyasarPaymentUrl,
  buildCheckoutReturnUrl,
  resolveOrderIdFromReturn,
  resolvePaymentIdFromReturn,
  chooseCheckoutOutcomeRoute,
  orderStatusFromMoyasarPayment,
} from '../payment/moyasarCheckout'

function installMemorySessionStorage() {
  const store = new Map<string, string>()
  const memory = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size },
  }
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: memory,
  })
  return memory
}

describe('moyasarCheckout helpers', () => {
  beforeEach(() => {
    installMemorySessionStorage()
    clearCheckoutReturnContext()
  })

  afterEach(() => {
    clearCheckoutReturnContext()
  })

  it('persists and loads checkout return context', () => {
    saveCheckoutReturnContext({
      orderId: 'ord-1',
      lockToken: 'lock-1',
      paymentSessionId: 'pay-1',
    })
    expect(loadCheckoutReturnContext()).toEqual({
      orderId: 'ord-1',
      lockToken: 'lock-1',
      paymentSessionId: 'pay-1',
    })
    clearCheckoutReturnContext()
    expect(loadCheckoutReturnContext()).toBeNull()
  })

  it('accepts only https Moyasar hosted payment URLs', () => {
    expect(isHostedMoyasarPaymentUrl('https://invoice.moyasar.com/i/abc')).toBe(true)
    expect(isHostedMoyasarPaymentUrl('https://payments.moyasar.com/checkout')).toBe(true)
    expect(isHostedMoyasarPaymentUrl('https://moyasar.com/pay/x')).toBe(true)
    expect(isHostedMoyasarPaymentUrl('http://invoice.moyasar.com/i/abc')).toBe(false)
    expect(isHostedMoyasarPaymentUrl('https://evil.com/moyasar')).toBe(false)
    expect(isHostedMoyasarPaymentUrl('not-a-url')).toBe(false)
    expect(isHostedMoyasarPaymentUrl(null)).toBe(false)
  })

  it('builds return URL with orderId', () => {
    expect(buildCheckoutReturnUrl('https://rahhal.app/', 'ord-99')).toBe(
      'https://rahhal.app/checkout/return?orderId=ord-99',
    )
  })

  it('resolves order/payment ids from query or session storage', () => {
    saveCheckoutReturnContext({
      orderId: 'stored-order',
      lockToken: null,
      paymentSessionId: 'stored-pay',
    })
    const stored = loadCheckoutReturnContext()
    expect(resolveOrderIdFromReturn(new URLSearchParams('orderId=q-order'), stored)).toBe('q-order')
    expect(resolveOrderIdFromReturn(new URLSearchParams(''), stored)).toBe('stored-order')
    expect(resolvePaymentIdFromReturn(new URLSearchParams('id=pay_x'), stored)).toBe('pay_x')
    expect(resolvePaymentIdFromReturn(new URLSearchParams('invoice_id=inv_1'), stored)).toBe('inv_1')
    expect(resolvePaymentIdFromReturn(new URLSearchParams(''), stored)).toBe('stored-pay')
  })

  it('routes success / failure / pending from Moyasar statuses', () => {
    expect(chooseCheckoutOutcomeRoute('paid', null)).toBe('/checkout/success')
    expect(chooseCheckoutOutcomeRoute('captured', null)).toBe('/checkout/success')
    expect(chooseCheckoutOutcomeRoute('failed', null)).toBe('/checkout/failure')
    expect(chooseCheckoutOutcomeRoute('cancelled', null)).toBe('/checkout/failure')
    expect(chooseCheckoutOutcomeRoute('expired', null)).toBe('/checkout/failure')
    expect(chooseCheckoutOutcomeRoute('pending', null)).toBe('/checkout/return')
    expect(chooseCheckoutOutcomeRoute(null, 'paid')).toBe('/checkout/success')
  })

  it('maps Moyasar payment status onto order status', () => {
    expect(orderStatusFromMoyasarPayment('paid')).toBe('paid')
    expect(orderStatusFromMoyasarPayment('captured')).toBe('paid')
    expect(orderStatusFromMoyasarPayment('failed')).toBe('failed')
    expect(orderStatusFromMoyasarPayment('cancelled')).toBe('cancelled')
    expect(orderStatusFromMoyasarPayment('pending')).toBe('pending_payment')
  })
})

describe('Moyasar hosted sandbox E2E (mocked provider)', () => {
  it('covers create → redirect URL → success / failure / cancel status mapping', async () => {
    const { MoyasarPaymentProvider } = await import('../payment/moyasarPaymentProvider')
    const { CheckoutOrchestrator } = await import('../payment/checkoutOrchestrator')
    const { clearAllOrders } = await import('../payment/orderManager')
    const { clearAllLocks } = await import('../payment/bookingLock')
    const { clearCoupons } = await import('../payment/couponValidator')
    const { vi } = await import('vitest')

    clearAllOrders()
    clearAllLocks()
    clearCoupons()

    function mockEdgeResponse(data: unknown, status = 200): Response {
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => data,
      } as Response
    }

    const statuses = ['paid', 'failed', 'cancelled'] as const
    for (const terminal of statuses) {
      clearAllOrders()
      clearAllLocks()

      const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as { action?: string }
        if (body.action === 'create_session') {
          return Promise.resolve(mockEdgeResponse({
            paymentSessionId: `inv_${terminal}`,
            status: 'pending',
            providerReference: `inv_${terminal}`,
            redirectUrl: `https://invoice.moyasar.com/i/${terminal}`,
            message: 'created',
            kind: 'invoice',
          }))
        }
        if (body.action === 'status') {
          return Promise.resolve(mockEdgeResponse({
            paymentSessionId: `inv_${terminal}`,
            status: terminal,
            providerReference: `inv_${terminal}`,
          }))
        }
        return Promise.resolve(mockEdgeResponse({ error: 'unexpected' }, 400))
      })
      vi.stubGlobal('fetch', fetchMock)

      const moyasar = new MoyasarPaymentProvider(null, {
        supabaseUrl: 'https://example.supabase.co',
        invokeApiKey: 'test-anon-key',
      })
      const orchestrator = new CheckoutOrchestrator(moyasar, { persist: false })

      const session = await orchestrator.initiateCheckout({
        userId: 'user-e2e',
        travelSessionId: null,
        items: [{
          id: 'item-1',
          type: 'flight',
          providerId: 'amadeus-1',
          providerName: 'Amadeus',
          providerOfferId: 'offer-1',
          title: 'RUH → TYO',
          price: 1000,
          currency: 'SAR',
          bookingUrl: 'https://example.com/book',
          expiresAt: null,
          travelerSummary: '1 adult',
          metadata: {},
        }],
        currency: 'SAR',
        travelers: [],
        couponCode: null,
      })

      const returnUrl = buildCheckoutReturnUrl('https://rahhal.app', session.order.id)
      const created = await orchestrator.createPaymentSession(
        session.order.id,
        null,
        null,
        returnUrl,
      )
      expect(created.success).toBe(true)
      expect(isHostedMoyasarPaymentUrl(created.paymentSession?.redirectUrl)).toBe(true)

      const routeBefore = chooseCheckoutOutcomeRoute(created.paymentSession?.status, null)
      expect(routeBefore).toBe('/checkout/return')

      const refreshed = await orchestrator.refreshPaymentStatus(session.order.id)
      const route = chooseCheckoutOutcomeRoute(refreshed.paymentSession?.status, terminal)

      if (terminal === 'paid') {
        expect(refreshed.order?.status).toBe('confirmed')
        expect(route).toBe('/checkout/success')
      } else if (terminal === 'failed') {
        expect(refreshed.order?.status).toBe('failed')
        expect(route).toBe('/checkout/failure')
      } else {
        expect(refreshed.order?.status).toBe('cancelled')
        expect(route).toBe('/checkout/failure')
      }

      vi.unstubAllGlobals()
    }
  })
})
