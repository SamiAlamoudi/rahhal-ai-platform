/**
 * Sprint 101 — Smart Booking Assistant (core barrel).
 * Additive presentation / orchestration — reuses existing engine + Alpha outputs only.
 */

export {
  SPRINT101_BOOKING_ASSISTANT_VERSION,
  buildBookingReadiness,
  type BookingReadinessStatusId,
  type BookingReadinessSection,
  type BookingAssistantComposeInput,
} from './BookingReadiness'

export {
  buildBookingChecklist,
  type BookingChecklistItemId,
  type BookingChecklistItem,
  type BookingChecklistSection,
} from './BookingChecklist'

export {
  buildMissingRequirements,
  type MissingRequirementItem,
  type MissingRequirementsSection,
} from './MissingRequirements'

export {
  buildBookingTimeline,
  type BookingTimelineStageId,
  type BookingTimelineStage,
  type BookingTimelineSection,
} from './BookingTimeline'

export {
  buildBookingWarnings,
  type BookingWarningKind,
  type BookingWarningItem,
  type BookingWarningsSection,
} from './BookingWarnings'

export {
  buildBookingActions,
  type BookingActionId,
  type BookingActionItem,
  type BookingActionsSection,
} from './BookingActions'

export {
  buildBookingAssistantSummary,
  type BookingSummarySection,
} from './BookingSummary'

export {
  BookingAssistantComposer,
  createBookingAssistantComposer,
  composeBookingAssistantExperience,
  buildBookingAssistantDTO,
  buildBookingConfidence,
  type BookingAssistantDTO,
  type BookingAssistantSection,
  type BookingAssistantSectionId,
  type BookingConfidenceSection,
} from './BookingAssistantComposer'
