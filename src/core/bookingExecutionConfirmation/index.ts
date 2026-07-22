/**
 * Sprint 102 — Booking Execution & Confirmation (core barrel).
 * Additive — extends Booking Assistant without modifying engines/providers.
 */

export {
  SPRINT102_BOOKING_EXECUTION_VERSION,
  type BookingExecutionLifecycle,
  type BookingPriceBreakdown,
  type BookingCancellationPolicy,
  type BookingItinerarySummary,
  type BookingTravelerDraft,
  type BookingExecutionComposeInput,
  type AbstractBookRequest,
  type AbstractBookResult,
  type AbstractCancelRequest,
  type AbstractCancelResult,
} from './types'

export {
  type BookingProviderAdapter,
  StubBookingProviderAdapter,
  createStubBookingProviderAdapter,
} from './BookingProviderAdapter'

export {
  createPendingLifecycle,
  transitionLifecycle,
  isTerminalLifecycle,
  type BookingLifecycleSnapshot,
} from './BookingLifecycle'

export {
  buildBookingReviewModel,
  type BookingReviewModel,
} from './BookingReviewModel'

export {
  validateTravelerConfirmation,
  createEmptyTraveler,
  type TravelerFieldId,
  type TravelerFieldError,
  type TravelerConfirmationResult,
} from './TravelerConfirmation'

export {
  runBookNowWorkflow,
  runCancelBookingWorkflow,
  type BookNowResult,
} from './BookNowWorkflow'

export {
  buildBookingConfirmationModel,
  formatConfirmationShareText,
  type BookingConfirmationModel,
} from './BookingConfirmationModel'

export {
  BookingExecutionComposer,
  createBookingExecutionComposer,
  composeBookingExecutionReview,
  advanceToTravelerConfirmation,
  executeBookNow,
  type BookingExecutionStep,
  type BookingExecutionExperience,
} from './BookingExecutionComposer'
