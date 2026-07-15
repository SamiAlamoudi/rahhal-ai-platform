/**
 * Phase AE — Booking Orchestrator v1 models.
 * Additive AI-layer types; does not replace src/lib/booking contracts.
 */

export type BookingState =
  | 'draft'
  | 'pending'
  | 'reserved'
  | 'confirmed'
  | 'failed'
  | 'cancelled'

export type BookingItemKind =
  | 'flight'
  | 'hotel'
  | 'activity'
  | 'transportation'

export type BookingItemStatus =
  | 'pending'
  | 'reserved'
  | 'confirmed'
  | 'failed'
  | 'rolled_back'
  | 'cancelled'

export interface BookingItem {
  id: string
  kind: BookingItemKind
  title: string
  provider: string
  amount: number
  currency: string
  status: BookingItemStatus
  reference: string | null
  metadata: Record<string, unknown>
  attempts: number
  lastError: string | null
}

export interface BookingTimelineEvent {
  id: string
  at: string
  state: BookingState
  type: string
  message: string
  itemId?: string | null
}

export interface BookingTimeline {
  bookingId: string
  events: BookingTimelineEvent[]
}

export interface BookingSummary {
  bookingId: string
  state: BookingState
  itemCount: number
  reservedCount: number
  confirmedCount: number
  failedCount: number
  currency: string
  subtotal: number
  fees: number
  total: number
  paymentSimulated: boolean
  idempotencyKey: string
  itineraryId: string | null
  createdAt: string
  updatedAt: string
  confirmedAt: string | null
  failureReason: string | null
}

export interface Booking {
  id: string
  userId: string
  itineraryId: string | null
  state: BookingState
  items: BookingItem[]
  currency: string
  subtotal: number
  fees: number
  total: number
  idempotencyKey: string
  paymentSimulated: boolean
  paymentReference: string | null
  failureReason: string | null
  timeline: BookingTimelineEvent[]
  retryCount: number
  createdAt: string
  updatedAt: string
  confirmedAt: string | null
  cancelledAt: string | null
  version: 1
}

export interface BookingItineraryInput {
  id?: string | null
  destination: string
  destinations?: string[]
  durationDays: number
  currency?: string
  flights?: Array<{
    id: string
    title?: string
    from: string
    to: string
    estimatedCost: number
    currency?: string
    direct?: boolean
  }>
  hotels?: Array<{
    id: string
    name: string
    estimatedTotal: number
    currency?: string
    nights?: number
  }>
  activities?: Array<{
    id: string
    title: string
    estimatedCost: number
    currency?: string
    day?: number
  }>
  transportation?: Array<{
    id: string
    title?: string
    mode?: string
    estimatedCost: number
    currency?: string
    day?: number
  }>
}

export interface CreateBookingInput {
  userId: string
  itinerary: BookingItineraryInput
  idempotencyKey: string
  currency?: string
  fees?: number
}

export interface BookingPipelineOptions {
  /** Force a specific item id to fail during reserve (tests). */
  forceFailItemId?: string | null
  /**
   * Fail reserves for forceFailItemId until this attempt number succeeds
   * (tests retry strategy). Ignored when forceFailItemId is unset.
   */
  failReserveUntilAttempt?: number | null
  /** Force payment simulation failure (tests). */
  forcePaymentFail?: boolean
  /** Max reserve retries per item. */
  maxRetries?: number
}

export const BOOKING_STATE_TRANSITIONS: Record<BookingState, BookingState[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['reserved', 'failed', 'cancelled'],
  reserved: ['confirmed', 'failed', 'cancelled'],
  confirmed: ['cancelled'],
  failed: ['pending', 'cancelled'],
  cancelled: [],
}

export function canTransitionBookingState(from: BookingState, to: BookingState): boolean {
  return BOOKING_STATE_TRANSITIONS[from].includes(to)
}
