/**
 * Mock PaymentAdapter — default Phase S adapter (VITE_PAYMENT_PROVIDER=mock).
 */

import { MockPaymentProvider } from '../mockPaymentProvider'
import { defaultProviderConfig, type PaymentProviderConfig } from '../paymentProvider'
import { PaymentProviderAdapter } from './paymentProviderAdapter'
import type { PaymentAdapter } from './paymentAdapter'

export function createMockPaymentAdapter(
  config: PaymentProviderConfig | null = null,
): PaymentAdapter {
  return new PaymentProviderAdapter(
    new MockPaymentProvider(config ?? defaultProviderConfig()),
    { mocked: true },
  )
}
