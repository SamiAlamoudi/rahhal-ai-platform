/**
 * Integration Sprint 2 — conversation → live flight search orchestrator.
 *
 * When `ai.live_flight_search` is OFF (default), returns null so the existing
 * Flight Search Engine mock path is unchanged.
 */

import type { FlightSearchEngine } from '../flightSearchEngine'
import { createFlightSearchEngine } from '../flightSearchEngine'
import { isLiveFlightSearchEnabled, runLiveFlightSearch } from '../liveFlightSearch'
import type { RahhalFlightSearchOffer } from '../liveFlightSearch'
import type { UnifiedFlight } from '../flightSearchEngine'
import type { AgentToolContext } from '../tools/types'
import {
  ConversationFlightSearchCache,
  getConversationFlightSearchCache,
} from './cache'
import { buildConsultantFlightSummary, highlightLines } from './consultantSummary'
import {
  adultsFromContext,
  buildEngineRequestFromContext,
  buildLiveCriteriaFromContext,
  childrenFromContext,
  preferredAirlineFromContext,
  preferredDepartureFromContext,
  timezoneFromContext,
} from './criteriaFromContext'
import { rankConversationFlights } from './rankingExplain'
import {
  INTEGRATION_LIVE_FLIGHT_SEARCH_VERSION,
  type ConversationFlightSearchResult,
  type RankedConversationFlight,
} from './types'

export type ConversationFlightSearchDeps = {
  enabled?: boolean
  cache?: ConversationFlightSearchCache
  runLive?: typeof runLiveFlightSearch
  engine?: FlightSearchEngine
  /** When live fails, fall back to mock engine (default true). */
  fallbackToMock?: boolean
}

function rahhalToRankable(flight: RahhalFlightSearchOffer) {
  return {
    id: flight.id,
    providerId: flight.providerId,
    airline: flight.airline,
    flightNumber: flight.carrierCode,
    origin: flight.origin,
    destination: flight.destination,
    departureAt: flight.departureAt,
    arrivalAt: flight.arrivalAt,
    durationMinutes: flight.durationMinutes,
    stops: flight.stops,
    cabin: flight.cabin,
    fareFamily: null as string | null,
    price: flight.price,
    currency: flight.currency,
    baggage: null as string | null,
    refundable: flight.refundable,
  }
}

function unifiedToRankable(flight: UnifiedFlight) {
  return {
    id: flight.id,
    providerId: flight.provider,
    airline: flight.airline,
    flightNumber: flight.flightNumber,
    origin: flight.origin,
    destination: flight.destination,
    departureAt: flight.departureTime,
    arrivalAt: flight.arrivalTime,
    durationMinutes: flight.duration,
    stops: flight.stops,
    cabin: flight.cabin,
    fareFamily: flight.fareFamily,
    price: flight.price,
    currency: flight.currency,
    baggage: flight.baggage,
    refundable: flight.refundable,
  }
}

function toToolOffers(ranked: RankedConversationFlight[], travelers: number): Record<string, unknown>[] {
  return ranked.map((f) => ({
    id: f.id,
    airline: f.airline,
    flightNumber: f.flightNumber,
    from: f.origin,
    to: f.destination,
    cabin: f.cabin,
    stops: f.stops,
    durationHours: f.durationMinutes != null ? Math.round((f.durationMinutes / 60) * 10) / 10 : null,
    durationMinutes: f.durationMinutes,
    price: f.price,
    currency: f.currency,
    travelers,
    refundable: f.refundable,
    baggage: f.baggage,
    provider: f.providerId,
    score: f.score,
    departureTime: f.departureAt,
    arrivalTime: f.arrivalAt,
    fareFamily: f.fareFamily,
    why: f.whyEn,
    whyAr: f.whyAr,
    reasons: f.reasons,
  }))
}

function finalize(
  ranked: RankedConversationFlight[],
  meta: {
    usedLive: boolean
    cacheHit: boolean
    empty: boolean
    gracefulMessage?: string
    latencyMs: number
    providerId: string | null
    origin: string
    destination: string
    departureDate: string
    returnDate: string | null
    adults: number
    children: number
    cabin: string | null
    currency: string
    timezone: string | null
  },
): ConversationFlightSearchResult {
  const summary = buildConsultantFlightSummary(ranked, {
    origin: meta.origin,
    destination: meta.destination,
    departureDate: meta.departureDate,
    returnDate: meta.returnDate,
    empty: meta.empty,
    graceful: Boolean(meta.gracefulMessage),
  })
  return {
    version: INTEGRATION_LIVE_FLIGHT_SEARCH_VERSION,
    usedLive: meta.usedLive,
    cacheHit: meta.cacheHit,
    empty: meta.empty,
    gracefulMessage: meta.gracefulMessage,
    offers: ranked,
    highlights: highlightLines(ranked),
    consultantSummaryAr: summary.ar,
    consultantSummaryEn: summary.en,
    diagnostics: {
      providerId: meta.providerId,
      latencyMs: meta.latencyMs,
      adults: meta.adults,
      children: meta.children,
      cabin: meta.cabin,
      currency: meta.currency,
      origin: meta.origin,
      destination: meta.destination,
      departureDate: meta.departureDate,
      returnDate: meta.returnDate,
      timezone: meta.timezone,
    },
  }
}

/**
 * Run conversation flight search when live flag is ON.
 * Returns null when flag is OFF (caller keeps existing engine path).
 */
export async function tryConversationLiveFlightSearch(
  ctx: AgentToolContext,
  deps: ConversationFlightSearchDeps = {},
): Promise<ConversationFlightSearchResult | null> {
  if (!isLiveFlightSearchEnabled({ enabled: deps.enabled })) {
    return null
  }

  const criteria = buildLiveCriteriaFromContext(ctx)
  const adults = adultsFromContext(ctx)
  const children = childrenFromContext(ctx)
  const timezone = timezoneFromContext(ctx)
  const prefs = {
    preferredAirline: preferredAirlineFromContext(ctx),
    preferredDepartureTime: preferredDepartureFromContext(ctx),
    maxPrice: ctx.requirements.budgetAmount,
  }

  const cache = deps.cache ?? getConversationFlightSearchCache()
  const cacheKey = ConversationFlightSearchCache.key({
    origin: criteria.origin,
    destination: criteria.destination,
    departureDate: criteria.departureDate,
    returnDate: criteria.returnDate ?? null,
    adults,
    children,
    cabin: criteria.cabin ?? null,
    currency: criteria.currency ?? 'SAR',
    preferredAirline: prefs.preferredAirline,
    preferredDepartureTime: prefs.preferredDepartureTime,
    live: true,
  })

  const cached = cache.get(cacheKey)
  if (cached) return cached

  const started = Date.now()
  const runLive = deps.runLive ?? runLiveFlightSearch
  const live = await runLive(criteria, {
    enabled: true,
    timeoutMs: criteria.timeoutMs,
  })

  if (live.enabled && live.ok && !live.empty && live.flights.length > 0) {
    const ranked = rankConversationFlights(live.flights.map(rahhalToRankable), prefs)
    const result = finalize(ranked, {
      usedLive: true,
      cacheHit: false,
      empty: false,
      latencyMs: live.latencyMs || Date.now() - started,
      providerId: live.meta.providerId ?? 'amadeus',
      origin: criteria.origin,
      destination: criteria.destination,
      departureDate: criteria.departureDate,
      returnDate: criteria.returnDate ?? null,
      adults,
      children,
      cabin: criteria.cabin ?? null,
      currency: criteria.currency ?? 'SAR',
      timezone,
    })
    cache.set(cacheKey, result)
    return result
  }

  const fallbackToMock = deps.fallbackToMock !== false
  if (!fallbackToMock) {
    return finalize([], {
      usedLive: true,
      cacheHit: false,
      empty: true,
      gracefulMessage:
        live.error?.message
        ?? (ctx.locale === 'ar'
          ? 'تعذّر البحث الحي عن الطيران حالياً'
          : 'Live flight search is temporarily unavailable'),
      latencyMs: Date.now() - started,
      providerId: live.meta.providerId,
      origin: criteria.origin,
      destination: criteria.destination,
      departureDate: criteria.departureDate,
      returnDate: criteria.returnDate ?? null,
      adults,
      children,
      cabin: criteria.cabin ?? null,
      currency: criteria.currency ?? 'SAR',
      timezone,
    })
  }

  // Graceful fallback — mock engine (never crash conversation).
  const engine = deps.engine ?? createFlightSearchEngine({ forceMock: true })
  const request = buildEngineRequestFromContext(ctx)
  const page =
    request.tripType === 'one_way'
      ? await engine.searchOneWay(request)
      : request.tripType === 'multi_city'
        ? await engine.searchMultiCity(request)
        : await engine.searchRoundTrip(request)

  const ranked = rankConversationFlights(page.flights.map(unifiedToRankable), prefs)
  const result = finalize(ranked, {
    usedLive: false,
    cacheHit: false,
    empty: ranked.length === 0,
    gracefulMessage: live.enabled
      ? (live.error?.message ?? page.diagnostics.gracefulMessage)
      : page.diagnostics.gracefulMessage,
    latencyMs: Date.now() - started,
    providerId: page.diagnostics.providersUsed[0] ?? 'mock',
    origin: criteria.origin,
    destination: criteria.destination,
    departureDate: criteria.departureDate,
    returnDate: criteria.returnDate ?? null,
    adults,
    children,
    cabin: criteria.cabin ?? null,
    currency: criteria.currency ?? 'SAR',
    timezone,
  })
  cache.set(cacheKey, result)
  return result
}

/** Convert Sprint 2 result into tool payload used by createMockFlightSearchTool. */
export function conversationResultToToolData(
  result: ConversationFlightSearchResult,
  travelers: number,
): Record<string, unknown> {
  return {
    offers: toToolOffers(result.offers, travelers),
    currency: result.diagnostics.currency,
    searchEngine: result.usedLive ? 'liveFlightSearch' : 'flightSearchEngine',
    engineVersion: result.version,
    usedLive: result.usedLive,
    cacheHit: result.cacheHit,
    diagnostics: {
      ...result.diagnostics,
      cacheHit: result.cacheHit,
      usedLive: result.usedLive,
    },
    highlights: result.highlights,
    consultantSummaryAr: result.consultantSummaryAr,
    consultantSummaryEn: result.consultantSummaryEn,
  }
}
