/**
 * Sprint 36 — Universal Cancellation & Refund Policy Engine types.
 * Provider-independent normalized model.
 */

export type PolicyServiceKind =
  | 'flight'
  | 'hotel'
  | 'car_rental'
  | 'activity'
  | 'visa'
  | 'insurance'

export type Refundability =
  | 'fully_refundable'
  | 'partially_refundable'
  | 'non_refundable'
  | 'free_cancellation'
  | 'deadline_based'
  | 'framework_only'

export type CancellationScope =
  | 'full_booking'
  | 'flight_only'
  | 'hotel_only'
  | 'car_only'
  | 'activity_only'
  | 'one_passenger'
  | 'one_room'
  | 'return_flight_only'

export type CancellationReason =
  | 'customer_request'
  | 'airline_initiated'
  | 'hotel_initiated'
  | 'provider_cancellation'
  | 'weather'
  | 'event_cancellation'
  | 'no_show'
  | 'early_departure'
  | 'late_cancellation'
  | 'flight_delay'
  | 'after_check_in'
  | 'other'

export type PolicyCaseStatus =
  | 'quoted'
  | 'validated'
  | 'cancelling'
  | 'cancelled'
  | 'refund_pending'
  | 'refund_approved'
  | 'refund_rejected'
  | 'refund_completed'
  | 'failed'
  | 'rolled_back'

export type TripPolicyLifecycle =
  | 'Upcoming'
  | 'Modified'
  | 'Cancelled'
  | 'Refund Pending'
  | 'Refund Completed'

/** Normalized cancellation/refund policy — independent of providers. */
export interface NormalizedRefundPolicy {
  serviceKind: PolicyServiceKind
  refundability: Refundability
  refundable: boolean
  refundPercent: number
  penaltyAmount: number
  penaltyCurrency: string
  taxesRefundable: number
  taxesNonRefundable: number
  providerFee: number
  platformFee: number
  cancellationDeadline: string | null
  refundTimelineBusinessDaysMin: number
  refundTimelineBusinessDaysMax: number
  specialConditions: string[]
  providerNotes: string[]
  /** Fare / rate specific flags */
  attributes: {
    noShowPenalty: boolean
    changeFeeApplicable: boolean
    sameDayCancellation: boolean
    airlineInitiatedFullRefund: boolean
    freeCancellation: boolean
    firstNightPenalty: boolean
    payAtHotel: boolean
    prepaid: boolean
    earlyDeparturePenalty: boolean
    lateCancellationPenalty: boolean
    pickupDeadlineHours: number | null
    insuranceRefundable: boolean
    depositRefundable: boolean
    fuelPolicyNote: string | null
    oneWayFeeNonRefundable: boolean
    weatherCancellationFullRefund: boolean
    frameworkOnly: boolean
  }
  providerId: string
  sourcePolicyId: string
}

export interface BookedServiceLine {
  lineId: string
  serviceKind: PolicyServiceKind
  title: string
  amountPaid: number
  currency: string
  quantity: number
  providerId: string
  /** Raw provider policy payload (adapter input). */
  rawPolicy: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface RefundLineBreakdown {
  lineId: string
  serviceKind: PolicyServiceKind
  title: string
  amountPaid: number
  refundAmount: number
  penaltyAmount: number
  taxesRefundable: number
  taxesNonRefundable: number
  providerFeeKept: number
  platformFeeKept: number
  refundPercent: number
  notes: string[]
}

export interface RefundBreakdown {
  currency: string
  lines: RefundLineBreakdown[]
  platformFeePaid: number
  platformFeeRefunded: number
  totalPaid: number
  totalRefund: number
  totalPenalties: number
  expectedArrivalBusinessDaysMin: number
  expectedArrivalBusinessDaysMax: number
  explanation: string[]
}

export interface PolicyQuoteInput {
  tripId: string
  userId: string
  conversationId?: string | null
  currency: string
  asOf?: string
  scope: CancellationScope
  reason: CancellationReason
  lines: BookedServiceLine[]
  platformFee?: number
  passengersTotal?: number
  passengersCancelling?: number
  roomsTotal?: number
  roomsCancelling?: number
  checkedIn?: boolean
  flightDelayed?: boolean
  airlineCancelled?: boolean
}

export interface PolicyQuote {
  quoteId: string
  tripId: string
  scope: CancellationScope
  reason: CancellationReason
  policies: NormalizedRefundPolicy[]
  breakdown: RefundBreakdown
  cancellable: boolean
  validationMessages: string[]
  simpleExplanation: string
  createdAt: string
}

export interface CancellationExecutionResult {
  success: boolean
  caseId: string
  quote: PolicyQuote
  status: PolicyCaseStatus
  tripLifecycle: TripPolicyLifecycle
  paymentRefundId: string | null
  paymentRefundedAmount: number
  rolledBack: boolean
  message: string
  auditIds: string[]
}

export interface PolicyRefundCase {
  caseId: string
  tripId: string
  userId: string
  status: PolicyCaseStatus
  quote: PolicyQuote
  tripLifecycle: TripPolicyLifecycle
  paymentSessionId: string | null
  paymentRefundId: string | null
  refundedAmount: number
  error: string | null
  retryCount: number
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface ProviderPolicyAdapter {
  readonly serviceKind: PolicyServiceKind
  readonly providerId: string
  normalize(raw: Record<string, unknown>, currency: string): NormalizedRefundPolicy
}

export interface PolicyMetricsSnapshot {
  refundVolume: number
  refundCount: number
  averageRefundBusinessDays: number
  refundSuccessRate: number
  providerRefundLatencyMsTotal: number
  refundReasons: Record<string, number>
  cancellationReasons: Record<string, number>
  failures: number
  rollbacks: number
}
