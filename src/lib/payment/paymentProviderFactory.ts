import type { PaymentProvider, PaymentProviderConfig, PaymentProviderType } from './paymentProvider'
import { defaultProviderConfig } from './paymentProvider'
import { MockPaymentProvider } from './mockPaymentProvider'
import { MoyasarPaymentProvider } from './moyasarPaymentProvider'

const instances: Map<PaymentProviderType, PaymentProvider> = new Map()

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
      throw new Error('HyperPay provider not yet implemented. Use "mock" for development.')
    case 'stripe':
      throw new Error('Stripe provider not yet implemented. Use "mock" for development.')
    case 'checkout_com':
      throw new Error('Checkout.com provider not yet implemented. Use "mock" for development.')
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
  const envType = typeof import.meta !== 'undefined'
    ? (import.meta as { env?: Record<string, string> }).env?.VITE_PAYMENT_PROVIDER
    : undefined
  if (envType === 'hyperpay' || envType === 'moyasar' || envType === 'stripe' || envType === 'checkout_com') {
    return envType
  }
  return 'mock'
}

export function getDefaultPaymentProvider(): PaymentProvider {
  return createPaymentProvider(getDefaultPaymentProviderType())
}
