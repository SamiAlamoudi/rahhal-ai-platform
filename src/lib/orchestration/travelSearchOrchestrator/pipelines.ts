/**
 * Travel Search Orchestrator contracts — pure builders, no provider calls.
 */

import type {
  ProviderAbstractionContract,
  ProviderRequest,
  ProviderResponse,
  SearchAggregationContract,
  SearchCandidate,
  SearchConfidenceContract,
  SearchContractsBundle,
  SearchLifecycleContract,
  SearchNormalizationContract,
  SearchOrchestratorContract,
  SearchPipelineContract,
  SearchRanking,
  SearchRankingContract,
  SearchRequest,
  SearchResult,
  SearchRevision,
  SearchRevisionContract,
  SearchSchemaContract,
  SearchScore,
  SearchSnapshot,
  SearchSnapshotContract,
  SearchStrategyContract,
  SearchValidation,
  SearchValidationContract,
} from './types'
import {
  SEARCH_LIFECYCLE_ACTIONS,
  SEARCH_PIPELINE_STAGES,
  SEARCH_PROVIDER_KINDS,
} from './types'

const ISO = '2026-07-25T00:00:00.000Z'
const REQUEST_ID = 'sreq-architecture'

export function buildSearchOrchestrator(): SearchOrchestratorContract {
  return {
    kind: 'travel_search_orchestrator',
    version: '7.8.0-search-orchestrator',
    execution: 'none',
    providerCalled: false,
  }
}

export function buildSearchPipeline(): SearchPipelineContract {
  return {
    kind: 'search_pipeline',
    stages: SEARCH_PIPELINE_STAGES,
    execution: 'none',
  }
}

export function buildSearchSchema(): SearchSchemaContract {
  return {
    kind: 'search_schema',
    outputKinds: [
      'search_request',
      'search_candidate',
      'provider_request',
      'provider_response',
      'search_result',
      'search_ranking',
      'search_score',
      'search_validation',
      'search_snapshot',
      'search_revision',
    ],
    execution: 'none',
  }
}

export function buildSearchContracts(): SearchContractsBundle {
  return {
    kind: 'search_contracts',
    contractIds: [
      'SearchRequest',
      'SearchCandidate',
      'ProviderRequest',
      'ProviderResponse',
      'SearchResult',
      'SearchRanking',
      'SearchScore',
      'SearchValidation',
      'SearchSnapshot',
      'SearchRevision',
    ],
    execution: 'none',
  }
}

export function buildSearchRequestSample(): SearchRequest {
  return {
    kind: 'search_request',
    requestId: REQUEST_ID,
    providerKinds: SEARCH_PROVIDER_KINDS,
    destinationHint: null,
    dateHints: [],
    budgetHint: null,
    execution: 'none',
    providerCalled: false,
  }
}

export function buildSearchCandidateSample(): SearchCandidate {
  return {
    kind: 'search_candidate',
    candidateId: 'scand-architecture',
    providerKind: 'generic_future',
    labelHint: 'architecture_placeholder',
    execution: 'none',
  }
}

export function buildProviderRequestSample(): ProviderRequest {
  return {
    kind: 'provider_request',
    providerRequestId: 'preq-architecture',
    providerKind: 'generic_future',
    payloadShapeHint: 'unified_search_shape',
    execution: 'none',
    sent: false,
  }
}

export function buildProviderResponseSample(): ProviderResponse {
  return {
    kind: 'provider_response',
    providerResponseId: 'pres-architecture',
    providerKind: 'generic_future',
    received: false,
    execution: 'none',
  }
}

export function buildSearchResultSample(): SearchResult {
  return {
    kind: 'search_result',
    resultId: 'sres-architecture',
    candidateIds: [],
    execution: 'none',
  }
}

export function buildSearchRankingSample(): SearchRanking {
  return {
    kind: 'search_ranking',
    rankingId: 'srank-architecture',
    orderedCandidateIds: [],
    execution: 'none',
  }
}

export function buildSearchScoreSample(): SearchScore {
  return {
    kind: 'search_score',
    candidateId: 'scand-architecture',
    scoreHint: 0,
    execution: 'none',
  }
}

export function buildSearchValidationSample(): SearchValidation {
  return {
    kind: 'search_validation',
    requestId: REQUEST_ID,
    valid: true,
    issues: [],
    execution: 'none',
  }
}

export function buildSearchSnapshotSample(): SearchSnapshot {
  return {
    kind: 'search_snapshot',
    snapshotId: 'ssnap-architecture',
    atIso: ISO,
    requestId: REQUEST_ID,
    execution: 'none',
  }
}

export function buildSearchRevisionSample(): SearchRevision {
  return {
    kind: 'search_revision',
    revisionId: 'srev-architecture',
    requestId: REQUEST_ID,
    reasonHint: 'architecture_blueprint',
    execution: 'none',
  }
}

export function buildSearchValidationContract(): SearchValidationContract {
  return {
    kind: 'search_validation_contract',
    validation: buildSearchValidationSample(),
    execution: 'none',
  }
}

export function buildSearchLifecycle(): SearchLifecycleContract {
  return {
    kind: 'search_lifecycle',
    actions: SEARCH_LIFECYCLE_ACTIONS,
    currentActionHint: null,
    execution: 'none',
  }
}

export function buildProviderAbstraction(): ProviderAbstractionContract {
  return {
    kind: 'provider_abstraction',
    providerKinds: SEARCH_PROVIDER_KINDS,
    adapterHints: SEARCH_PROVIDER_KINDS.map(
      (kind) => `adapter_${kind}_placeholder`,
    ),
    wired: false,
    execution: 'none',
  }
}

export function buildSearchStrategy(): SearchStrategyContract {
  return {
    kind: 'search_strategy',
    strategyHints: [
      'prepare_only',
      'never_call_providers',
      'unify_request_shape',
    ],
    execution: 'none',
  }
}

export function buildSearchRankingContract(): SearchRankingContract {
  return {
    kind: 'search_ranking_contract',
    ranking: buildSearchRankingSample(),
    execution: 'none',
  }
}

export function buildSearchNormalization(): SearchNormalizationContract {
  return {
    kind: 'search_normalization',
    normalizedShapeHint: 'provider_agnostic_placeholder',
    execution: 'none',
  }
}

export function buildSearchAggregation(): SearchAggregationContract {
  return {
    kind: 'search_aggregation',
    aggregationHints: ['merge_by_provider_kind'],
    executed: false,
    execution: 'none',
  }
}

export function buildSearchConfidence(): SearchConfidenceContract {
  return {
    kind: 'search_confidence',
    scoreHint: 0,
    bandHint: 'medium',
    execution: 'none',
  }
}

export function buildSearchSnapshotContract(): SearchSnapshotContract {
  return {
    kind: 'search_snapshot_contract',
    snapshot: buildSearchSnapshotSample(),
    execution: 'none',
  }
}

export function buildSearchRevisionContract(): SearchRevisionContract {
  return {
    kind: 'search_revision_contract',
    revisions: [],
    persisted: false,
    execution: 'none',
  }
}
