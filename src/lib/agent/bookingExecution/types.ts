/**
 * Sprint 57 — Booking Execution Engine contracts.
 * Structured execution only — Conversation Brain authors traveler-facing text.
 * Autonomous Agent orchestrates; Booking Intelligence selects; Live Providers fulfill.
 */

import type {
  BookingOffer,
  BookingProvider,
  BookingProviderDomain,
  BookingProviderRegistry,
  MoneyAmount,
} from '../bookingIntelligence/types'

export type BookingLifecycleStatus =
  | 'draft'
  | 'pending'
  | 'payment_required'
  | 'confirmed'
  | 'ticketed'
  | 'cancelled'
  | 'failed'
  | 'expired'

export type BookingExecutionDomain =
  | 'flights'
  | 'hotels'
  | 'activities'
  | 'transfers'
  | 'car_rental'
  | 'insurance'

export type BookingNotificationEventType =
  | 'BookingCreated'
  | 'BookingPending'
  | 'BookingConfirmed'
  | 'BookingFailed'
  | 'BookingCancelled'
  | 'BookingExpired'
  | 'BookingCompleted'

export interface BookingTravelerInfo {
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
}

export interface BookingTicket {
  id: string
  number: string | null
  segmentLabel: string | null
  issuedAt: string | null
}

export interface BookingDocument {
  id: string
  type: 'eticket' | 'voucher' | 'invoice' | 'other'
  url: string | null
  label: string
}

export interface UnifiedBooking {
  id: string
  sessionId: string
  domain: BookingExecutionDomain
  provider: string
  confirmation: string | null
  pnr: string | null
  reservationId: string | null
  status: BookingLifecycleStatus
  travelerInfo: BookingTravelerInfo[]
  pricing: MoneyAmount
  taxes: MoneyAmount
  tickets: BookingTicket[]
  documents: BookingDocument[]
  offerId: string
  createdAt: string
  updatedAt: string
  expiresAt: string | null
  raw?: unknown
}

export interface ReservationRecord {
  reservationId: string
  bookingId: string
  providerId: string
  domain: BookingExecutionDomain
  token: string
  providerReference: string | null
  expiresAt: string
  refreshedAt: string | null
  status: BookingLifecycleStatus
}

export interface BookingAuditEntry {
  id: string
  sessionId: string
  bookingId: string | null
  at: string
  provider: string | null
  latencyMs: number | null
  error: string | null
  action: string
  fromStatus: BookingLifecycleStatus | null
  toStatus: BookingLifecycleStatus | null
  detail?: Record<string, unknown>
}

export interface BookingNotificationEvent {
  type: BookingNotificationEventType
  sessionId: string
  bookingId: string | null
  at: string
  data?: Record<string, unknown>
}

export interface BookingExecutionLineItem {
  domain: BookingExecutionDomain
  offerId: string
  providerId: string
  title: string
  price: MoneyAmount
  offer?: BookingOffer
}

export interface BookingExecutionSession {
  id: string
  userId: string
  status: BookingLifecycleStatus
  items: BookingExecutionLineItem[]
  bookings: UnifiedBooking[]
  travelers: BookingTravelerInfo[]
  idempotencyKey: string
  createdAt: string
  updatedAt: string
  expiresAt: string
  lastError: string | null
  completedDomains: BookingExecutionDomain[]
  failedDomains: BookingExecutionDomain[]
  /** Serialized execution cursor for resume after interruption. */
  resumeCursor: number
  allOrNothing: boolean
}

export interface BookingExecutionSnapshot {
  version: 1
  sessionId: string
  status: BookingLifecycleStatus
  bookingIds: string[]
  confirmedCount: number
  failedCount: number
  cancelledCount: number
  expiredCount: number
  domains: BookingExecutionDomain[]
  providerIds: string[]
  durationMs: number
  resumed: boolean
  rolledBack: boolean
  idempotentReplay: boolean
}

export interface BookingExecutionResult {
  snapshot: BookingExecutionSnapshot
  session: BookingExecutionSession
  bookings: UnifiedBooking[]
  events: BookingNotificationEvent[]
  audit: BookingAuditEntry[]
  /** Short facts for Conversation Brain — not full prose. */
  executionFacts: string[]
}

export type BookingExecutorFn = (input: {
  provider: BookingProvider
  offerId: string
  signal?: AbortSignal
}) => Promise<{ ok: boolean; confirmationId?: string; error?: string; latencyMs?: number }>

export type BookingCancellerFn = (input: {
  provider: BookingProvider
  confirmationId: string
  signal?: AbortSignal
}) => Promise<{ ok: boolean; error?: string }>

export interface TransactionManagerOptions {
  maxRetries?: number
  timeoutMs?: number
  retryDelayMs?: number
  enabled?: boolean
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

export interface RunBookingExecutionInput {
  userId: string
  items: BookingExecutionLineItem[]
  travelers?: BookingTravelerInfo[]
  registry: BookingProviderRegistry
  idempotencyKey?: string
  sessionId?: string
  /** Resume an existing persisted session. */
  resumeSessionId?: string
  allOrNothing?: boolean
  expiresInMs?: number
  signal?: AbortSignal
  transaction?: TransactionManagerOptions
  resumeEnabled?: boolean
  executor?: BookingExecutorFn
  canceller?: BookingCancellerFn
  now?: () => number
}

export const BOOKING_LIFECYCLE_STATUSES: readonly BookingLifecycleStatus[] = [
  'draft',
  'pending',
  'payment_required',
  'confirmed',
  'ticketed',
  'cancelled',
  'failed',
  'expired',
] as const

export const BOOKING_EXECUTION_DOMAINS: readonly BookingExecutionDomain[] = [
  'flights',
  'hotels',
  'activities',
  'transfers',
  'car_rental',
  'insurance',
] as const

export function domainFromBookingProviderDomain(
  domain: BookingProviderDomain,
): BookingExecutionDomain | null {
  switch (domain) {
    case 'flights':
      return 'flights'
    case 'hotels':
      return 'hotels'
    case 'activities':
      return 'activities'
    case 'airport_transfer':
      return 'transfers'
    case 'car_rental':
      return 'car_rental'
    case 'insurance':
      return 'insurance'
    default:
      return null
  }
}

export function toBookingProviderDomain(
  domain: BookingExecutionDomain,
): BookingProviderDomain {
  if (domain === 'transfers') return 'airport_transfer'
  return domain
}
