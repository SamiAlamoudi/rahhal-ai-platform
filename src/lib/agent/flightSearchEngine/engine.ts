/**
 * Sprint 72 — Flight Search Engine (production-ready, additive).
 * Uses Provider Runtime without modifying it.
 */

import {
  createProviderRuntimeRegistry,
  type ProviderRuntimeRegistry,
  type ProviderRuntimeId,
  type ProviderRuntimeMode,
  GRACEFUL_PROVIDER_MESSAGE,
} from '../providerRuntime'
import { SmartCache } from '../liveProviders/cache'
import { dedupeFlights } from './dedupe'
import { applyFlightFilters } from './filters'
import { enrichMockFlight, normalizeFlightOffers } from './normalize'
import { paginateFlights } from './pagination'
import { rankFlights } from './ranking'
import { sortFlights } from './sort'
import type {
  FlightSearchDiagnostics,
  FlightSearchPage,
  FlightSearchRequest,
  FlightTripType,
  UnifiedFlight,
} from './types'
import { SPRINT72_FLIGHT_SEARCH_VERSION } from './types'

export type FlightSearchEngineOptions = {
  registry?: ProviderRuntimeRegistry
  forceMock?: boolean
  now?: () => number
  createRequestId?: () => string
  /** Integration Sprint 2 — optional search result cache (15 min flight_routes). */
  cache?: SmartCache | null
}

export type FlightSearchEngine = {
  version: string
  searchFlights(request: FlightSearchRequest): Promise<FlightSearchPage>
  searchOneWay(request: FlightSearchRequest): Promise<FlightSearchPage>
  searchRoundTrip(request: FlightSearchRequest): Promise<FlightSearchPage>
  searchMultiCity(request: FlightSearchRequest): Promise<FlightSearchPage>
}

function createRequestIdDefault(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `flt_${crypto.randomUUID()}`
  }
  return `flt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizeRequest(request: FlightSearchRequest): Required<
  Pick<
    FlightSearchRequest,
    'tripType' | 'adults' | 'currency' | 'sort' | 'pageSize' | 'parallel' | 'timeoutMs'
  >
> &
  FlightSearchRequest {
  const tripType: FlightTripType =
    request.tripType
    ?? (request.legs && request.legs.length > 1
      ? 'multi_city'
      : request.returnDate
        ? 'round_trip'
        : 'one_way')

  return {
    ...request,
    tripType,
    adults: request.adults ?? 1,
    currency: request.currency ?? 'SAR',
    sort: request.sort ?? 'recommendation',
    pageSize: request.pageSize ?? 20,
    parallel: request.parallel !== false,
    timeoutMs: request.timeoutMs ?? 8_000,
    origin: (request.origin ?? request.legs?.[0]?.origin ?? 'RUH').toUpperCase(),
    destination: (request.destination ?? request.legs?.[0]?.destination ?? 'DXB').toUpperCase(),
    departureDate: request.departureDate ?? request.legs?.[0]?.departureDate ?? '2026-08-01',
  }
}

function flightProviders(registry: ProviderRuntimeRegistry) {
  return registry
    .list()
    .filter((a) => a.providerId === 'amadeus' || a.providerId === 'duffel' || a.providerId === 'mock')
}

async function queryProviders(
  registry: ProviderRuntimeRegistry,
  request: ReturnType<typeof normalizeRequest>,
): Promise<{
  flights: UnifiedFlight[]
  providersUsed: ProviderRuntimeId[]
  providerLatencyMs: Partial<Record<ProviderRuntimeId, number>>
  modes: Partial<Record<ProviderRuntimeId, ProviderRuntimeMode>>
  fallbackUsed: boolean
  gracefulMessage?: string
}> {
  const adapters = flightProviders(registry)
  const providersUsed: ProviderRuntimeId[] = []
  const providerLatencyMs: Partial<Record<ProviderRuntimeId, number>> = {}
  const modes: Partial<Record<ProviderRuntimeId, ProviderRuntimeMode>> = {}
  const collected: UnifiedFlight[] = []

  const searchReq = {
    domain: 'flights' as const,
    origin: request.origin,
    destination: request.destination,
    departureDate: request.departureDate,
    returnDate: request.returnDate,
    adults: request.adults,
    children: request.children ?? 0,
    cabin: request.cabin ?? null,
    currency: request.currency,
    signal: request.signal,
  }

  const runOne = async (adapter: (typeof adapters)[number]) => {
    const started = Date.now()
    try {
      const result = await Promise.race([
        adapter.search(searchReq),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('timeout')), request.timeoutMs)
        }),
      ])
      providerLatencyMs[adapter.providerId] = Date.now() - started
      modes[adapter.providerId] = result.mode
      providersUsed.push(adapter.providerId)
      if (result.ok && result.offers.length) {
        collected.push(...normalizeFlightOffers(result.offers, adapter.providerId))
      }
      return result
    } catch {
      providerLatencyMs[adapter.providerId] = Date.now() - started
      modes[adapter.providerId] = adapter.health().mode
      providersUsed.push(adapter.providerId)
      return null
    }
  }

  const liveOrMock = adapters.filter((a) => a.providerId !== 'mock')
  const mock = adapters.find((a) => a.providerId === 'mock')

  if (request.parallel) {
    await Promise.all(liveOrMock.map(runOne))
  } else {
    for (const adapter of liveOrMock) {
      await runOne(adapter)
    }
  }

  let fallbackUsed = false
  let gracefulMessage: string | undefined
  if (collected.length === 0 && mock) {
    fallbackUsed = true
    gracefulMessage = GRACEFUL_PROVIDER_MESSAGE
    await runOne(mock)
    if (collected.length === 0) {
      // Guarantee non-empty mock results for UX safety
      collected.push(
        enrichMockFlight({
          origin: request.origin!,
          destination: request.destination!,
          currency: request.currency,
        }, 0),
        enrichMockFlight({
          origin: request.origin!,
          destination: request.destination!,
          currency: request.currency,
          price: 520,
          stops: 1,
          refundable: false,
        }, 1),
      )
      providersUsed.push('mock')
      modes.mock = 'mock'
      providerLatencyMs.mock = providerLatencyMs.mock ?? 0
    }
  }

  // Round-trip / multi-city: attach lightweight return/leg metadata (additive; no engine rewrite)
  if (request.tripType === 'round_trip' && request.returnDate) {
    for (const f of collected) {
      f.providerMetadata = {
        ...f.providerMetadata,
        tripType: 'round_trip',
        returnDate: request.returnDate,
      }
    }
  }
  if (request.tripType === 'multi_city' && request.legs?.length) {
    for (const f of collected) {
      f.providerMetadata = {
        ...f.providerMetadata,
        tripType: 'multi_city',
        legs: request.legs,
      }
    }
  }

  return {
    flights: collected,
    providersUsed: [...new Set(providersUsed)],
    providerLatencyMs,
    modes,
    fallbackUsed,
    gracefulMessage,
  }
}

function flightCacheKey(request: ReturnType<typeof normalizeRequest>): string {
  return [
    request.tripType,
    request.origin,
    request.destination,
    request.departureDate,
    request.returnDate ?? '-',
    String(request.adults),
    String(request.children ?? 0),
    request.cabin ?? 'economy',
    request.currency,
    (request.preferredAirlines ?? []).join(','),
    request.cursor ?? '',
  ].join('|')
}

export function createFlightSearchEngine(
  options: FlightSearchEngineOptions = {},
): FlightSearchEngine {
  const registry =
    options.registry
    ?? createProviderRuntimeRegistry({ forceMock: options.forceMock ?? true })
  const createRequestId = options.createRequestId ?? createRequestIdDefault
  const cache =
    options.cache === null
      ? null
      : (options.cache ?? new SmartCache({ ttlByNamespace: { flight_routes: 15 * 60 * 1000 } }))
  let initialized = false

  async function ensureInit() {
    if (!initialized) {
      await registry.initializeAll()
      initialized = true
    }
  }

  async function run(request: FlightSearchRequest): Promise<FlightSearchPage> {
    await ensureInit()
    const normalized = normalizeRequest(request)
    const requestId = createRequestId()
    const key = flightCacheKey(normalized)

    if (cache) {
      const hit = cache.get<FlightSearchPage>('flight_routes', key)
      if (hit) {
        return {
          ...hit,
          diagnostics: {
            ...hit.diagnostics,
            requestId,
            cacheHit: true,
          },
        }
      }
    }

    const queried = await queryProviders(registry, normalized)

    const totalBeforeFilter = queried.flights.length
    const filtered = applyFlightFilters(queried.flights, normalized.filters)
    const totalAfterFilter = filtered.length
    const deduped = dedupeFlights(filtered)
    const totalAfterDedupe = deduped.length
    const ranked = rankFlights(deduped, {
      preferredAirlines: normalized.preferredAirlines,
    })
    const sorted = sortFlights(ranked, normalized.sort)
    const page = paginateFlights(sorted, normalized.pageSize!, normalized.cursor)

    const diagnostics: FlightSearchDiagnostics = {
      requestId,
      providersUsed: queried.providersUsed,
      providerLatencyMs: queried.providerLatencyMs,
      cacheHit: false,
      fallbackUsed: queried.fallbackUsed,
      modes: queried.modes,
      totalBeforeFilter,
      totalAfterFilter,
      totalAfterDedupe,
      gracefulMessage: queried.gracefulMessage,
    }

    const result: FlightSearchPage = {
      flights: page.page,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      total: page.total,
      diagnostics,
    }
    cache?.set('flight_routes', key, result)
    return result
  }

  return {
    version: SPRINT72_FLIGHT_SEARCH_VERSION,
    searchFlights: run,
    searchOneWay(request) {
      return run({ ...request, tripType: 'one_way', returnDate: null })
    },
    searchRoundTrip(request) {
      return run({
        ...request,
        tripType: 'round_trip',
        returnDate: request.returnDate ?? '2026-08-10',
      })
    },
    searchMultiCity(request) {
      const legs = request.legs?.length
        ? request.legs
        : [
            {
              origin: request.origin ?? 'RUH',
              destination: request.destination ?? 'DXB',
              departureDate: request.departureDate ?? '2026-08-01',
            },
            {
              origin: request.destination ?? 'DXB',
              destination: 'IST',
              departureDate: request.returnDate ?? '2026-08-05',
            },
          ]
      return run({
        ...request,
        tripType: 'multi_city',
        legs,
        origin: legs[0]?.origin,
        destination: legs[0]?.destination,
        departureDate: legs[0]?.departureDate,
      })
    },
  }
}

let defaultEngine: FlightSearchEngine | null = null

export function getDefaultFlightSearchEngine(
  options?: FlightSearchEngineOptions,
): FlightSearchEngine {
  if (!defaultEngine || options) {
    defaultEngine = createFlightSearchEngine(options)
  }
  return defaultEngine
}

export function resetDefaultFlightSearchEngine(): void {
  defaultEngine = null
}
