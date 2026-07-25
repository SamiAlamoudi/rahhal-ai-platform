/**
 * Phase 7 Stage 8 — Travel Search Orchestrator contracts.
 * Architecture / interfaces / types / blueprints only.
 * Prepares unified search requests for future providers.
 * NEVER calls providers, HTTP, SDKs, or pricing APIs.
 */

export type SearchLocale = 'ar' | 'en'

export type SearchProviderKind =
  | 'flight'
  | 'hotel'
  | 'activity'
  | 'transport'
  | 'restaurant'
  | 'generic_future'

export type SearchSectionId =
  | 'search_orchestrator'
  | 'search_pipeline'
  | 'search_schema'
  | 'search_contracts'
  | 'search_validation'
  | 'search_lifecycle'
  | 'provider_abstraction'
  | 'search_strategy'
  | 'search_ranking'
  | 'search_normalization'
  | 'search_aggregation'
  | 'search_confidence'
  | 'search_snapshot'
  | 'search_revision'

/** Output contracts */
export interface SearchRequest {
  kind: 'search_request'
  requestId: string
  providerKinds: readonly SearchProviderKind[]
  destinationHint: string | null
  dateHints: readonly string[]
  budgetHint: string | null
  execution: 'none'
  providerCalled: false
}

export interface SearchCandidate {
  kind: 'search_candidate'
  candidateId: string
  providerKind: SearchProviderKind
  labelHint: string
  execution: 'none'
}

export interface ProviderRequest {
  kind: 'provider_request'
  providerRequestId: string
  providerKind: SearchProviderKind
  payloadShapeHint: string
  execution: 'none'
  sent: false
}

export interface ProviderResponse {
  kind: 'provider_response'
  providerResponseId: string
  providerKind: SearchProviderKind
  received: false
  execution: 'none'
}

export interface SearchResult {
  kind: 'search_result'
  resultId: string
  candidateIds: readonly string[]
  execution: 'none'
}

export interface SearchRanking {
  kind: 'search_ranking'
  rankingId: string
  orderedCandidateIds: readonly string[]
  execution: 'none'
}

export interface SearchScore {
  kind: 'search_score'
  candidateId: string
  scoreHint: number
  execution: 'none'
}

export interface SearchValidation {
  kind: 'search_validation'
  requestId: string
  valid: boolean
  issues: readonly string[]
  execution: 'none'
}

export interface SearchSnapshot {
  kind: 'search_snapshot'
  snapshotId: string
  atIso: string
  requestId: string | null
  execution: 'none'
}

export interface SearchRevision {
  kind: 'search_revision'
  revisionId: string
  requestId: string
  reasonHint: string
  execution: 'none'
}

export interface SearchOrchestratorContract {
  kind: 'travel_search_orchestrator'
  version: '7.8.0-search-orchestrator'
  execution: 'none'
  providerCalled: false
}

export interface SearchPipelineContract {
  kind: 'search_pipeline'
  stages: readonly string[]
  execution: 'none'
}

export interface SearchSchemaContract {
  kind: 'search_schema'
  outputKinds: readonly string[]
  execution: 'none'
}

export interface SearchContractsBundle {
  kind: 'search_contracts'
  contractIds: readonly string[]
  execution: 'none'
}

export interface SearchValidationContract {
  kind: 'search_validation_contract'
  validation: SearchValidation
  execution: 'none'
}

export interface SearchLifecycleContract {
  kind: 'search_lifecycle'
  actions: readonly string[]
  currentActionHint: string | null
  execution: 'none'
}

export interface ProviderAbstractionContract {
  kind: 'provider_abstraction'
  providerKinds: readonly SearchProviderKind[]
  adapterHints: readonly string[]
  wired: false
  execution: 'none'
}

export interface SearchStrategyContract {
  kind: 'search_strategy'
  strategyHints: readonly string[]
  execution: 'none'
}

export interface SearchRankingContract {
  kind: 'search_ranking_contract'
  ranking: SearchRanking
  execution: 'none'
}

export interface SearchNormalizationContract {
  kind: 'search_normalization'
  normalizedShapeHint: string
  execution: 'none'
}

export interface SearchAggregationContract {
  kind: 'search_aggregation'
  aggregationHints: readonly string[]
  executed: false
  execution: 'none'
}

export interface SearchConfidenceContract {
  kind: 'search_confidence'
  scoreHint: number
  bandHint: 'low' | 'medium' | 'high'
  execution: 'none'
}

export interface SearchSnapshotContract {
  kind: 'search_snapshot_contract'
  snapshot: SearchSnapshot
  execution: 'none'
}

export interface SearchRevisionContract {
  kind: 'search_revision_contract'
  revisions: readonly SearchRevision[]
  persisted: false
  execution: 'none'
}

export interface SearchRegistryEntry {
  id: string
  sectionId: SearchSectionId
  label: string
  enabledHint: false
}

export interface TravelSearchOrchestratorBlueprint {
  version: '7.8.0-search-orchestrator'
  featureId: 'brain.search_orchestrator'
  architectureOnly: true
  orchestrator: SearchOrchestratorContract
  pipeline: SearchPipelineContract
  schema: SearchSchemaContract
  contracts: SearchContractsBundle
  validation: SearchValidationContract
  lifecycle: SearchLifecycleContract
  providerAbstraction: ProviderAbstractionContract
  strategy: SearchStrategyContract
  ranking: SearchRankingContract
  normalization: SearchNormalizationContract
  aggregation: SearchAggregationContract
  confidence: SearchConfidenceContract
  snapshot: SearchSnapshotContract
  revision: SearchRevisionContract
  /** Output contract samples */
  searchRequest: SearchRequest
  searchCandidate: SearchCandidate
  providerRequest: ProviderRequest
  providerResponse: ProviderResponse
  searchResult: SearchResult
  searchRanking: SearchRanking
  searchScore: SearchScore
  searchValidation: SearchValidation
  searchSnapshot: SearchSnapshot
  searchRevision: SearchRevision
  registry: readonly SearchRegistryEntry[]
  inputHints: readonly string[]
}

export const SEARCH_ORCHESTRATOR_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoRuntime: false,
  httpRequests: false,
  wiredIntoSdks: false,
  wiredIntoProviderApis: false,
  wiredIntoDatabase: false,
  wiredIntoStorage: false,
  booking: false,
  pricing: false,
  wiredIntoLlms: false,
  distinctFromSprint24BrainSearch: true,
} as const

export const SEARCH_PROVIDER_KINDS: readonly SearchProviderKind[] = [
  'flight',
  'hotel',
  'activity',
  'transport',
  'restaurant',
  'generic_future',
] as const

export const SEARCH_SECTION_IDS: readonly SearchSectionId[] = [
  'search_orchestrator',
  'search_pipeline',
  'search_schema',
  'search_contracts',
  'search_validation',
  'search_lifecycle',
  'provider_abstraction',
  'search_strategy',
  'search_ranking',
  'search_normalization',
  'search_aggregation',
  'search_confidence',
  'search_snapshot',
  'search_revision',
] as const

export const SEARCH_PIPELINE_STAGES = [
  'attach_travel_plan',
  'attach_traveler_profile',
  'attach_conversation_context',
  'attach_intent',
  'attach_preferences',
  'attach_budget',
  'attach_dates',
  'attach_destination',
  'build_search_request',
  'map_provider_requests',
  'apply_strategy',
  'normalize_shapes',
  'hint_aggregation',
  'hint_ranking',
  'score_confidence',
  'validate',
  'snapshot',
] as const

export type SearchPipelineStageId = (typeof SEARCH_PIPELINE_STAGES)[number]

export const SEARCH_LIFECYCLE_ACTIONS = [
  'prepare',
  'map_providers',
  'validate',
  'snapshot',
  'revise',
  'close',
] as const

export const SEARCH_INPUT_HINTS = [
  'travel_plan',
  'traveler_profile',
  'conversation_context',
  'intent',
  'preferences',
  'budget',
  'dates',
  'destination',
] as const
