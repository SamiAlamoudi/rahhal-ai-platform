export type PaymentProviderId =
  | 'mock'
  | 'hyperpay'
  | 'moyasar'
  | 'stripe'
  | 'checkout_com'

export type PaymentSessionStatus =
  | 'created'
  | 'pending'
  | 'authorized'
  | 'paid'
  | 'failed'
  | 'expired'
  | 'cancelled'
  | 'refunded'

export type PaymentMethod =
  | 'card'
  | 'apple_pay'
  | 'mada'
  | 'stc_pay'
  | 'bank_transfer'
  | 'wallet'

export interface PaymentRequest {
  orderId: string
  orderNumber: string
  amount: number
  currency: string
  description: string
  customerEmail: string | null
  customerName: string | null
  returnUrl: string
  metadata: Record<string, unknown>
}

export interface PaymentResult {
  success: boolean
  providerId: PaymentProviderId
  paymentSessionId: string
  status: PaymentSessionStatus
  providerReference: string | null
  authorizationCode: string | null
  transactionId: string | null
  message: string
  redirectUrl: string | null
  paidAt: string | null
  metadata: Record<string, unknown>
}

export interface PaymentRefundRequest {
  paymentId: string
  amount: number
  currency: string
  reason: string
}

export interface PaymentRefundResult {
  success: boolean
  refundId: string | null
  refundedAmount: number
  message: string
}

export interface PaymentSession {
  id: string
  orderId: string
  orderNumber: string
  providerId: PaymentProviderId
  status: PaymentSessionStatus
  amount: number
  currency: string
  paymentMethod: PaymentMethod | null
  providerReference: string | null
  authorizationCode: string | null
  transactionId: string | null
  redirectUrl: string | null
  description: string
  customerEmail: string | null
  customerName: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  paidAt: string | null
  expiresAt: string
}

export const PAYMENT_SESSION_STATUS_VALUES: readonly PaymentSessionStatus[] = [
  'created',
  'pending',
  'authorized',
  'paid',
  'failed',
  'expired',
  'cancelled',
  'refunded',
] as const

export const PAYMENT_PROVIDER_VALUES: readonly PaymentProviderId[] = [
  'mock',
  'hyperpay',
  'moyasar',
  'stripe',
  'checkout_com',
] as const

export const PAYMENT_METHOD_VALUES: readonly PaymentMethod[] = [
  'card',
  'apple_pay',
  'mada',
  'stc_pay',
  'bank_transfer',
  'wallet',
] as const
