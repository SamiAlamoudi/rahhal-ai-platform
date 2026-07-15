/**
 * PaymentAdapter — vendor-agnostic payment port for the orchestration layer.
 * Concrete providers (mock, Moyasar, …) implement this; PaymentOrchestrator
 * never imports vendor SDKs directly.
 */

import type {
  PaymentMethod,
  PaymentProviderId,
  PaymentRefundRequest,
  PaymentRefundResult,
  PaymentRequest,
  PaymentResult,
  PaymentSessionStatus,
} from '../paymentTypes'

export interface PaymentAdapterCapabilities {
  providerId: PaymentProviderId
  displayName: string
  supportsHostedCheckout: boolean
  supportsTokenizedCapture: boolean
  supportsRefunds: boolean
  supportsPartialRefunds: boolean
  mocked: boolean
}

export interface PaymentAdapter {
  readonly providerId: PaymentProviderId
  readonly displayName: string
  getCapabilities(): PaymentAdapterCapabilities
  isAvailable(): boolean
  createPaymentSession(request: PaymentRequest): Promise<PaymentResult>
  authorizePayment(paymentSessionId: string): Promise<PaymentResult>
  capturePayment(paymentSessionId: string): Promise<PaymentResult>
  refundPayment(request: PaymentRefundRequest): Promise<PaymentRefundResult>
  getPaymentStatus(paymentSessionId: string): Promise<PaymentSessionStatus | null>
}

export interface CreatePaymentSessionInput {
  orderId: string
  orderNumber: string
  amount: number
  currency: string
  description: string
  customerEmail: string | null
  customerName: string | null
  returnUrl: string
  paymentMethod?: PaymentMethod | null
  metadata?: Record<string, unknown>
}
