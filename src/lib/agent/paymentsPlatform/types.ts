/**
 * Sprint 58 — Payments & Ticketing Platform contracts.
 * Mock adapters only — no real gateways.
 * Conversation Brain authors traveler-facing text; Booking Execution requests payment.
 */

export type PaymentMethod =
  | 'card'
  | 'apple_pay'
  | 'google_pay'
  | 'mada'
  | 'stc_pay'
  | 'tabby'
  | 'tamara'
  | 'bank_transfer'

export type PaymentLifecycleStatus =
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'partially_captured'
  | 'refund_pending'
  | 'refunded'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'chargeback'

export type PaymentProviderId =
  | 'mock_card'
  | 'mock_apple_pay'
  | 'mock_google_pay'
  | 'mock_mada'
  | 'mock_stc_pay'
  | 'mock_tabby'
  | 'mock_tamara'
  | 'mock_bank_transfer'

export type TicketKind =
  | 'flight'
  | 'hotel_voucher'
  | 'activity_voucher'
  | 'car_rental'
  | 'insurance_certificate'

export type DocumentKind =
  | 'pnr'
  | 'eticket'
  | 'voucher'
  | 'invoice'
  | 'receipt'
  | 'refund'
  | 'confirmation_pdf'

export type PaymentEventType =
  | 'PaymentStarted'
  | 'Authorized'
  | 'Captured'
  | 'TicketIssued'
  | 'RefundStarted'
  | 'RefundCompleted'
  | 'PaymentFailed'
  | 'ChargebackOpened'

export interface MoneyBreakdown {
  amount: number
  currency: string
  normalizedAmount: number
  normalizedCurrency: string
  exchangeRate: number
  taxes: number
  fees: number
  providerCommission: number
  roundedAmount: number
}

export interface PaymentChargeInput {
  amount: number
  currency: string
  method: PaymentMethod
  customerId: string
  description?: string
  idempotencyKey: string
  signal?: AbortSignal
}

export interface PaymentChargeResult {
  ok: boolean
  providerId: PaymentProviderId
  providerRef: string | null
  status: PaymentLifecycleStatus
  authorizedAmount?: number
  capturedAmount?: number
  error?: string
  latencyMs: number
  raw?: unknown
}

export interface PaymentRefundInput {
  providerRef: string
  amount: number
  currency: string
  reason?: string
  signal?: AbortSignal
}

export interface PaymentRefundResult {
  ok: boolean
  refundRef: string | null
  status: PaymentLifecycleStatus
  error?: string
  latencyMs: number
}

export interface PaymentProviderAdapter {
  readonly providerId: PaymentProviderId
  readonly method: PaymentMethod
  readonly displayName: string
  isAvailable(): boolean
  authorize(input: PaymentChargeInput): Promise<PaymentChargeResult>
  capture(input: PaymentChargeInput & { providerRef: string; amount?: number }): Promise<PaymentChargeResult>
  refund(input: PaymentRefundInput): Promise<PaymentRefundResult>
  verify?(providerRef: string): Promise<{ ok: boolean; status: PaymentLifecycleStatus }>
}

export interface FraudAssessment {
  allowed: boolean
  riskScore: number
  reasons: string[]
  duplicateDetected: boolean
  velocityExceeded: boolean
  suspicious: boolean
  providerVerified: boolean
}

export interface PaymentSession {
  id: string
  userId: string
  bookingExecutionSessionId: string | null
  amount: number
  currency: string
  method: PaymentMethod
  providerId: PaymentProviderId | null
  status: PaymentLifecycleStatus
  providerRef: string | null
  idempotencyKey: string
  createdAt: string
  updatedAt: string
  expiresAt: string
  authorizedAmount: number
  capturedAmount: number
  refundedAmount: number
  retryCount: number
  resumeCursor: 'authorize' | 'capture' | 'ticket' | 'done'
  lastError: string | null
  breakdown: MoneyBreakdown
  fraud: FraudAssessment | null
}

export interface UnifiedTicket {
  id: string
  paymentSessionId: string
  kind: TicketKind
  bookingId: string | null
  confirmation: string | null
  pnr: string | null
  title: string
  travelerName: string
  issuedAt: string
  status: 'issued' | 'void' | 'refunded'
  documentIds: string[]
  raw?: unknown
}

export interface DocumentRecord {
  id: string
  paymentSessionId: string
  kind: DocumentKind
  label: string
  relatedTicketId: string | null
  downloadUrl: string
  createdAt: string
  meta?: Record<string, unknown>
}

export interface RefundRecord {
  id: string
  paymentSessionId: string
  kind: 'full' | 'partial'
  amount: number
  currency: string
  status: PaymentLifecycleStatus
  providerCancellation: boolean
  timeline: Array<{ at: string; status: PaymentLifecycleStatus; note: string }>
  refundRef: string | null
  createdAt: string
  updatedAt: string
}

export interface PaymentAuditEntry {
  id: string
  sessionId: string
  at: string
  action: string
  provider: string | null
  latencyMs: number | null
  error: string | null
  fromStatus: PaymentLifecycleStatus | null
  toStatus: PaymentLifecycleStatus | null
  detail?: Record<string, unknown>
}

export interface PaymentNotificationEvent {
  type: PaymentEventType
  sessionId: string
  at: string
  data?: Record<string, unknown>
}

export interface PaymentsPlatformSnapshot {
  version: 1
  paymentSessionId: string
  status: PaymentLifecycleStatus
  method: PaymentMethod
  providerId: PaymentProviderId | null
  amount: number
  currency: string
  ticketCount: number
  documentCount: number
  refundCount: number
  riskScore: number
  durationMs: number
  resumed: boolean
  idempotentReplay: boolean
}

export interface PaymentsPlatformResult {
  snapshot: PaymentsPlatformSnapshot
  session: PaymentSession
  tickets: UnifiedTicket[]
  documents: DocumentRecord[]
  refunds: RefundRecord[]
  events: PaymentNotificationEvent[]
  audit: PaymentAuditEntry[]
  /** Facts for Conversation Brain — not prose templates. */
  paymentFacts: string[]
}

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'card',
  'apple_pay',
  'google_pay',
  'mada',
  'stc_pay',
  'tabby',
  'tamara',
  'bank_transfer',
] as const

export const PAYMENT_LIFECYCLE_STATUSES: readonly PaymentLifecycleStatus[] = [
  'pending',
  'authorized',
  'captured',
  'partially_captured',
  'refund_pending',
  'refunded',
  'failed',
  'cancelled',
  'expired',
  'chargeback',
] as const
