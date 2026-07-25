/**
 * Phase 7 Stage 9 — Travel Ranking & Recommendation Engine contracts.
 * Architecture / interfaces / types / blueprints only.
 * Ranks normalized search candidates — never books or contacts providers.
 */

export type TravelRecommendationLocale = 'ar' | 'en'

export type TravelRecommendationSectionId =
  | 'recommendation_engine'
  | 'recommendation_pipeline'
  | 'recommendation_schema'
  | 'recommendation_strategy'
  | 'recommendation_ranking'
  | 'recommendation_scoring'
  | 'recommendation_confidence'
  | 'recommendation_validation'
  | 'recommendation_lifecycle'
  | 'recommendation_snapshot'
  | 'recommendation_revision'
  | 'recommendation_explanation'

/** Output contracts */
export interface RecommendationCandidate {
  kind: 'travel_recommendation_candidate'
  candidateId: string
  sourceSearchCandidateHint: string
  labelHint: string
  execution: 'none'
}

export interface RecommendationScore {
  kind: 'travel_recommendation_score'
  candidateId: string
  scoreHint: number
  dimensionHints: readonly string[]
  execution: 'none'
}

export interface RecommendationRanking {
  kind: 'travel_recommendation_ranking'
  rankingId: string
  orderedCandidateIds: readonly string[]
  execution: 'none'
}

export interface RecommendationReason {
  kind: 'travel_recommendation_reason'
  reasonId: string
  candidateId: string
  reasonHint: string
  execution: 'none'
}

export interface RecommendationConfidence {
  kind: 'travel_recommendation_confidence'
  candidateId: string
  scoreHint: number
  bandHint: 'low' | 'medium' | 'high'
  execution: 'none'
}

export interface RecommendationValidation {
  kind: 'travel_recommendation_validation'
  rankingId: string
  valid: boolean
  issues: readonly string[]
  execution: 'none'
}

export interface RecommendationSnapshot {
  kind: 'travel_recommendation_snapshot'
  snapshotId: string
  atIso: string
  rankingId: string | null
  execution: 'none'
}

export interface RecommendationRevision {
  kind: 'travel_recommendation_revision'
  revisionId: string
  rankingId: string
  reasonHint: string
  execution: 'none'
}

export interface TopRecommendation {
  kind: 'top_recommendation'
  candidateId: string | null
  labelHint: string
  execution: 'none'
}

export interface AlternativeRecommendation {
  kind: 'alternative_recommendation'
  candidateId: string
  labelHint: string
  execution: 'none'
}

export interface RecommendationEngineContract {
  kind: 'travel_recommendation_engine'
  version: '7.9.0-travel-recommendation'
  execution: 'none'
  books: false
  providerCalled: false
}

export interface RecommendationPipelineContract {
  kind: 'travel_recommendation_pipeline'
  stages: readonly string[]
  execution: 'none'
}

export interface RecommendationSchemaContract {
  kind: 'travel_recommendation_schema'
  outputKinds: readonly string[]
  execution: 'none'
}

export interface RecommendationStrategyContract {
  kind: 'travel_recommendation_strategy'
  strategyHints: readonly string[]
  execution: 'none'
}

export interface RecommendationRankingContract {
  kind: 'travel_recommendation_ranking_contract'
  ranking: RecommendationRanking
  execution: 'none'
}

export interface RecommendationScoringContract {
  kind: 'travel_recommendation_scoring'
  scores: readonly RecommendationScore[]
  executed: false
  execution: 'none'
}

export interface RecommendationConfidenceContract {
  kind: 'travel_recommendation_confidence_contract'
  confidence: RecommendationConfidence
  execution: 'none'
}

export interface RecommendationValidationContract {
  kind: 'travel_recommendation_validation_contract'
  validation: RecommendationValidation
  execution: 'none'
}

export interface RecommendationLifecycleContract {
  kind: 'travel_recommendation_lifecycle'
  actions: readonly string[]
  currentActionHint: string | null
  execution: 'none'
}

export interface RecommendationSnapshotContract {
  kind: 'travel_recommendation_snapshot_contract'
  snapshot: RecommendationSnapshot
  execution: 'none'
}

export interface RecommendationRevisionContract {
  kind: 'travel_recommendation_revision_contract'
  revisions: readonly RecommendationRevision[]
  persisted: false
  execution: 'none'
}

export interface RecommendationExplanationContract {
  kind: 'travel_recommendation_explanation'
  reasons: readonly RecommendationReason[]
  execution: 'none'
}

export interface TravelRecommendationRegistryEntry {
  id: string
  sectionId: TravelRecommendationSectionId
  label: string
  enabledHint: false
}

export interface TravelRecommendationBlueprint {
  version: '7.9.0-travel-recommendation'
  featureId: 'brain.travel_recommendation'
  architectureOnly: true
  engine: RecommendationEngineContract
  pipeline: RecommendationPipelineContract
  schema: RecommendationSchemaContract
  strategy: RecommendationStrategyContract
  ranking: RecommendationRankingContract
  scoring: RecommendationScoringContract
  confidence: RecommendationConfidenceContract
  validation: RecommendationValidationContract
  lifecycle: RecommendationLifecycleContract
  snapshot: RecommendationSnapshotContract
  revision: RecommendationRevisionContract
  explanation: RecommendationExplanationContract
  /** Output contract samples */
  recommendationCandidate: RecommendationCandidate
  recommendationScore: RecommendationScore
  recommendationRanking: RecommendationRanking
  recommendationReason: RecommendationReason
  recommendationConfidence: RecommendationConfidence
  recommendationValidation: RecommendationValidation
  recommendationSnapshot: RecommendationSnapshot
  recommendationRevision: RecommendationRevision
  topRecommendation: TopRecommendation
  alternativeRecommendations: readonly AlternativeRecommendation[]
  registry: readonly TravelRecommendationRegistryEntry[]
  inputHints: readonly string[]
}

export const TRAVEL_RECOMMENDATION_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoRuntime: false,
  wiredIntoLlms: false,
  wiredIntoProviderApis: false,
  booking: false,
  pricing: false,
  httpRequests: false,
  wiredIntoDatabase: false,
  wiredIntoStorage: false,
  distinctFromAiRecommendationEngine: true,
  distinctFromAiRecommendationIntelligence: true,
  distinctFromPersonalizationEngine: true,
} as const

export const TRAVEL_RECOMMENDATION_SECTION_IDS: readonly TravelRecommendationSectionId[] =
  [
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
  ] as const

export const TRAVEL_RECOMMENDATION_PIPELINE_STAGES = [
  'attach_search_candidates',
  'attach_traveler_profile',
  'attach_conversation_context',
  'attach_intent',
  'attach_preferences',
  'attach_budget',
  'attach_planning_goals',
  'attach_travel_constraints',
  'attach_historical_signals',
  'apply_business_rules',
  'score_candidates',
  'rank_candidates',
  'explain_ranking',
  'select_top',
  'select_alternatives',
  'score_confidence',
  'validate',
  'snapshot',
] as const

export type TravelRecommendationPipelineStageId =
  (typeof TRAVEL_RECOMMENDATION_PIPELINE_STAGES)[number]

export const TRAVEL_RECOMMENDATION_LIFECYCLE_ACTIONS = [
  'ingest',
  'score',
  'rank',
  'explain',
  'validate',
  'snapshot',
  'revise',
  'close',
] as const

export const TRAVEL_RECOMMENDATION_INPUT_HINTS = [
  'normalized_search_candidates',
  'traveler_profile',
  'conversation_context',
  'intent',
  'preferences',
  'budget',
  'planning_goals',
  'travel_constraints',
  'historical_signals',
  'business_rules',
] as const

export const TRAVEL_RECOMMENDATION_SCORE_DIMENSIONS = [
  'profile_fit',
  'intent_fit',
  'preference_fit',
  'budget_fit',
  'goal_fit',
  'constraint_fit',
  'history_fit',
  'business_rule_fit',
] as const
