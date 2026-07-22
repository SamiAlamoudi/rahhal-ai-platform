/**
 * Sprint 94 — Live Booking Orchestrator contracts.
 * Converts an approved bookable Trip into executable reservation workflow.
 */

export const SPRINT94_BOOKING_ORCHESTRATOR_VERSION = '1.0.0-booking-orchestrator'

export type BookingStateName =
  | 'Pending'
  | 'Started'
  | 'Waiting'
  | 'Confirmed'
  | 'PartiallyConfirmed'
  | 'Retrying'
  | 'Cancelled'
  | 'Expired'
  | 'Completed'

export type BookingSegmentKind = 'flight' | 'hotel' | 'transfer' | 'insurance'

export interface BookableTraveler {
  firstName: string
  lastName: string
  email?: string | null
  type?: 'adult' | 'child' | null
}

/** Structural Trip input — compatible with Sprint 93 Unified Trip without importing it. */
export interface BookableTrip {
  id: string
  destination?: string | null
  origin?: string | null
  currency: string
  budget?: number | null
  valid?: boolean
  validationErrors?: string[]
  dates?: {
    start?: string | null
    end?: string | null
  }
  travelers?: {
    adults?: number
    children?: number
    total?: number
  }
  flights?: Array<{
    id: string
    airline?: string | null
    origin: string
    destination: string
    departureAt?: string | null
    arrivalAt?: string | null
    price: number
    currency: string
    providerId?: string | null
    confidence?: number
  }>
  hotel?: {
    id: string
    name: string
    checkIn?: string | null
    checkOut?: string | null
    price: number
    currency: string
    providerId?: string | null
  } | null
  transfers?: Array<{
    id: string
    title: string
    price: number
    currency: string
    providerId?: string | null
  }>
  insurance?: {
    id: string
    title: string
    price: number
    currency: string
    providerId?: string | null
  } | null
  pricingSummary?: {
    total: number
    currency: string
    flightCost?: number
    hotelCost?: number
  } | null
}

export interface BookingPlanStep {
  id: string
  kind: BookingSegmentKind
  offerId: string
  title: string
  amount: number
  currency: string
  providerId: string
  placeholder: boolean
  order: number
}

export interface BookingPlan {
  id: string
  tripId: string
  currency: string
  totalAmount: number
  steps: BookingPlanStep[]
  createdAt: string
}

export interface BookingReservation {
  reservationId: string
  stepId: string
  kind: BookingSegmentKind
  providerId: string
  status: 'reserved' | 'failed' | 'rolled_back' | 'placeholder'
  amount: number
  currency: string
  confirmationCode: string | null
  placeholder: boolean
  error?: string | null
}

export interface BookingRollbackState {
  required: boolean
  completed: boolean
  reservationIds: string[]
  reason: string | null
}

export interface BookingSession {
  sessionId: string
  tripId: string
  provider: string
  state: BookingStateName
  reservationIds: string[]
  reservations: BookingReservation[]
  plan: BookingPlan
  travelers: BookableTraveler[]
  quotedTotal: number
  lockedTotal: number | null
  currency: string
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
  expiresAt: string
  rollback: BookingRollbackState
  warnings: string[]
  paymentRequired: boolean
  lastError: string | null
  retryCount: number
}

export interface BookingSummary {
  sessionId: string
  state: BookingStateName
  reservationIds: string[]
  pricing: {
    quotedTotal: number
    lockedTotal: number | null
    currency: string
  }
  provider: string
  confirmation: string | null
  warnings: string[]
  paymentRequired: boolean
  reservations: BookingReservation[]
}

export type BookingAuditEventName =
  | 'booking.session.created'
  | 'booking.validated'
  | 'booking.plan.created'
  | 'booking.started'
  | 'booking.step.started'
  | 'booking.step.confirmed'
  | 'booking.step.failed'
  | 'booking.retry'
  | 'booking.waiting'
  | 'booking.partial'
  | 'booking.completed'
  | 'booking.cancelled'
  | 'booking.expired'
  | 'booking.rollback'
  | 'booking.provider.response'
  | 'booking.error'

export interface BookingAuditEvent {
  name: BookingAuditEventName
  at: string
  sessionId: string
  durationMs?: number
  detail?: Record<string, unknown>
}

export interface BookingOrchestratorInput {
  trip: BookableTrip
  travelers: BookableTraveler[]
  sessionId?: string
  providerId?: string
  /** Quoted total from Trip; used for price-unchanged checks. */
  quotedTotal?: number
  /** Current offer total (simulates re-price). */
  currentTotal?: number
  currency?: string
  /** Session TTL ms (default 15m). */
  timeoutMs?: number
  now?: () => number
  /** Injected clock for expiry tests. */
  providerHealthy?: boolean
  /** Force flight reservation failure (tests). */
  failFlight?: boolean
  /** Max executor retries per step. */
  maxRetries?: number
}

export interface BookingOrchestratorResult {
  version: string
  session: BookingSession
  summary: BookingSummary
  audit: BookingAuditEvent[]
  durationMs: number
}
