/**
 * Sprint 94 — Live Booking Orchestrator (core barrel).
 */

export {
  SPRINT94_BOOKING_ORCHESTRATOR_VERSION,
  type BookingStateName,
  type BookingSegmentKind,
  type BookableTraveler,
  type BookableTrip,
  type BookingPlanStep,
  type BookingPlan,
  type BookingReservation,
  type BookingRollbackState,
  type BookingSession,
  type BookingSummary,
  type BookingAuditEventName,
  type BookingAuditEvent,
  type BookingOrchestratorInput,
  type BookingOrchestratorResult,
} from './types'

export {
  isTerminalBookingState,
  canTransition,
  deriveStateFromReservations,
} from './BookingState'

export { createBookingPlan } from './BookingPlan'

export {
  createBookingSession,
  touchSession,
  transitionSession,
  attachReservation,
} from './BookingSession'

export {
  executeBookingStep,
  rollbackReservations,
  type BookingExecutorOptions,
} from './BookingExecutor'

export {
  validateBooking,
  type BookingValidationResult,
} from './BookingValidator'

export {
  createBookingRecovery,
  shouldRetryBookingError,
  type BookingRecoveryOptions,
} from './BookingRecovery'

export { createBookingAudit } from './BookingAudit'

export {
  buildBookingSummary,
  serializeBookingSession,
  deserializeBookingSession,
  serializeBookingSummary,
} from './BookingSerializer'

export {
  BookingOrchestrator,
  createBookingOrchestrator,
  runBookingOrchestrator,
} from './BookingOrchestrator'

export {
  toBookableTrip,
  type TripLikeInput,
} from './toBookableTrip'
