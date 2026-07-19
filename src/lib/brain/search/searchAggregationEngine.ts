/**
 * Sprint 24 — Search Aggregation Engine
 *
 * ExecutionPlan / ExecutionResults → normalize → dedupe → rank → score → recommend.
 * Mock providers only (via Sprint 23 execution payloads). No live APIs.
 */

import type { TripPlan } from '../tripPlanning/types'
import { normalizeExecutionResults, deduplicateOptions } from './normalize'
import { rankAndScoreOptions, type RankingContext } from './rank'
import { buildSearchRecommendation } from './recommend'
import type {
  AggregationTimelineEntry,
  FlightOption,
  HotelOption,
  TransportOption,
  ActivityOption,
  PackageOption,
  SearchAggregationContext,
  SearchAggregationEngineOptions,
  SearchAggregationTurnResult,
  SearchCollection,
  SearchOption,
} from './types'

export type {
  AggregationTimelineEntry,
  FlightOption,
  HotelOption,
  TransportOption,
  ActivityOption,
  PackageOption,
  SearchOption,
  SearchOptionKind,
  SearchResult,
  SearchCollection,
  RankingFactorScores,
  RecommendationCandidate,
  SearchRecommendation,
  SearchAggregationContext,
  SearchAggregationTurnResult,
  SearchAggregationEngineOptions,
} from './types'

export { normalizeExecutionResults, deduplicateOptions } from './normalize'
export { rankAndScoreOptions } from './rank'
export type { RankingContext } from './rank'
export { buildSearchRecommendation } from './recommend'

function nowIso(): string {
  return new Date().toISOString()
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}

function timelineEntry(
  stage: AggregationTimelineEntry['stage'],
  detail: string,
  count?: number,
): AggregationTimelineEntry {
  return {
    id: newId('agg'),
    stage,
    at: nowIso(),
    detail,
    ...(count != null ? { count } : {}),
  }
}

function buildCollection(
  ctx: SearchAggregationContext,
  options: SearchOption[],
): SearchCollection {
  const flights: FlightOption[] = []
  const hotels: HotelOption[] = []
  const transport: TransportOption[] = []
  const activities: ActivityOption[] = []
  const packages: PackageOption[] = []

  for (const option of options) {
    switch (option.kind) {
      case 'flight':
        flights.push(option)
        break
      case 'hotel':
        hotels.push(option)
        break
      case 'transport':
        transport.push(option)
        break
      case 'activity':
        activities.push(option)
        break
      case 'package':
        packages.push(option)
        break
    }
  }

  return {
    id: newId('scol'),
    conversationId: ctx.conversationId,
    executionPlanId: ctx.executionPlan.id,
    tripPlanId: ctx.executionPlan.tripPlanId,
    flights,
    hotels,
    transport,
    activities,
    packages,
    all: options,
    createdAt: nowIso(),
  }
}

function rankingContextFrom(
  ctx: SearchAggregationContext,
  extras: RankingContext = {},
): RankingContext {
  const tripPlan = ctx.tripPlan ?? extras.tripPlan
  return {
    tripPlan,
    budgetAmount: extras.budgetAmount ?? tripPlan?.budget.amount ?? null,
    preferredAirlines:
      extras.preferredAirlines ?? tripPlan?.airlinePreferences ?? [],
    preferredHotels: extras.preferredHotels ?? tripPlan?.hotelPreferences ?? [],
    activities: extras.activities ?? tripPlan?.activities ?? [],
    notes: extras.notes ?? tripPlan?.notes ?? null,
  }
}

/**
 * Aggregate provider results into a ranked recommendation list.
 */
export function aggregateSearch(
  ctx: SearchAggregationContext,
  options: SearchAggregationEngineOptions = {},
): SearchAggregationTurnResult {
  const timeline: AggregationTimelineEntry[] = []
  const results = ctx.executionResults
  const providerCallCount = results.length

  timeline.push(
    timelineEntry(
      'provider_results',
      `${providerCallCount} provider result(s) from plan ${ctx.executionPlan.id}`,
      providerCallCount,
    ),
  )

  const raw = normalizeExecutionResults(results)
  timeline.push(
    timelineEntry('normalize', `Normalized ${raw.length} option(s)`, raw.length),
  )

  const deduped = deduplicateOptions(raw)
  timeline.push(
    timelineEntry(
      'deduplicate',
      `Deduplicated to ${deduped.length} option(s) (removed ${raw.length - deduped.length})`,
      deduped.length,
    ),
  )

  const ranked = rankAndScoreOptions(deduped, rankingContextFrom(ctx))
  timeline.push(
    timelineEntry(
      'ranking',
      ranked[0]
        ? `Ranked ${ranked.length} candidate(s); top score ${ranked[0].score}`
        : `Ranked ${ranked.length} candidate(s)`,
      ranked.length,
    ),
  )

  timeline.push(
    timelineEntry(
      'scoring',
      ranked[0]
        ? `Top confidence ${ranked[0].confidence} · factors applied`
        : 'No candidates to score',
      ranked.length,
    ),
  )

  const recommendation = buildSearchRecommendation(ranked, {
    maxAlternatives: options.maxAlternatives ?? 3,
  })

  timeline.push(
    timelineEntry(
      'recommendation',
      recommendation.top
        ? `Top: ${recommendation.top.title} (${recommendation.confidenceScore})`
        : 'No recommendation',
      recommendation.alternatives.length + (recommendation.top ? 1 : 0),
    ),
  )

  return {
    collection: buildCollection(ctx, deduped),
    results: ranked,
    recommendation,
    timeline,
    providerCallCount,
    rankedCount: ranked.length,
  }
}

/**
 * Convenience: aggregate from trip plan + execution artifacts.
 */
export function aggregateFromExecution(
  conversationId: string,
  executionPlan: SearchAggregationContext['executionPlan'],
  executionResults: SearchAggregationContext['executionResults'],
  tripPlan?: TripPlan | null,
  engineOptions?: SearchAggregationEngineOptions,
): SearchAggregationTurnResult {
  return aggregateSearch(
    {
      conversationId,
      executionPlan,
      executionResults,
      tripPlan: tripPlan ?? undefined,
    },
    engineOptions,
  )
}

/**
 * SearchAggregationEngine factory (session-light; aggregation is pure).
 */
export function SearchAggregationEngine(
  options: SearchAggregationEngineOptions = {},
) {
  return {
    aggregate(ctx: SearchAggregationContext): SearchAggregationTurnResult {
      return aggregateSearch(ctx, options)
    },
  }
}

export type SearchAggregationEngineHandle = ReturnType<typeof SearchAggregationEngine>
