/**
 * Phase 7 Stage 6 — Intent Recognition Engine barrel.
 *
 * Architecture / contracts / types / blueprints only.
 * Gated by `brain.intent_engine` (default OFF).
 * Distinct from Sprint 19 `brain.intent`.
 * No LLM, Runtime, DB, storage, HTTP, or APIs.
 */

import { INTENT_ENGINE_ISOLATION as IE_ISOLATION } from './types'
import {
  INTENT_KINDS,
  INTENT_PIPELINE_STAGES,
  INTENT_SECTION_IDS,
} from './types'

export {
  BRAIN_INTENT_ENGINE_FEATURE_ID,
  isBrainIntentEngineEnabled,
  listIntentKindRegistry,
  listIntentSectionRegistry,
  listIntentKinds,
  listIntentSectionIds,
  IntentRegistry,
  INTENT_KIND_REGISTRY,
  INTENT_SECTION_REGISTRY,
} from './registry'

export type {
  IntentLocale,
  IntentKindId,
  IntentDomainId,
  IntentSectionId,
  IntentPipelineStageId,
  TravelerIntent,
  IntentPrediction,
  IntentConfidence,
  IntentTransition,
  IntentValidation,
  MultiIntentResult,
  IntentEngineContract,
  IntentRegistryEntry,
  IntentRegistryContract,
  IntentClassifierContract,
  IntentSchemaContract,
  IntentConfidenceContract,
  IntentValidationContract,
  IntentPriorityRulesContract,
  IntentResolutionRulesContract,
  IntentTransitionModelContract,
  ConversationIntentContract,
  TravelIntentContract,
  BookingIntentContract,
  SupportIntentContract,
  MultiIntentContract,
  IntentHistoryEntry,
  IntentHistoryContract,
  IntentSnapshotContract,
  IntentSectionRegistryEntry,
  IntentEngineBlueprint,
} from './types'

export {
  INTENT_ENGINE_ISOLATION,
  INTENT_KINDS,
  INTENT_DOMAINS,
  INTENT_SECTION_IDS,
  INTENT_PIPELINE_STAGES,
  domainForIntent,
} from './types'

export {
  buildIntentEngine,
  buildIntentRegistryContract,
  buildIntentClassifier,
  buildIntentSchema,
  buildIntentConfidenceContract,
  buildIntentValidationContract,
  buildIntentPriorityRules,
  buildIntentResolutionRules,
  buildIntentTransitionModel,
  buildConversationIntent,
  buildTravelIntent,
  buildBookingIntent,
  buildSupportIntent,
  buildMultiIntent,
  buildIntentHistory,
  buildIntentSnapshot,
  buildTravelerIntentSample,
  buildIntentPredictionSample,
} from './pipelines'

export {
  IntentEngine,
  buildIntentEngineBlueprint,
  tryBuildIntentEngineBlueprint,
  assertIntentEngineIsolation,
} from './engine'
export type { BuildIntentEngineBlueprintOptions } from './engine'

export const INTENT_ENGINE_ARCHITECTURE = {
  version: '7.6.0-intent-engine',
  featureId: 'brain.intent_engine' as const,
  architectureOnly: true,
  components: [
    'intent_engine',
    'intent_registry',
    'intent_classifier',
    'intent_schema',
    'intent_confidence',
    'intent_validation',
    'intent_priority_rules',
    'intent_resolution_rules',
    'intent_transition_model',
    'conversation_intent',
    'travel_intent',
    'booking_intent',
    'support_intent',
    'multi_intent',
    'intent_history',
    'intent_snapshot',
    'traveler_intent_output',
    'intent_prediction_output',
    'intent_confidence_output',
    'intent_transition_output',
    'intent_validation_output',
    'multi_intent_result_output',
  ] as const,
  intentKinds: INTENT_KINDS,
  pipelineStages: INTENT_PIPELINE_STAGES,
  sectionIds: INTENT_SECTION_IDS,
  ...IE_ISOLATION,
} as const
