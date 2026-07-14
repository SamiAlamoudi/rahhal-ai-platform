import type {
  PaymentProviderId,
  PaymentRequest,
  PaymentResult,
  PaymentRefundRequest,
  PaymentRefundResult,
  PaymentSessionStatus,
} from './paymentTypes'

export interface PaymentProvider {
  readonly providerId: PaymentProviderId
  readonly displayName: string

  createPaymentSession(request: PaymentRequest): Promise<PaymentResult>
  authorizePayment(paymentSessionId: string): Promise<PaymentResult>
  capturePayment(paymentSessionId: string): Promise<PaymentResult>
  refundPayment(request: PaymentRefundRequest): Promise<PaymentRefundResult>
  getPaymentStatus(paymentSessionId: string): Promise<PaymentSessionStatus | null>
}

export interface PaymentProviderConfig {
  apiKey: string | null
  merchantId: string | null
  secretKey: string | null
  testMode: boolean
  webhookSecret: string | null
}

export type PaymentProviderType =
  | 'mock'
  | 'hyperpay'
  | 'moyasar'
  | 'stripe'
  | 'checkout_com'

export function defaultProviderConfig(): PaymentProviderConfig {
  return {
    apiKey: null,
    merchantId: null,
    secretKey: null,
    testMode: true,
    webhookSecret: null,
  }
}
