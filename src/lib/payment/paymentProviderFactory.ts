import type { PaymentProvider, PaymentProviderConfig, PaymentProviderType } from './paymentProvider'
import { defaultProviderConfig } from './paymentProvider'
import { MockPaymentProvider } from './mockPaymentProvider'
import { MoyasarPaymentProvider } from './moyasarPaymentProvider'
import { readManagedConfig } from '../security/secrets/managedAccess'

const instances: Map<PaymentProviderType, PaymentProvider> = new Map()

/**
 * Sprint 67 — Stripe / HyperPay / Checkout.com are future-ready:
 * when live keys are not wired, fall back to MockPaymentProvider so beta
 * can activate the abstraction without throwing. Live capture remains frozen
 * via VITE_PAYMENT_PROVIDER=mock.
 */
function createFutureReadyStub(
  type: Exclude<PaymentProviderType, 'mock' | 'moyasar'>,
  cfg: PaymentProviderConfig,
): PaymentProvider {
  const mock = new MockPaymentProvider(cfg)
  return {
    providerId: type,
    displayName: `${type} (sandbox/future-ready)`,
    createPaymentSession: (req) => mock.createPaymentSession(req),
    authorizePayment: (id) => mock.authorizePayment(id),
    capturePayment: (id) => mock.capturePayment(id),
    refundPayment: (req) => mock.refundPayment(req),
    getPaymentStatus: (id) => mock.getPaymentStatus(id),
  }
}

export function createPaymentProvider(
  type: PaymentProviderType,
  config: PaymentProviderConfig | null = null,
): PaymentProvider {
  const cached = instances.get(type)
  if (cached) return cached

  const cfg = config ?? defaultProviderConfig()

  let provider: PaymentProvider
  switch (type) {
    case 'mock':
      provider = new MockPaymentProvider(cfg)
      break
    case 'moyasar':
      provider = new MoyasarPaymentProvider(cfg)
      break
    case 'hyperpay':
    case 'stripe':
    case 'checkout_com':
      provider = createFutureReadyStub(type, cfg)
      break
    default:
      throw new Error(`Unknown payment provider type: ${type}`)
  }

  instances.set(type, provider)
  return provider
}

export function resetPaymentProviderFactory(): void {
  instances.clear()
}

export function getDefaultPaymentProviderType(): PaymentProviderType {
  const envType = readManagedConfig('VITE_PAYMENT_PROVIDER')
  if (envType === 'hyperpay' || envType === 'moyasar' || envType === 'stripe' || envType === 'checkout_com') {
    return envType
  }
  return 'mock'
}

export function getDefaultPaymentProvider(): PaymentProvider {
  return createPaymentProvider(getDefaultPaymentProviderType())
}
