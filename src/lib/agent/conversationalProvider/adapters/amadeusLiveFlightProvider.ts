/**
 * Sprint 80 P1-4 — Amadeus LiveFlightProvider for the conversational pilot.
 *
 * Calls Sprint 105 `runLiveFlightSearch` directly (no Integration mock fallback).
 * Failures surface as ok:false so the pilot can fall back to legacy silently.
 */

import {
  adultsFromContext,
  buildLiveCriteriaFromContext,
  childrenFromContext,
  preferredAirlineFromContext,
  preferredDepartureFromContext,
  timezoneFromContext,
} from '../../integrationFlightSearch/criteriaFromContext'
import { conversationResultToToolData } from '../../integrationFlightSearch/conversationFlightSearch'
import { buildConsultantFlightSummary, highlightLines } from '../../integrationFlightSearch/consultantSummary'
import { rankConversationFlights } from '../../integrationFlightSearch/rankingExplain'
import {
  INTEGRATION_LIVE_FLIGHT_SEARCH_VERSION,
  type ConversationFlightSearchResult,
  type RankedConversationFlight,
} from '../../integrationFlightSearch/types'
import {
  runLiveFlightSearch,
  type LiveFlightSearchResult,
  type RahhalFlightSearchOffer,
} from '../../liveFlightSearch'
import type { AgentToolContext } from '../../tools/types'
import {
  classifyConversationalProviderFailure,
  mapLiveFlightErrorCode,
} from '../errors'
import type {
  ConversationalTravelProvider,
  UnifiedProviderRequest,
  UnifiedProviderSearchResult,
} from '../types'

export const AMADEUS_LIVE_FLIGHT_PROVIDER_ID = 'amadeus' as const

export type AmadeusLiveFlightProviderDeps = {
  getContext: () => AgentToolContext
  /** Injectable for unit tests. */
  runLive?: typeof runLiveFlightSearch
  /** Force availability (pilot path registers only when pilot is ON). */
  available?: boolean
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

function assertParsableOffers(flights: RahhalFlightSearchOffer[]): void {
  for (const flight of flights) {
    if (!flight || typeof flight !== 'object') {
      throw new Error('parse_failure: malformed flight offer')
    }
    if (typeof flight.id !== 'string' || !flight.id) {
      throw new Error('parse_failure: flight offer missing id')
    }
    if (typeof flight.origin !== 'string' || typeof flight.destination !== 'string') {
      throw new Error('parse_failure: flight offer missing route')
    }
  }
}

function toConversationResult(
  live: LiveFlightSearchResult,
  ctx: AgentToolContext,
  adults: number,
  children: number,
): ConversationFlightSearchResult {
  assertParsableOffers(live.flights)
  const criteria = buildLiveCriteriaFromContext(ctx)
  const prefs = {
    preferredAirline: preferredAirlineFromContext(ctx),
    preferredDepartureTime: preferredDepartureFromContext(ctx),
    maxPrice: ctx.requirements.budgetAmount,
  }
  const ranked = rankConversationFlights(live.flights.map(rahhalToRankable), prefs)
  const summary = buildConsultantFlightSummary(ranked, {
    origin: criteria.origin,
    destination: criteria.destination,
    departureDate: criteria.departureDate,
    returnDate: criteria.returnDate ?? null,
    empty: ranked.length === 0,
    graceful: false,
  })
  return {
    version: INTEGRATION_LIVE_FLIGHT_SEARCH_VERSION,
    usedLive: true,
    cacheHit: false,
    empty: ranked.length === 0,
    offers: ranked,
    highlights: highlightLines(ranked),
    consultantSummaryAr: summary.ar,
    consultantSummaryEn: summary.en,
    diagnostics: {
      providerId: live.meta.providerId ?? 'amadeus',
      latencyMs: live.latencyMs,
      adults,
      children,
      cabin: criteria.cabin ?? null,
      currency: criteria.currency ?? 'SAR',
      origin: criteria.origin,
      destination: criteria.destination,
      departureDate: criteria.departureDate,
      returnDate: criteria.returnDate ?? null,
      timezone: timezoneFromContext(ctx),
    },
  }
}

/**
 * Production Amadeus adapter used by the P1-4 flight pilot.
 * Alias: LiveFlightProvider (Amadeus).
 */
export function createAmadeusLiveFlightProvider(
  deps: AmadeusLiveFlightProviderDeps,
): ConversationalTravelProvider {
  return {
    providerId: AMADEUS_LIVE_FLIGHT_PROVIDER_ID,
    domain: 'flights',
    displayName: 'LiveFlightProvider (Amadeus)',
    capabilities: () => ({ domain: 'flights', search: true, live: true }),
    isAvailable: () => deps.available !== false,
    async search(_request: UnifiedProviderRequest): Promise<UnifiedProviderSearchResult> {
      const started = Date.now()
      const ctx = deps.getContext()
      const providerId = AMADEUS_LIVE_FLIGHT_PROVIDER_ID

      try {
        const adults = adultsFromContext(ctx)
        if (adults == null) {
          return {
            ok: false,
            domain: 'flights',
            providerId,
            mode: 'unavailable',
            offers: [],
            empty: true,
            latencyMs: Date.now() - started,
            toolData: { offers: [] },
            error: 'search_blocked_travelers_unconfirmed',
            errorCode: 'INVALID_REQUEST',
          }
        }

        const criteria = buildLiveCriteriaFromContext(ctx)
        const runLive = deps.runLive ?? runLiveFlightSearch
        // Pilot path always attempts live (flag gating is at toolBridge).
        const live = await runLive(criteria, { enabled: true })

        if (!live.enabled) {
          return {
            ok: false,
            domain: 'flights',
            providerId,
            mode: 'unavailable',
            offers: [],
            empty: true,
            latencyMs: Date.now() - started,
            toolData: { offers: [] },
            error: 'Live flight search disabled',
            errorCode: 'DISABLED',
          }
        }

        if (!live.ok || live.error) {
          const errorCode = mapLiveFlightErrorCode(live.error)
          return {
            ok: false,
            domain: 'flights',
            providerId,
            mode: 'live',
            offers: [],
            empty: true,
            latencyMs: Date.now() - started,
            toolData: { offers: [] },
            error: live.error?.code ?? 'live_flight_search_failed',
            errorCode,
          }
        }

        const children = childrenFromContext(ctx)
        const conversation = toConversationResult(live, ctx, adults, children)
        const travelers = adults + children
        const toolData = conversationResultToToolData(conversation, travelers)

        return {
          ok: true,
          domain: 'flights',
          providerId,
          mode: 'live',
          offers: conversation.offers.map((f: RankedConversationFlight) => ({
            id: f.id,
            domain: 'flights' as const,
            providerId,
            title: `${f.airline ?? ''} ${f.origin}→${f.destination}`.trim(),
            price: f.price,
            currency: f.currency,
            score: f.score,
            raw: f as unknown as Record<string, unknown>,
          })),
          empty: conversation.empty,
          latencyMs: Date.now() - started,
          // Exact legacy live tool schema — no conversationalProvider bag.
          toolData,
        }
      } catch (err) {
        const classified = classifyConversationalProviderFailure(providerId, err)
        const errorCode =
          classified.code === 'UNKNOWN' && /parse_failure/i.test(classified.message)
            ? 'PARSE_FAILURE'
            : classified.code === 'UNKNOWN' && /parse|malformed|mapper/i.test(classified.message)
              ? 'PARSE_FAILURE'
              : classified.code
        return {
          ok: false,
          domain: 'flights',
          providerId,
          mode: 'live',
          offers: [],
          empty: true,
          latencyMs: Date.now() - started,
          toolData: { offers: [] },
          error: classified.message,
          errorCode,
        }
      }
    },
  }
}

/** @deprecated Alias — prefer createAmadeusLiveFlightProvider. */
export const createLiveFlightProvider = createAmadeusLiveFlightProvider
