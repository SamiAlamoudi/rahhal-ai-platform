/**
 * Sprint 42 — Conversation Experience UI (presentation) public surface.
 * Integrates Sprint 28/32–35 engines into chat — does not replace them.
 */

export {
  CONVERSATION_EXPERIENCE_FEATURE_ID,
  isConversationExperienceEnabled,
} from './feature'
export {
  extractConversationUiMeta,
  pickTopPlan,
  suggestedActionsFromStructured,
  type ConversationUiMeta,
} from './structuredMeta'
export {
  buildTravelCards,
  enrichPlanForBooking,
  type TravelCardModel,
  type FlightCardModel,
  type HotelCardModel,
  type CarCardModel,
  type ActivityCardModel,
  type VisaCardModel,
  type InsuranceCardModel,
  type TravelCardKind,
} from './cardModels'
export {
  createConversationBookingBridge,
  type ConversationBookingAction,
  type ConversationBookingBridge,
  type ConversationBookingContext,
  type ConversationBookingState,
} from './bookingBridge'
export {
  buildMapPreview,
  buildItineraryMapPreviews,
  type MapPreviewKind,
  type MapPreviewModel,
} from './mapPreview'
export {
  buildMemoryChips,
  type ConversationMemoryChip,
} from './tripMemoryView'
export {
  ConversationLiveNotificationBus,
  getConversationLiveNotificationBus,
  resetConversationLiveNotificationBus,
  type ConversationLiveEvent,
  type ConversationLiveEventKind,
} from './liveNotifications'
export {
  resolveChatTheme,
  readStoredChatTheme,
  writeStoredChatTheme,
  chatThemeClassName,
  type ChatThemeMode,
} from './theme'
export {
  buildConversationTimeline,
  type ConversationTimelineEvent,
  type ConversationTimelineStatus,
} from './timelineView'
