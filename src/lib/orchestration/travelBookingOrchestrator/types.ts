/**
 * Phase 7 Stage 11 — Travel Booking Orchestrator contracts.
 * Architecture / interfaces / types / blueprints only.
 * Prepares booking workflows — never executes bookings or contacts providers.
 * Distinct from booking.orchestrator / src/lib/booking / src/core/booking.
 */

export type TravelBookingOrchestratorLocale = 'ar' | 'en'

export type TravelBookingSectionId =
  | 'booking_orchestrator'
  | 'booking_pipeline'
  | 'booking_schema'
  | 'booking_lifecycle'
  | 'booking_strategy'
  | 'booking_validation'
  | 'booking_provider_abstraction'
  | 'booking_rollback'
  | 'booking_retry'
  | 'booking_audit'
  | 'booking_snapshot'
  | 'booking_revision'

/** Output contracts */
export interface BookingRequest {
  kind: 'travel_booking_request'
  requestId: string
  sourceOfferDecisionHint: string
  providerKinds: readonly string[]
  execution: 'none'
  providerCalled: false
}

export interface BookingCandidate {
  kind: 'travel_booking_candidate'
  candidateId: string
  providerKindHint: string
  labelHint: string
  execution: 'none'
}

export interface BookingSession {
  kind: 'travel_booking_session'
  sessionId: string
  requestId: string
  stateHint: string
  execution: 'none'
}

export interface BookingStep {
  kind: 'travel_booking_step'
  stepId: string
  sessionId: string
  stepHint: string
  statusHint: 'pending' | 'ready' | 'skipped'
  execution: 'none'
}

export interface BookingValidation {
  kind: 'travel_booking_validation'
  requestId: string
  valid: boolean
  issues: readonly string[]
  execution: 'none'
}

export interface BookingConfirmationDraft {
  kind: 'travel_booking_confirmation_draft'
  draftId: string
  sessionId: string
  confirmationHint: string
  confirmed: false
  execution: 'none'
}

export interface BookingFailure {
  kind: 'travel_booking_failure'
  failureId: string
  sessionId: string
  reasonHint: string
  recoverableHint: boolean
  execution: 'none'
}

export interface BookingRevision {
  kind: 'travel_booking_revision'
  revisionId: string
  requestId: string
  reasonHint: string
  execution: 'none'
}

export interface BookingSnapshot {
  kind: 'travel_booking_snapshot'
  snapshotId: string
  atIso: string
  sessionId: string | null
  execution: 'none'
}

export interface BookingConfidence {
  kind: 'travel_booking_confidence'
  requestId: string
  scoreHint: number
  bandHint: 'low' | 'medium' | 'high'
  execution: 'none'
}

export interface BookingOrchestratorContract {
  kind: 'travel_booking_orchestrator'
  version: '7.11.0-booking-orchestrator'
  execution: 'none'
  books: false
  providerCalled: false
  paymentsExecuted: false
  reservationsCreated: false
  notificationsSent: false
}

export interface BookingPipelineContract {
  kind: 'travel_booking_pipeline'
  stages: readonly string[]
  execution: 'none'
}

export interface BookingSchemaContract {
  kind: 'travel_booking_schema'
  outputKinds: readonly string[]
  execution: 'none'
}

export interface BookingLifecycleContract {
  kind: 'travel_booking_lifecycle'
  actions: readonly string[]
  stateHints: readonly string[]
  currentStateHint: string | null
  execution: 'none'
}

export interface BookingStrategyContract {
  kind: 'travel_booking_strategy'
  strategyHints: readonly string[]
  rollbackHints: readonly string[]
  retryHints: readonly string[]
  execution: 'none'
}

export interface BookingValidationContract {
  kind: 'travel_booking_validation_contract'
  validation: BookingValidation
  execution: 'none'
}

export interface BookingProviderAbstractionContract {
  kind: 'travel_booking_provider_abstraction'
  providerKinds: readonly string[]
  wired: false
  execution: 'none'
}

export interface BookingAuditContract {
  kind: 'travel_booking_audit'
  auditHints: readonly string[]
  persisted: false
  execution: 'none'
}

export interface BookingSnapshotContract {
  kind: 'travel_booking_snapshot_contract'
  snapshot: BookingSnapshot
  execution: 'none'
}

export interface BookingRevisionContract {
  kind: 'travel_booking_revision_contract'
  revisions: readonly BookingRevision[]
  persisted: false
  execution: 'none'
}

export interface BookingConfidenceContract {
  kind: 'travel_booking_confidence_contract'
  confidence: BookingConfidence
  execution: 'none'
}

export interface TravelBookingRegistryEntry {
  id: string
  sectionId: TravelBookingSectionId
  label: string
  enabledHint: false
}

export interface TravelBookingOrchestratorBlueprint {
  version: '7.11.0-booking-orchestrator'
  featureId: 'brain.booking_orchestrator'
  architectureOnly: true
  orchestrator: BookingOrchestratorContract
  pipeline: BookingPipelineContract
  schema: BookingSchemaContract
  lifecycle: BookingLifecycleContract
  strategy: BookingStrategyContract
  validation: BookingValidationContract
  providerAbstraction: BookingProviderAbstractionContract
  audit: BookingAuditContract
  snapshot: BookingSnapshotContract
  revision: BookingRevisionContract
  confidence: BookingConfidenceContract
  /** Output contract samples */
  bookingRequest: BookingRequest
  bookingCandidate: BookingCandidate
  bookingSession: BookingSession
  bookingStep: BookingStep
  bookingValidation: BookingValidation
  bookingConfirmationDraft: BookingConfirmationDraft
  bookingFailure: BookingFailure
  bookingRevision: BookingRevision
  bookingSnapshot: BookingSnapshot
  bookingConfidence: BookingConfidence
  registry: readonly TravelBookingRegistryEntry[]
  inputHints: readonly string[]
}

export const TRAVEL_BOOKING_ORCHESTRATOR_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoRuntime: false,
  wiredIntoLlms: false,
  wiredIntoProviderApis: false,
  bookingExecuted: false,
  reservationsCreated: false,
  payments: false,
  notifications: false,
  emails: false,
  httpRequests: false,
  wiredIntoDatabase: false,
  wiredIntoStorage: false,
  wiredIntoOcr: false,
  wiredIntoAuth: false,
  distinctFromBookingOrchestratorFlag: true,
  distinctFromLibBookingOrchestrator: true,
  distinctFromCoreBookingOrchestrator: true,
  distinctFromOfferDecisionEngine: true,
} as const

export const TRAVEL_BOOKING_SECTION_IDS: readonly TravelBookingSectionId[] = [
  'booking_orchestrator',
  'booking_pipeline',
  'booking_schema',
  'booking_lifecycle',
  'booking_strategy',
  'booking_validation',
  'booking_provider_abstraction',
  'booking_rollback',
  'booking_retry',
  'booking_audit',
  'booking_snapshot',
  'booking_revision',
] as const

export const TRAVEL_BOOKING_PIPELINE_STAGES = [
  'attach_offer_decision',
  'build_booking_request',
  'map_provider_candidates',
  'open_booking_session',
  'plan_booking_steps',
  'apply_strategy',
  'validate_request',
  'draft_confirmation',
  'score_confidence',
  'plan_rollback',
  'plan_retry',
  'audit_prepare',
  'snapshot',
] as const

export type TravelBookingPipelineStageId =
  (typeof TRAVEL_BOOKING_PIPELINE_STAGES)[number]

export const TRAVEL_BOOKING_LIFECYCLE_ACTIONS = [
  'prepare',
  'validate',
  'open_session',
  'advance_step',
  'draft_confirm',
  'plan_rollback',
  'plan_retry',
  'snapshot',
  'revise',
  'close',
] as const

export const TRAVEL_BOOKING_STATE_HINTS = [
  'idle',
  'preparing',
  'validated',
  'session_open',
  'steps_planned',
  'confirmation_drafted',
  'failed_planned',
  'closed',
] as const

export const TRAVEL_BOOKING_INPUT_HINTS = [
  'offer_decision',
  'traveler_profile',
  'passengers',
  'payment_intent_placeholder',
  'provider_capabilities',
  'business_rules',
] as const

export const TRAVEL_BOOKING_PROVIDER_KINDS = [
  'flight',
  'hotel',
  'activity',
  'transport',
  'generic_future',
] as const

export const TRAVEL_BOOKING_STRATEGY_HINTS = [
  'prepare_only',
  'never_execute',
  'never_call_providers',
  'multi_provider_abstract',
] as const

export const TRAVEL_BOOKING_ROLLBACK_HINTS = [
  'compensate_planned_steps',
  'close_session_clean',
  'preserve_audit_trail',
] as const

export const TRAVEL_BOOKING_RETRY_HINTS = [
  'retry_transient_planned',
  'backoff_placeholder',
  'max_attempts_placeholder',
] as const

export const TRAVEL_BOOKING_AUDIT_HINTS = [
  'request_created',
  'session_state_changed',
  'step_planned',
  'validation_recorded',
  'failure_recorded',
  'revision_recorded',
] as const
