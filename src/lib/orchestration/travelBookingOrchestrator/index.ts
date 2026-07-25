/**
 * Phase 7 Stage 11 — Travel Booking Orchestrator barrel.
 *
 * Architecture / contracts / types / blueprints only.
 * Gated by `brain.booking_orchestrator` (default OFF).
 * Distinct from booking.orchestrator / src/lib/booking / src/core/booking /
 * brain.offer_decision_engine.
 * Never executes bookings or contacts providers — preparation architecture only.
 */

import { TRAVEL_BOOKING_ORCHESTRATOR_ISOLATION as TB_ISOLATION } from './types'
import {
  TRAVEL_BOOKING_AUDIT_HINTS,
  TRAVEL_BOOKING_INPUT_HINTS,
  TRAVEL_BOOKING_LIFECYCLE_ACTIONS,
  TRAVEL_BOOKING_PIPELINE_STAGES,
  TRAVEL_BOOKING_PROVIDER_KINDS,
  TRAVEL_BOOKING_RETRY_HINTS,
  TRAVEL_BOOKING_ROLLBACK_HINTS,
  TRAVEL_BOOKING_SECTION_IDS,
  TRAVEL_BOOKING_STATE_HINTS,
  TRAVEL_BOOKING_STRATEGY_HINTS,
} from './types'

export {
  BRAIN_BOOKING_ORCHESTRATOR_FEATURE_ID,
  isBrainBookingOrchestratorEnabled,
  listTravelBookingRegistry,
  listTravelBookingSectionIds,
  TravelBookingRegistry,
  TRAVEL_BOOKING_REGISTRY,
} from './registry'

export type {
  TravelBookingOrchestratorLocale,
  TravelBookingSectionId,
  TravelBookingPipelineStageId,
  BookingRequest,
  BookingCandidate,
  BookingSession,
  BookingStep,
  BookingValidation,
  BookingConfirmationDraft,
  BookingFailure,
  BookingRevision,
  BookingSnapshot,
  BookingConfidence,
  BookingOrchestratorContract,
  BookingPipelineContract,
  BookingSchemaContract,
  BookingLifecycleContract,
  BookingStrategyContract,
  BookingValidationContract,
  BookingProviderAbstractionContract,
  BookingAuditContract,
  BookingSnapshotContract,
  BookingRevisionContract,
  BookingConfidenceContract,
  TravelBookingRegistryEntry,
  TravelBookingOrchestratorBlueprint,
} from './types'

export {
  TRAVEL_BOOKING_ORCHESTRATOR_ISOLATION,
  TRAVEL_BOOKING_SECTION_IDS,
  TRAVEL_BOOKING_PIPELINE_STAGES,
  TRAVEL_BOOKING_LIFECYCLE_ACTIONS,
  TRAVEL_BOOKING_STATE_HINTS,
  TRAVEL_BOOKING_INPUT_HINTS,
  TRAVEL_BOOKING_PROVIDER_KINDS,
  TRAVEL_BOOKING_STRATEGY_HINTS,
  TRAVEL_BOOKING_ROLLBACK_HINTS,
  TRAVEL_BOOKING_RETRY_HINTS,
  TRAVEL_BOOKING_AUDIT_HINTS,
} from './types'

export {
  buildBookingOrchestrator,
  buildBookingPipeline,
  buildBookingSchema,
  buildBookingLifecycle,
  buildBookingStrategy,
  buildBookingValidationContract,
  buildBookingProviderAbstraction,
  buildBookingAudit,
  buildBookingSnapshotContract,
  buildBookingRevisionContract,
  buildBookingConfidenceContract,
  buildBookingRequestSample,
  buildBookingCandidateSample,
  buildBookingSessionSample,
  buildBookingStepSample,
  buildBookingValidationSample,
  buildBookingConfirmationDraftSample,
  buildBookingFailureSample,
  buildBookingRevisionSample,
  buildBookingSnapshotSample,
  buildBookingConfidenceSample,
} from './pipelines'

export {
  TravelBookingOrchestrator,
  buildTravelBookingOrchestratorBlueprint,
  tryBuildTravelBookingOrchestratorBlueprint,
  assertTravelBookingOrchestratorIsolation,
} from './engine'
export type { BuildTravelBookingOrchestratorBlueprintOptions } from './engine'

export const TRAVEL_BOOKING_ORCHESTRATOR_ARCHITECTURE = {
  version: '7.11.0-booking-orchestrator',
  featureId: 'brain.booking_orchestrator' as const,
  architectureOnly: true,
  components: [
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
    'booking_request_output',
    'booking_candidate_output',
    'booking_session_output',
    'booking_step_output',
    'booking_validation_output',
    'booking_confirmation_draft_output',
    'booking_failure_output',
    'booking_revision_output',
    'booking_snapshot_output',
    'booking_confidence_output',
  ] as const,
  pipelineStages: TRAVEL_BOOKING_PIPELINE_STAGES,
  lifecycleActions: TRAVEL_BOOKING_LIFECYCLE_ACTIONS,
  stateHints: TRAVEL_BOOKING_STATE_HINTS,
  providerKinds: TRAVEL_BOOKING_PROVIDER_KINDS,
  strategyHints: TRAVEL_BOOKING_STRATEGY_HINTS,
  rollbackHints: TRAVEL_BOOKING_ROLLBACK_HINTS,
  retryHints: TRAVEL_BOOKING_RETRY_HINTS,
  auditHints: TRAVEL_BOOKING_AUDIT_HINTS,
  inputHints: TRAVEL_BOOKING_INPUT_HINTS,
  sectionIds: TRAVEL_BOOKING_SECTION_IDS,
  ...TB_ISOLATION,
} as const
