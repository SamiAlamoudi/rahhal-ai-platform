/**
 * Mock payment provider adapters — Sprint 58.
 * Common interface for every method; no real gateways.
 */

import type {
  PaymentChargeInput,
  PaymentMethod,
  PaymentProviderAdapter,
  PaymentProviderId,
  PaymentRefundInput,
  PaymentRefundResult,
} from './types'

function createMockAdapter(input: {
  providerId: PaymentProviderId
  method: PaymentMethod
  displayName: string
  failAuthorize?: boolean
  failCapture?: boolean
}): PaymentProviderAdapter {
  const authorized = new Map<string, PaymentChargeInput>()

  return {
    providerId: input.providerId,
    method: input.method,
    displayName: input.displayName,
    isAvailable: () => true,
    async authorize(charge) {
      const started = Date.now()
      if (input.failAuthorize) {
        return {
          ok: false,
          providerId: input.providerId,
          providerRef: null,
          status: 'failed',
          error: 'authorize_declined',
          latencyMs: Date.now() - started,
        }
      }
      const providerRef = `${input.providerId}_${charge.idempotencyKey}`
      authorized.set(providerRef, charge)
      return {
        ok: true,
        providerId: input.providerId,
        providerRef,
        status: 'authorized',
        authorizedAmount: charge.amount,
        capturedAmount: 0,
        latencyMs: Date.now() - started,
        raw: { mock: true, method: input.method },
      }
    },
    async capture(charge) {
      const started = Date.now()
      if (input.failCapture || !authorized.has(charge.providerRef)) {
        return {
          ok: false,
          providerId: input.providerId,
          providerRef: charge.providerRef,
          status: 'failed',
          error: input.failCapture ? 'capture_declined' : 'missing_authorization',
          latencyMs: Date.now() - started,
        }
      }
      const amount = charge.amount ?? authorized.get(charge.providerRef)!.amount
      return {
        ok: true,
        providerId: input.providerId,
        providerRef: charge.providerRef,
        status: amount < authorized.get(charge.providerRef)!.amount
          ? 'partially_captured'
          : 'captured',
        authorizedAmount: authorized.get(charge.providerRef)!.amount,
        capturedAmount: amount,
        latencyMs: Date.now() - started,
        raw: { mock: true, captured: true },
      }
    },
    async refund(refund: PaymentRefundInput): Promise<PaymentRefundResult> {
      const started = Date.now()
      return {
        ok: true,
        refundRef: `rf_${refund.providerRef}`,
        status: 'refunded',
        latencyMs: Date.now() - started,
      }
    },
    async verify(providerRef) {
      return {
        ok: authorized.has(providerRef) || providerRef.startsWith(input.providerId),
        status: authorized.has(providerRef) ? 'authorized' : 'pending',
      }
    },
  }
}

const METHOD_TO_PROVIDER: Record<PaymentMethod, PaymentProviderId> = {
  card: 'mock_card',
  apple_pay: 'mock_apple_pay',
  google_pay: 'mock_google_pay',
  mada: 'mock_mada',
  stc_pay: 'mock_stc_pay',
  tabby: 'mock_tabby',
  tamara: 'mock_tamara',
  bank_transfer: 'mock_bank_transfer',
}

export function createDefaultMockPaymentProviders(
  options?: Partial<Record<PaymentMethod, { failAuthorize?: boolean; failCapture?: boolean }>>,
): PaymentProviderAdapter[] {
  return (Object.keys(METHOD_TO_PROVIDER) as PaymentMethod[]).map((method) => {
    const providerId = METHOD_TO_PROVIDER[method]
    const override = options?.[method]
    return createMockAdapter({
      providerId,
      method,
      displayName: `Mock ${method}`,
      failAuthorize: override?.failAuthorize,
      failCapture: override?.failCapture,
    })
  })
}

export function providerIdForMethod(method: PaymentMethod): PaymentProviderId {
  return METHOD_TO_PROVIDER[method]
}

export class PaymentProviderRegistry {
  private readonly byMethod = new Map<PaymentMethod, PaymentProviderAdapter>()

  constructor(adapters: PaymentProviderAdapter[] = createDefaultMockPaymentProviders()) {
    for (const adapter of adapters) this.byMethod.set(adapter.method, adapter)
  }

  get(method: PaymentMethod): PaymentProviderAdapter | undefined {
    const adapter = this.byMethod.get(method)
    return adapter?.isAvailable() ? adapter : undefined
  }

  list(): PaymentProviderAdapter[] {
    return [...this.byMethod.values()]
  }
}
