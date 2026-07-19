/**
 * Sprint 15 — Payment preparation ports (no live gateway yet).
 * Future: Stripe, HyperPay, Moyasar, Tabby, Tamara.
 */

export type PaymentGatewayId =
  | 'mock'
  | 'stripe'
  | 'hyperpay'
  | 'moyasar'
  | 'tabby'
  | 'tamara'

export interface PaymentPrepareRequest {
  orderId: string
  orderNumber: string
  amount: number
  currency: string
  customerId: string
  customerEmail?: string | null
  returnUrl: string
  metadata?: Record<string, unknown>
}

export interface PaymentPrepareResult {
  success: boolean
  gatewayId: PaymentGatewayId
  providerSessionId: string | null
  redirectUrl: string | null
  message: string
}

export interface PaymentGatewayCapabilities {
  gatewayId: PaymentGatewayId
  displayName: string
  supportsRedirect: boolean
  supportsApplePay: boolean
  supportsBnpl: boolean
  mocked: boolean
}

export interface PaymentGatewayAdapter {
  readonly gatewayId: PaymentGatewayId
  readonly displayName: string
  getCapabilities(): PaymentGatewayCapabilities
  preparePayment(request: PaymentPrepareRequest): Promise<PaymentPrepareResult>
}
