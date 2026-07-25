/**
 * Phase 7 Stage 10 — Offer Decision Engine contracts.
 * Architecture / interfaces / types / blueprints only.
 * Selects best offer from recommendation results — never books or contacts providers.
 */

export type TravelOfferDecisionLocale = 'ar' | 'en'

export type TravelOfferDecisionSectionId =
  | 'offer_decision_engine'
  | 'offer_pipeline'
  | 'offer_schema'
  | 'offer_strategy'
  | 'offer_scoring'
  | 'offer_ranking'
  | 'offer_explanation'
  | 'offer_confidence'
  | 'offer_validation'
  | 'offer_lifecycle'
  | 'offer_snapshot'
  | 'offer_revision'

/** Output contracts */
export interface OfferCandidate {
  kind: 'travel_offer_candidate'
  candidateId: string
  sourceRecommendationHint: string
  labelHint: string
  execution: 'none'
}

export interface OfferBundle {
  kind: 'travel_offer_bundle'
  bundleId: string
  candidateIds: readonly string[]
  labelHint: string
  execution: 'none'
}

export interface OfferDecision {
  kind: 'travel_offer_decision'
  decisionId: string
  selectedCandidateId: string | null
  selectedBundleId: string | null
  strategyHint: string
  execution: 'none'
}

export interface OfferRanking {
  kind: 'travel_offer_ranking'
  rankingId: string
  orderedCandidateIds: readonly string[]
  execution: 'none'
}

export interface OfferScore {
  kind: 'travel_offer_score'
  candidateId: string
  scoreHint: number
  dimensionHints: readonly string[]
  execution: 'none'
}

export interface OfferExplanation {
  kind: 'travel_offer_explanation'
  explanationId: string
  decisionId: string
  reasonHints: readonly string[]
  execution: 'none'
}

export interface OfferConfidence {
  kind: 'travel_offer_confidence'
  decisionId: string
  scoreHint: number
  bandHint: 'low' | 'medium' | 'high'
  execution: 'none'
}

export interface OfferValidation {
  kind: 'travel_offer_validation'
  decisionId: string
  valid: boolean
  issues: readonly string[]
  execution: 'none'
}

export interface OfferRevision {
  kind: 'travel_offer_revision'
  revisionId: string
  decisionId: string
  reasonHint: string
  execution: 'none'
}

export interface OfferSnapshot {
  kind: 'travel_offer_snapshot'
  snapshotId: string
  atIso: string
  decisionId: string | null
  execution: 'none'
}

export interface OfferDecisionEngineContract {
  kind: 'travel_offer_decision_engine'
  version: '7.10.0-offer-decision'
  execution: 'none'
  books: false
  providerCalled: false
  paymentsCalculated: false
}

export interface OfferPipelineContract {
  kind: 'travel_offer_pipeline'
  stages: readonly string[]
  execution: 'none'
}

export interface OfferSchemaContract {
  kind: 'travel_offer_schema'
  outputKinds: readonly string[]
  execution: 'none'
}

export interface OfferStrategyContract {
  kind: 'travel_offer_strategy'
  strategyHints: readonly string[]
  activeStrategyHint: string | null
  execution: 'none'
}

export interface OfferScoringContract {
  kind: 'travel_offer_scoring'
  scores: readonly OfferScore[]
  executed: false
  execution: 'none'
}

export interface OfferRankingContract {
  kind: 'travel_offer_ranking_contract'
  ranking: OfferRanking
  execution: 'none'
}

export interface OfferExplanationContract {
  kind: 'travel_offer_explanation_contract'
  explanation: OfferExplanation
  execution: 'none'
}

export interface OfferConfidenceContract {
  kind: 'travel_offer_confidence_contract'
  confidence: OfferConfidence
  execution: 'none'
}

export interface OfferValidationContract {
  kind: 'travel_offer_validation_contract'
  validation: OfferValidation
  execution: 'none'
}

export interface OfferLifecycleContract {
  kind: 'travel_offer_lifecycle'
  actions: readonly string[]
  currentActionHint: string | null
  execution: 'none'
}

export interface OfferSnapshotContract {
  kind: 'travel_offer_snapshot_contract'
  snapshot: OfferSnapshot
  execution: 'none'
}

export interface OfferRevisionContract {
  kind: 'travel_offer_revision_contract'
  revisions: readonly OfferRevision[]
  persisted: false
  execution: 'none'
}

export interface TravelOfferDecisionRegistryEntry {
  id: string
  sectionId: TravelOfferDecisionSectionId
  label: string
  enabledHint: false
}

export interface TravelOfferDecisionBlueprint {
  version: '7.10.0-offer-decision'
  featureId: 'brain.offer_decision_engine'
  architectureOnly: true
  engine: OfferDecisionEngineContract
  pipeline: OfferPipelineContract
  schema: OfferSchemaContract
  strategy: OfferStrategyContract
  scoring: OfferScoringContract
  ranking: OfferRankingContract
  explanation: OfferExplanationContract
  confidence: OfferConfidenceContract
  validation: OfferValidationContract
  lifecycle: OfferLifecycleContract
  snapshot: OfferSnapshotContract
  revision: OfferRevisionContract
  /** Output contract samples */
  offerCandidate: OfferCandidate
  offerBundle: OfferBundle
  offerDecision: OfferDecision
  offerRanking: OfferRanking
  offerScore: OfferScore
  offerExplanation: OfferExplanation
  offerConfidence: OfferConfidence
  offerValidation: OfferValidation
  offerRevision: OfferRevision
  offerSnapshot: OfferSnapshot
  registry: readonly TravelOfferDecisionRegistryEntry[]
  inputHints: readonly string[]
}

export const TRAVEL_OFFER_DECISION_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoRuntime: false,
  wiredIntoLlms: false,
  wiredIntoProviderApis: false,
  booking: false,
  pricing: false,
  payments: false,
  httpRequests: false,
  wiredIntoDatabase: false,
  wiredIntoStorage: false,
  wiredIntoOcr: false,
  wiredIntoAuth: false,
  recommendationExecuted: false,
  distinctFromTravelRecommendation: true,
  distinctFromPersonalizationEngine: true,
  distinctFromAiRecommendationEngine: true,
} as const

export const TRAVEL_OFFER_DECISION_SECTION_IDS: readonly TravelOfferDecisionSectionId[] =
  [
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
  ] as const

export const TRAVEL_OFFER_PIPELINE_STAGES = [
  'attach_recommendation_results',
  'attach_traveler_preferences',
  'attach_price_signals',
  'attach_quality_signals',
  'attach_business_rules',
  'build_offer_candidates',
  'build_offer_bundles',
  'apply_strategy',
  'score_offers',
  'rank_offers',
  'select_best_offer',
  'explain_decision',
  'score_confidence',
  'validate',
  'snapshot',
] as const

export type TravelOfferPipelineStageId =
  (typeof TRAVEL_OFFER_PIPELINE_STAGES)[number]

export const TRAVEL_OFFER_LIFECYCLE_ACTIONS = [
  'ingest',
  'score',
  'rank',
  'decide',
  'explain',
  'validate',
  'snapshot',
  'revise',
  'close',
] as const

export const TRAVEL_OFFER_INPUT_HINTS = [
  'recommendation_results',
  'traveler_preferences',
  'price_signals',
  'quality_signals',
  'business_rules',
  'decision_strategy',
] as const

export const TRAVEL_OFFER_SCORE_DIMENSIONS = [
  'price_fit',
  'quality_fit',
  'preference_fit',
  'business_rule_fit',
  'bundle_value_fit',
] as const

export const TRAVEL_OFFER_STRATEGY_HINTS = [
  'best_overall',
  'best_value',
  'prefer_quality',
  'prefer_price',
  'prefer_preferences',
  'business_rules_first',
] as const
