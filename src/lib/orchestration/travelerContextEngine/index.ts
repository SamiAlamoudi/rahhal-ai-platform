/**
 * Phase 7 Stage 5 — Traveler Context Engine barrel.
 *
 * Architecture / contracts / types / blueprints only.
 * Gated by `brain.context_engine` (default OFF).
 * Live conversation context — distinct from Memory.
 * No LLM, Runtime, DB, storage, HTTP, or APIs.
 */

import { TRAVELER_CONTEXT_ISOLATION as TC_ISOLATION } from './types'
import {
  CONTEXT_LIFECYCLE_ACTIONS,
  CONTEXT_PIPELINE_STAGES,
  CONTEXT_SECTION_IDS,
} from './types'

export {
  BRAIN_CONTEXT_ENGINE_FEATURE_ID,
  isBrainContextEngineEnabled,
  listContextRegistry,
  listContextSectionIds,
  ContextRegistry,
  CONTEXT_REGISTRY,
} from './registry'

export type {
  ContextLocale,
  ContextTimelineEventKind,
  ContextSectionId,
  ContextPipelineStageId,
  ContextLifecycleAction,
  TravelerContext,
  ConversationContext,
  TripContext,
  SessionContext,
  ContextSnapshot,
  ContextConfidence,
  ContextValidation,
  ContextEngineContract,
  ConversationContextContract,
  TravelContextContract,
  CurrentTripContextContract,
  TravelerStateContract,
  SessionContextContract,
  EnvironmentContextContract,
  ConstraintContextContract,
  BudgetContextContract,
  DestinationContextContract,
  TimelineContextContract,
  CompanionContextContract,
  WeatherContextContract,
  TransportationContextContract,
  AccommodationContextContract,
  ActivityContextContract,
  VisaContextContract,
  CurrentGoalContextContract,
  ConversationSnapshotContract,
  ContextConfidenceContract,
  ContextFreshnessContract,
  ContextMergeRulesContract,
  ContextPrioritiesContract,
  ContextValidationContract,
  ContextRegistryEntry,
  TravelerContextEngineBlueprint,
} from './types'

export {
  TRAVELER_CONTEXT_ISOLATION,
  CONTEXT_SECTION_IDS,
  CONTEXT_PIPELINE_STAGES,
  CONTEXT_LIFECYCLE_ACTIONS,
} from './types'

export {
  buildContextEngine,
  buildTravelerContext,
  buildConversationContext,
  buildTripContext,
  buildSessionContext,
  buildContextSnapshot,
  buildConversationContextContract,
  buildTravelContext,
  buildCurrentTripContext,
  buildTravelerState,
  buildSessionContextContract,
  buildEnvironmentContext,
  buildConstraintContext,
  buildBudgetContext,
  buildDestinationContext,
  buildTimelineContext,
  buildCompanionContext,
  buildWeatherContext,
  buildTransportationContext,
  buildAccommodationContext,
  buildActivityContext,
  buildVisaContext,
  buildCurrentGoalContext,
  buildConversationSnapshot,
  buildContextConfidenceContract,
  buildContextFreshness,
  buildContextMergeRules,
  buildContextPriorities,
  buildContextValidationContract,
} from './pipelines'

export {
  TravelerContextEngine,
  buildTravelerContextEngineBlueprint,
  tryBuildTravelerContextEngineBlueprint,
  assertTravelerContextIsolation,
} from './engine'
export type { BuildTravelerContextBlueprintOptions } from './engine'

export const TRAVELER_CONTEXT_ARCHITECTURE = {
  version: '7.5.0-traveler-context',
  featureId: 'brain.context_engine' as const,
  architectureOnly: true,
  components: [
    'context_engine',
    'conversation_context',
    'travel_context',
    'current_trip_context',
    'traveler_state',
    'session_context',
    'environment_context',
    'constraint_context',
    'budget_context',
    'destination_context',
    'timeline_context',
    'companion_context',
    'weather_context',
    'transportation_context',
    'accommodation_context',
    'activity_context',
    'visa_context',
    'current_goal_context',
    'conversation_snapshot',
    'context_confidence',
    'context_freshness',
    'context_merge_rules',
    'context_priorities',
    'context_validation',
    'traveler_context_output',
    'conversation_context_output',
    'trip_context_output',
    'session_context_output',
    'context_snapshot_output',
    'context_confidence_output',
    'context_validation_output',
  ] as const,
  pipelineStages: CONTEXT_PIPELINE_STAGES,
  lifecycleActions: CONTEXT_LIFECYCLE_ACTIONS,
  sectionIds: CONTEXT_SECTION_IDS,
  ...TC_ISOLATION,
} as const
