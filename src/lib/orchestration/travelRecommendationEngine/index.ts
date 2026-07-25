/**
 * Phase 7 Stage 9 — Travel Ranking & Recommendation Engine barrel.
 *
 * Architecture / contracts / types / blueprints only.
 * Gated by `brain.travel_recommendation` (default OFF).
 * Distinct from ai.recommendation_engine / ai.recommendation_intelligence /
 * brain.personalization_engine.
 * Never books or contacts providers — recommendation architecture only.
 */

import { TRAVEL_RECOMMENDATION_ISOLATION as TR_ISOLATION } from './types'
import {
  TRAVEL_RECOMMENDATION_INPUT_HINTS,
  TRAVEL_RECOMMENDATION_LIFECYCLE_ACTIONS,
  TRAVEL_RECOMMENDATION_PIPELINE_STAGES,
  TRAVEL_RECOMMENDATION_SCORE_DIMENSIONS,
  TRAVEL_RECOMMENDATION_SECTION_IDS,
} from './types'

export {
  BRAIN_TRAVEL_RECOMMENDATION_FEATURE_ID,
  isBrainTravelRecommendationEnabled,
  listTravelRecommendationRegistry,
  listTravelRecommendationSectionIds,
  TravelRecommendationRegistry,
  TRAVEL_RECOMMENDATION_REGISTRY,
} from './registry'

export type {
  TravelRecommendationLocale,
  TravelRecommendationSectionId,
  TravelRecommendationPipelineStageId,
  RecommendationCandidate,
  RecommendationScore,
  RecommendationRanking,
  RecommendationReason,
  RecommendationConfidence,
  RecommendationValidation,
  RecommendationSnapshot,
  RecommendationRevision,
  TopRecommendation,
  AlternativeRecommendation,
  RecommendationEngineContract,
  RecommendationPipelineContract,
  RecommendationSchemaContract,
  RecommendationStrategyContract,
  RecommendationRankingContract,
  RecommendationScoringContract,
  RecommendationConfidenceContract,
  RecommendationValidationContract,
  RecommendationLifecycleContract,
  RecommendationSnapshotContract,
  RecommendationRevisionContract,
  RecommendationExplanationContract,
  TravelRecommendationRegistryEntry,
  TravelRecommendationBlueprint,
} from './types'

export {
  TRAVEL_RECOMMENDATION_ISOLATION,
  TRAVEL_RECOMMENDATION_SECTION_IDS,
  TRAVEL_RECOMMENDATION_PIPELINE_STAGES,
  TRAVEL_RECOMMENDATION_LIFECYCLE_ACTIONS,
  TRAVEL_RECOMMENDATION_INPUT_HINTS,
  TRAVEL_RECOMMENDATION_SCORE_DIMENSIONS,
} from './types'

export {
  buildRecommendationEngine,
  buildRecommendationPipeline,
  buildRecommendationSchema,
  buildRecommendationStrategy,
  buildRecommendationRankingContract,
  buildRecommendationScoring,
  buildRecommendationConfidenceContract,
  buildRecommendationValidationContract,
  buildRecommendationLifecycle,
  buildRecommendationSnapshotContract,
  buildRecommendationRevisionContract,
  buildRecommendationExplanation,
  buildRecommendationCandidateSample,
  buildRecommendationScoreSample,
  buildRecommendationRankingSample,
  buildRecommendationReasonSample,
  buildRecommendationConfidenceSample,
  buildRecommendationValidationSample,
  buildRecommendationSnapshotSample,
  buildRecommendationRevisionSample,
  buildTopRecommendationSample,
  buildAlternativeRecommendationsSample,
} from './pipelines'

export {
  TravelRecommendationEngine,
  buildTravelRecommendationBlueprint,
  tryBuildTravelRecommendationBlueprint,
  assertTravelRecommendationIsolation,
} from './engine'
export type { BuildTravelRecommendationBlueprintOptions } from './engine'

export const TRAVEL_RECOMMENDATION_ARCHITECTURE = {
  version: '7.9.0-travel-recommendation',
  featureId: 'brain.travel_recommendation' as const,
  architectureOnly: true,
  components: [
    'recommendation_engine',
    'recommendation_pipeline',
    'recommendation_schema',
    'recommendation_strategy',
    'recommendation_ranking',
    'recommendation_scoring',
    'recommendation_confidence',
    'recommendation_validation',
    'recommendation_lifecycle',
    'recommendation_snapshot',
    'recommendation_revision',
    'recommendation_explanation',
    'recommendation_candidate_output',
    'recommendation_score_output',
    'recommendation_ranking_output',
    'recommendation_reason_output',
    'recommendation_confidence_output',
    'recommendation_validation_output',
    'recommendation_snapshot_output',
    'recommendation_revision_output',
    'top_recommendation_output',
    'alternative_recommendation_output',
  ] as const,
  pipelineStages: TRAVEL_RECOMMENDATION_PIPELINE_STAGES,
  lifecycleActions: TRAVEL_RECOMMENDATION_LIFECYCLE_ACTIONS,
  scoreDimensions: TRAVEL_RECOMMENDATION_SCORE_DIMENSIONS,
  inputHints: TRAVEL_RECOMMENDATION_INPUT_HINTS,
  sectionIds: TRAVEL_RECOMMENDATION_SECTION_IDS,
  ...TR_ISOLATION,
} as const
