/**
 * Phase AE — Booking Orchestrator v1 public surface.
 */

export type {
  Booking,
  BookingItem,
  BookingItemKind,
  BookingItemStatus,
  BookingItineraryInput,
  BookingPipelineOptions,
  BookingState,
  BookingSummary,
  BookingTimeline,
  BookingTimelineEvent,
  CreateBookingInput,
} from './models'
export {
  BOOKING_STATE_TRANSITIONS,
  canTransitionBookingState,
} from './models'

export { BookingIdempotencyStore } from './idempotency'
export {
  DEFAULT_BOOKING_RETRY_POLICY,
  withBookingRetry,
  type RetryAttemptResult,
  type RetryPolicy,
} from './retry'
export {
  simulatePayment,
  type SimulatedPaymentRequest,
  type SimulatedPaymentResult,
} from './paymentSimulator'
export {
  BookingOrchestrator,
  createBookingOrchestrator,
  resetBookingOrchestratorCounters,
  type BookingOrchestratorOptions,
} from './bookingOrchestrator'
