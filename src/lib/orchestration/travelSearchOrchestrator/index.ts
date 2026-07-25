/**
 * Phase 7 Stage 8 — Travel Search Orchestrator barrel.
 *
 * Architecture / contracts / types / blueprints only.
 * Gated by `brain.search_orchestrator` (default OFF).
 * Distinct from Sprint 24 `brain.search`.
 * NEVER calls providers — orchestration architecture only.
 * No Runtime, HTTP, SDKs, provider APIs, DB, storage, booking, pricing, LLM.
 */

import { SEARCH_ORCHESTRATOR_ISOLATION as SO_ISOLATION } from './types'
import {
  SEARCH_INPUT_HINTS,
  SEARCH_LIFECYCLE_ACTIONS,
  SEARCH_PIPELINE_STAGES,
  SEARCH_PROVIDER_KINDS,
  SEARCH_SECTION_IDS,
} from './types'

export {
  BRAIN_SEARCH_ORCHESTRATOR_FEATURE_ID,
  isBrainSearchOrchestratorEnabled,
  listSearchRegistry,
  listSearchSectionIds,
  SearchRegistry,
  SEARCH_REGISTRY,
} from './registry'

export type {
  SearchLocale,
  SearchProviderKind,
  SearchSectionId,
  SearchPipelineStageId,
  SearchRequest,
  SearchCandidate,
  ProviderRequest,
  ProviderResponse,
  SearchResult,
  SearchRanking,
  SearchScore,
  SearchValidation,
  SearchSnapshot,
  SearchRevision,
  SearchOrchestratorContract,
  SearchPipelineContract,
  SearchSchemaContract,
  SearchContractsBundle,
  SearchValidationContract,
  SearchLifecycleContract,
  ProviderAbstractionContract,
  SearchStrategyContract,
  SearchRankingContract,
  SearchNormalizationContract,
  SearchAggregationContract,
  SearchConfidenceContract,
  SearchSnapshotContract,
  SearchRevisionContract,
  SearchRegistryEntry,
  TravelSearchOrchestratorBlueprint,
} from './types'

export {
  SEARCH_ORCHESTRATOR_ISOLATION,
  SEARCH_PROVIDER_KINDS,
  SEARCH_SECTION_IDS,
  SEARCH_PIPELINE_STAGES,
  SEARCH_LIFECYCLE_ACTIONS,
  SEARCH_INPUT_HINTS,
} from './types'

export {
  buildSearchOrchestrator,
  buildSearchPipeline,
  buildSearchSchema,
  buildSearchContracts,
  buildSearchValidationContract,
  buildSearchLifecycle,
  buildProviderAbstraction,
  buildSearchStrategy,
  buildSearchRankingContract,
  buildSearchNormalization,
  buildSearchAggregation,
  buildSearchConfidence,
  buildSearchSnapshotContract,
  buildSearchRevisionContract,
  buildSearchRequestSample,
  buildSearchCandidateSample,
  buildProviderRequestSample,
  buildProviderResponseSample,
  buildSearchResultSample,
  buildSearchRankingSample,
  buildSearchScoreSample,
  buildSearchValidationSample,
  buildSearchSnapshotSample,
  buildSearchRevisionSample,
} from './pipelines'

export {
  TravelSearchOrchestrator,
  buildTravelSearchOrchestratorBlueprint,
  tryBuildTravelSearchOrchestratorBlueprint,
  assertSearchOrchestratorIsolation,
} from './engine'
export type { BuildSearchOrchestratorBlueprintOptions } from './engine'

export const SEARCH_ORCHESTRATOR_ARCHITECTURE = {
  version: '7.8.0-search-orchestrator',
  featureId: 'brain.search_orchestrator' as const,
  architectureOnly: true,
  components: [
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
    'search_request_output',
    'search_candidate_output',
    'provider_request_output',
    'provider_response_output',
    'search_result_output',
    'search_ranking_output',
    'search_score_output',
    'search_validation_output',
    'search_snapshot_output',
    'search_revision_output',
  ] as const,
  pipelineStages: SEARCH_PIPELINE_STAGES,
  lifecycleActions: SEARCH_LIFECYCLE_ACTIONS,
  providerKinds: SEARCH_PROVIDER_KINDS,
  inputHints: SEARCH_INPUT_HINTS,
  sectionIds: SEARCH_SECTION_IDS,
  ...SO_ISOLATION,
} as const
