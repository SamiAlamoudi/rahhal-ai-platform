/**
 * Sprint 25 — Production Booking Flow (MVP) public surface.
 */

export type {
  BookingFlowStage,
  BookingFlowSectionId,
  BookingFlowBudgetContext,
  BookingFlowDatesContext,
  BookingFlowTravelerContext,
  BookingFlowState,
  BookingFlowReviewSection,
  BookingFlowBudgetComparison,
  BookingFlowReviewModel,
  BookingFlowPaymentNav,
  CreateBookingFlowInput,
  ApplySelectionInput,
  ApplySearchOptionSelectionInput,
  BookingFlowConversationEdit,
  BookingFlowControllerOptions,
} from './types'

export {
  BookingFlowController,
  getBookingFlowController,
  resetBookingFlowController,
} from './bookingFlowController'
export type { BookingFlowControllerHandle } from './bookingFlowController'

export {
  saveBookingFlowState,
  loadBookingFlowState,
  loadLatestBookingFlowState,
  loadBookingFlowBySessionId,
  clearBookingFlowStatesForUser,
  BOOKING_FLOW_STORAGE_PREFIX,
} from './bookingFlowPersistence'

export {
  searchOptionToNormalized,
  searchOptionToBookingType,
  searchOptionToBookingSelectedItem,
  searchOptionsToBookingSelectedItems,
  bookingKindOfItem,
} from './searchOptionAdapter'

export {
  buildBudgetComparison,
  buildReviewSections,
  buildBookingFlowReviewModel,
} from './reviewModel'

export {
  detectBookingFlowConversationEdit,
  bookingEditTouchesSection,
} from './conversationEdits'

export {
  syncBrainMemoryFromBookingFlow,
  bookingFlowBrainContextSummary,
} from './brainBookingSync'

export { isBookingFlowEnabled } from './feature'
