/**
 * Adapts a legacy PaymentProvider into the PaymentAdapter port.
 */

import type { PaymentProvider } from '../paymentProvider'
import type {
  PaymentRefundRequest,
  PaymentRefundResult,
  PaymentRequest,
  PaymentResult,
  PaymentSessionStatus,
} from '../paymentTypes'
import type { PaymentAdapter, PaymentAdapterCapabilities } from './paymentAdapter'

export class PaymentProviderAdapter implements PaymentAdapter {
  readonly providerId: PaymentAdapter['providerId']
  readonly displayName: string
  private readonly provider: PaymentProvider
  private readonly mocked: boolean

  constructor(
    provider: PaymentProvider,
    options: { mocked?: boolean } = {},
  ) {
    this.provider = provider
    this.mocked = options.mocked ?? provider.providerId === 'mock'
    this.providerId = provider.providerId
    this.displayName = provider.displayName
  }

  getCapabilities(): PaymentAdapterCapabilities {
    return {
      providerId: this.providerId,
      displayName: this.displayName,
      supportsHostedCheckout: true,
      supportsTokenizedCapture: true,
      supportsRefunds: true,
      supportsPartialRefunds: this.providerId === 'mock' || this.providerId === 'moyasar',
      mocked: this.mocked,
    }
  }

  isAvailable(): boolean {
    return true
  }

  createPaymentSession(request: PaymentRequest): Promise<PaymentResult> {
    return this.provider.createPaymentSession(request)
  }

  authorizePayment(paymentSessionId: string): Promise<PaymentResult> {
    return this.provider.authorizePayment(paymentSessionId)
  }

  capturePayment(paymentSessionId: string): Promise<PaymentResult> {
    return this.provider.capturePayment(paymentSessionId)
  }

  refundPayment(request: PaymentRefundRequest): Promise<PaymentRefundResult> {
    return this.provider.refundPayment(request)
  }

  getPaymentStatus(paymentSessionId: string): Promise<PaymentSessionStatus | null> {
    return this.provider.getPaymentStatus(paymentSessionId)
  }

  /** Expose the wrapped provider for CheckoutOrchestrator compatibility. */
  unwrap(): PaymentProvider {
    return this.provider
  }
}
