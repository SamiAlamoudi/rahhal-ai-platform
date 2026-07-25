/**
 * Travel Search Orchestrator facade — builds architecture blueprints only.
 * Never calls providers, HTTP, SDKs, or pricing APIs.
 */

import { listSearchRegistry } from './registry'
import { isBrainSearchOrchestratorEnabled } from './registry'
import {
  buildProviderAbstraction,
  buildProviderRequestSample,
  buildProviderResponseSample,
  buildSearchAggregation,
  buildSearchCandidateSample,
  buildSearchConfidence,
  buildSearchContracts,
  buildSearchLifecycle,
  buildSearchNormalization,
  buildSearchOrchestrator,
  buildSearchPipeline,
  buildSearchRankingContract,
  buildSearchRequestSample,
  buildSearchResultSample,
  buildSearchRevisionContract,
  buildSearchRevisionSample,
  buildSearchSchema,
  buildSearchScoreSample,
  buildSearchSnapshotContract,
  buildSearchStrategy,
  buildSearchValidationContract,
} from './pipelines'
import type {
  SearchLocale,
  TravelSearchOrchestratorBlueprint,
} from './types'
import {
  SEARCH_INPUT_HINTS,
  SEARCH_ORCHESTRATOR_ISOLATION,
} from './types'

export interface BuildSearchOrchestratorBlueprintOptions {
  enabled?: boolean
  sessionId?: string
  locale?: SearchLocale
}

export function buildTravelSearchOrchestratorBlueprint(
  options: BuildSearchOrchestratorBlueprintOptions = {},
): TravelSearchOrchestratorBlueprint {
  void options.sessionId
  void options.locale

  const validation = buildSearchValidationContract()
  const ranking = buildSearchRankingContract()
  const snapshot = buildSearchSnapshotContract()

  return {
    version: '7.8.0-search-orchestrator',
    featureId: 'brain.search_orchestrator',
    architectureOnly: true,
    orchestrator: buildSearchOrchestrator(),
    pipeline: buildSearchPipeline(),
    schema: buildSearchSchema(),
    contracts: buildSearchContracts(),
    validation,
    lifecycle: buildSearchLifecycle(),
    providerAbstraction: buildProviderAbstraction(),
    strategy: buildSearchStrategy(),
    ranking,
    normalization: buildSearchNormalization(),
    aggregation: buildSearchAggregation(),
    confidence: buildSearchConfidence(),
    snapshot,
    revision: buildSearchRevisionContract(),
    searchRequest: buildSearchRequestSample(),
    searchCandidate: buildSearchCandidateSample(),
    providerRequest: buildProviderRequestSample(),
    providerResponse: buildProviderResponseSample(),
    searchResult: buildSearchResultSample(),
    searchRanking: ranking.ranking,
    searchScore: buildSearchScoreSample(),
    searchValidation: validation.validation,
    searchSnapshot: snapshot.snapshot,
    searchRevision: buildSearchRevisionSample(),
    registry: listSearchRegistry(),
    inputHints: SEARCH_INPUT_HINTS,
  }
}

export function tryBuildTravelSearchOrchestratorBlueprint(
  options: BuildSearchOrchestratorBlueprintOptions = {},
): TravelSearchOrchestratorBlueprint | null {
  if (!isBrainSearchOrchestratorEnabled({ enabled: options.enabled })) {
    return null
  }
  return buildTravelSearchOrchestratorBlueprint(options)
}

export function assertSearchOrchestratorIsolation(): typeof SEARCH_ORCHESTRATOR_ISOLATION & {
  architectureOnly: boolean
  registrySize: number
} {
  return {
    ...SEARCH_ORCHESTRATOR_ISOLATION,
    architectureOnly: true,
    registrySize: listSearchRegistry().length,
  }
}

export const TravelSearchOrchestrator = {
  buildBlueprint: buildTravelSearchOrchestratorBlueprint,
  tryBuildBlueprint: tryBuildTravelSearchOrchestratorBlueprint,
  assertIsolation: assertSearchOrchestratorIsolation,
}
