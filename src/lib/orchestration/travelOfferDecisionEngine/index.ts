/**
 * Phase 7 Stage 10 — Offer Decision Engine barrel.
 *
 * Architecture / contracts / types / blueprints only.
 * Gated by `brain.offer_decision_engine` (default OFF).
 * Distinct from brain.travel_recommendation / brain.personalization_engine /
 * ai.recommendation_engine.
 * Never books, contacts providers, or calculates payments.
 */

import { TRAVEL_OFFER_DECISION_ISOLATION as OD_ISOLATION } from './types'
import {
  TRAVEL_OFFER_DECISION_SECTION_IDS,
  TRAVEL_OFFER_INPUT_HINTS,
  TRAVEL_OFFER_LIFECYCLE_ACTIONS,
  TRAVEL_OFFER_PIPELINE_STAGES,
  TRAVEL_OFFER_SCORE_DIMENSIONS,
  TRAVEL_OFFER_STRATEGY_HINTS,
} from './types'

export {
  BRAIN_OFFER_DECISION_ENGINE_FEATURE_ID,
  isBrainOfferDecisionEngineEnabled,
  listTravelOfferDecisionRegistry,
  listTravelOfferDecisionSectionIds,
  TravelOfferDecisionRegistry,
  TRAVEL_OFFER_DECISION_REGISTRY,
} from './registry'

export type {
  TravelOfferDecisionLocale,
  TravelOfferDecisionSectionId,
  TravelOfferPipelineStageId,
  OfferCandidate,
  OfferBundle,
  OfferDecision,
  OfferRanking,
  OfferScore,
  OfferExplanation,
  OfferConfidence,
  OfferValidation,
  OfferRevision,
  OfferSnapshot,
  OfferDecisionEngineContract,
  OfferPipelineContract,
  OfferSchemaContract,
  OfferStrategyContract,
  OfferScoringContract,
  OfferRankingContract,
  OfferExplanationContract,
  OfferConfidenceContract,
  OfferValidationContract,
  OfferLifecycleContract,
  OfferSnapshotContract,
  OfferRevisionContract,
  TravelOfferDecisionRegistryEntry,
  TravelOfferDecisionBlueprint,
} from './types'

export {
  TRAVEL_OFFER_DECISION_ISOLATION,
  TRAVEL_OFFER_DECISION_SECTION_IDS,
  TRAVEL_OFFER_PIPELINE_STAGES,
  TRAVEL_OFFER_LIFECYCLE_ACTIONS,
  TRAVEL_OFFER_INPUT_HINTS,
  TRAVEL_OFFER_SCORE_DIMENSIONS,
  TRAVEL_OFFER_STRATEGY_HINTS,
} from './types'

export {
  buildOfferDecisionEngine,
  buildOfferPipeline,
  buildOfferSchema,
  buildOfferStrategy,
  buildOfferScoring,
  buildOfferRankingContract,
  buildOfferExplanationContract,
  buildOfferConfidenceContract,
  buildOfferValidationContract,
  buildOfferLifecycle,
  buildOfferSnapshotContract,
  buildOfferRevisionContract,
  buildOfferCandidateSample,
  buildOfferBundleSample,
  buildOfferDecisionSample,
  buildOfferRankingSample,
  buildOfferScoreSample,
  buildOfferExplanationSample,
  buildOfferConfidenceSample,
  buildOfferValidationSample,
  buildOfferRevisionSample,
  buildOfferSnapshotSample,
} from './pipelines'

export {
  TravelOfferDecisionEngine,
  buildTravelOfferDecisionBlueprint,
  tryBuildTravelOfferDecisionBlueprint,
  assertTravelOfferDecisionIsolation,
} from './engine'
export type { BuildTravelOfferDecisionBlueprintOptions } from './engine'

export const TRAVEL_OFFER_DECISION_ARCHITECTURE = {
  version: '7.10.0-offer-decision',
  featureId: 'brain.offer_decision_engine' as const,
  architectureOnly: true,
  components: [
    'offer_decision_engine',
    'offer_pipeline',
    'offer_schema',
    'offer_strategy',
    'offer_scoring',
    'offer_ranking',
    'offer_explanation',
    'offer_confidence',
    'offer_validation',
    'offer_lifecycle',
    'offer_snapshot',
    'offer_revision',
    'offer_candidate_output',
    'offer_bundle_output',
    'offer_decision_output',
    'offer_ranking_output',
    'offer_score_output',
    'offer_explanation_output',
    'offer_confidence_output',
    'offer_validation_output',
    'offer_revision_output',
    'offer_snapshot_output',
  ] as const,
  pipelineStages: TRAVEL_OFFER_PIPELINE_STAGES,
  lifecycleActions: TRAVEL_OFFER_LIFECYCLE_ACTIONS,
  scoreDimensions: TRAVEL_OFFER_SCORE_DIMENSIONS,
  strategyHints: TRAVEL_OFFER_STRATEGY_HINTS,
  inputHints: TRAVEL_OFFER_INPUT_HINTS,
  sectionIds: TRAVEL_OFFER_DECISION_SECTION_IDS,
  ...OD_ISOLATION,
} as const
