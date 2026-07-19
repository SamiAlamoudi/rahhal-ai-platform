/**
 * Sprint 24 — Search Aggregation Engine public surface.
 */

export type {
  SearchOptionKind,
  FlightOption,
  HotelOption,
  TransportOption,
  ActivityOption,
  PackageOption,
  SearchOption,
  SearchResult,
  SearchCollection,
  RankingFactorScores,
  RecommendationCandidate,
  SearchRecommendation,
  AggregationTimelineEntry,
  SearchAggregationTurnResult,
  SearchAggregationContext,
  SearchAggregationEngineOptions,
} from './types'

export {
  SearchAggregationEngine,
  aggregateSearch,
  aggregateFromExecution,
} from './searchAggregationEngine'
export type { SearchAggregationEngineHandle } from './searchAggregationEngine'

export { normalizeExecutionResults, deduplicateOptions } from './normalize'
export { rankAndScoreOptions } from './rank'
export type { RankingContext } from './rank'
export { buildSearchRecommendation } from './recommend'
