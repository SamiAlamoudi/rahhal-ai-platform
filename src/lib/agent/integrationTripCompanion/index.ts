/**
 * Integration Sprint 7 — Live Trip Companion barrel.
 * Feature-gated by `ai.integration_trip_companion` (default OFF).
 */

export { INTEGRATION_TRIP_COMPANION_VERSION } from './types'
export type {
  CompanionAssistantIntent,
  CompanionDisruption,
  CompanionDisruptionKind,
  CompanionEmergencyKind,
  CompanionEmergencySupport,
  CompanionLocationLayer,
  CompanionLocationRef,
  CompanionNotification,
  CompanionNotificationKind,
  CompanionTimelineEvent,
  TimelineEventKind,
  TimelineEventStatus,
  TravelTimelineSnapshot,
  TripCompanionContextMemory,
  TripCompanionResult,
  TripSession,
  TripSessionState,
} from './types'

export {
  INTEGRATION_TRIP_COMPANION_FEATURE_ID,
  isIntegrationTripCompanionEnabled,
} from './feature'

export {
  TRIP_SESSION_STATES,
  createTripSession,
  resolveTripSessionState,
} from './session'

export {
  buildTravelTimeline,
  seedEventsFromPlan,
} from './timeline'

export { buildCompanionNotifications } from './notifications'

export {
  detectCompanionDisruption,
  replanTimeline,
} from './replan'

export {
  FUTURE_LOCATION_CAPABILITIES,
  buildCompanionLocationLayer,
} from './location'

export {
  buildEmergencySupport,
  detectEmergencyKind,
} from './emergency'

export { buildCompanionContextMemory } from './contextMemory'

export {
  answerCompanionAssistant,
  detectCompanionAssistantIntent,
  isCompanionAssistantAsk,
} from './assistant'

export { buildTripCompanionSummary } from './consultant'

export {
  runTripCompanion,
  type RunTripCompanionInput,
  type TripCompanionDeps,
} from './engine'

export {
  enrichWithIntegrationTripCompanion,
  shouldRunTripCompanion,
  toTripCompanionMeta,
} from './enrich'
