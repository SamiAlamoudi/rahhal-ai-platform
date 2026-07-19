/**
 * Sprint 34 — Payments & Checkout Platform domain types.
 * Additive layer after TravelExecutionEngine; does not replace src/lib/payment/.
 */

export type PlatformPaymentProviderId =
  | 'stripe'
  | 'adyen'
  | 'checkout_com'
  | 'hyperpay'
  | 'mock'

export type PlatformPaymentMethod =
  | 'apple_pay'
  | 'google_pay'
  | 'card'
  | 'mada'
  | 'stc_pay'
  | 'bank_transfer'

export type SupportedCurrency = 'SAR' | 'USD' | 'EUR' | 'GBP'

export type PlatformPaymentSessionState =
  | 'CREATED'
  | 'INTENT_CREATED'
  | 'INVENTORY_RESERVED'
  | 'AWAITING_PAYMENT'
  | 'PROCESSING'
  | 'PAID'
  | 'BOOKING_CONFIRMED'
  | 'INVOICED'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'ROLLED_BACK'
  | 'CANCELLED'

export type RefundKind = 'full' | 'partial' | 'cancellation' | 'failed_payment_rollback'

export type PaymentSimulateOutcome = 'success' | 'declined' | 'timeout'

export interface TaxBreakdown {
  currency: SupportedCurrency
  subtotal: number
  vatRate: number
  vatAmount: number
  providerFees: number
  serviceFees: number
  couponDiscount: number
  couponCode: string | null
  total: number
}

export interface PaymentIntent {
  intentId: string
  sessionId: string
  executionSessionId: string
  conversationId: string
  amount: number
  currency: SupportedCurrency
  description: string
  providerId: PlatformPaymentProviderId | null
  status: 'created' | 'reserved' | 'charged' | 'failed' | 'cancelled' | 'refunded'
  idempotencyKey: string
  createdAt: string
  updatedAt: string
}

export interface InventoryHold {
  holdId: string
  executionSessionId: string
  flightConfirmation: string | null
  hotelConfirmation: string | null
  reservedAt: string
  releasedAt: string | null
  status: 'held' | 'released' | 'confirmed'
}

export interface BookingConfirmationRefs {
  bookingReference: string
  tripReference: string
  paymentReference: string
  confirmationNumbers: {
    flight: string | null
    hotel: string | null
  }
}

export interface PlatformPaymentSession {
  sessionId: string
  state: PlatformPaymentSessionState
  intent: PaymentIntent
  inventory: InventoryHold | null
  pricing: TaxBreakdown
  method: PlatformPaymentMethod | null
  providerId: PlatformPaymentProviderId | null
  providerChargeId: string | null
  customerEmail: string | null
  customerName: string | null
  locale: 'ar' | 'en'
  bookingRefs: BookingConfirmationRefs | null
  receiptId: string | null
  invoiceId: string | null
  refundIds: string[]
  refundedAmount: number
  warnings: string[]
  error: string | null
  createdAt: string
  updatedAt: string
  paidAt: string | null
  completedAt: string | null
  metadata: Record<string, unknown>
}

export interface ProviderChargeRequest {
  intentId: string
  amount: number
  currency: SupportedCurrency
  method: PlatformPaymentMethod
  customerEmail: string | null
  description: string
  idempotencyKey: string
  simulate?: PaymentSimulateOutcome
  metadata?: Record<string, unknown>
}

export interface ProviderChargeResult {
  success: boolean
  providerId: PlatformPaymentProviderId
  chargeId: string | null
  status: 'authorized' | 'captured' | 'declined' | 'timeout' | 'error'
  latencyMs: number
  message: string
  authorizationCode: string | null
}

export interface ProviderRefundRequest {
  chargeId: string
  amount: number
  currency: SupportedCurrency
  reason: string
}

export interface ProviderRefundResult {
  success: boolean
  refundId: string | null
  refundedAmount: number
  message: string
  latencyMs: number
}

export interface ProviderHealth {
  providerId: PlatformPaymentProviderId
  healthy: boolean
  latencyMs: number
  message: string
}

export interface PlatformPaymentProvider {
  readonly id: PlatformPaymentProviderId
  readonly displayName: string
  readonly priority: number
  charge(request: ProviderChargeRequest): Promise<ProviderChargeResult>
  refund(request: ProviderRefundRequest): Promise<ProviderRefundResult>
  healthCheck(): Promise<ProviderHealth>
}

export interface PaymentCheckoutInput {
  executionSessionId: string
  conversationId: string
  tripId?: string
  currency: SupportedCurrency
  /** Pre-tax itinerary subtotal (flights + hotels + base fees from execution pricing). */
  subtotal: number
  flightConfirmation?: string | null
  hotelConfirmation?: string | null
  bookingReferenceHint?: string | null
  tripReferenceHint?: string | null
  customerEmail?: string | null
  customerName?: string | null
  couponCode?: string | null
  locale?: 'ar' | 'en'
  preferredProviderId?: PlatformPaymentProviderId
  vatRate?: number
  providerFees?: number
  serviceFees?: number
  description?: string
  idempotencyKey?: string
  metadata?: Record<string, unknown>
}

export interface PayInput {
  method: PlatformPaymentMethod
  simulate?: PaymentSimulateOutcome
  preferredProviderId?: PlatformPaymentProviderId
}

export interface RefundInput {
  kind: RefundKind
  amount?: number
  reason?: string
}

export const SUPPORTED_CURRENCIES: readonly SupportedCurrency[] = [
  'SAR',
  'USD',
  'EUR',
  'GBP',
] as const

export const PLATFORM_PAYMENT_METHODS: readonly PlatformPaymentMethod[] = [
  'apple_pay',
  'google_pay',
  'card',
  'mada',
  'stc_pay',
  'bank_transfer',
] as const

export const PLATFORM_PROVIDER_IDS: readonly PlatformPaymentProviderId[] = [
  'stripe',
  'adyen',
  'checkout_com',
  'hyperpay',
  'mock',
] as const
