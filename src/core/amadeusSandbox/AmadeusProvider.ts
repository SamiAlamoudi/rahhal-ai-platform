/**
 * Sprint 92 — AmadeusProvider (TravelProvider) for Amadeus Sandbox.
 * Reuses Sprint 90 RetryPolicy / CircuitBreaker / error classification.
 * No hotel integration.
 */

import {
  classifyProviderFailure,
  createProviderRetryPolicy,
  DEFAULT_PROVIDER_LIMITS,
  type FlightSearchRequest,
  type HotelSearchRequest,
  type PackageSearchRequest,
  type ProviderCapabilityMap,
  type ProviderHealthResult,
  type ProviderLimits,
  type ProviderRetryPolicyOptions,
  type ProviderSearchResult,
  type TravelProvider,
} from '../providers'
import { AmadeusSandboxOAuth, amadeusTokenUrl, type AmadeusFetch } from './AmadeusAuth'
import { resolveAmadeusSandboxConfig } from './config'
import { emitAmadeusProviderEvent } from './events'
import {
  mapAirlineCode,
  mapCabinToAmadeusTravelClass,
  normalizeAmadeusAirport,
  normalizeAmadeusFlightOffer,
  normalizePassengerCounts,
  toDecisionEngineFlightOffer,
  type AmadeusOfferRaw,
} from './normalize'
import {
  AMADEUS_SANDBOX_PROVIDER_ID,
  type AmadeusAirportLookup,
  type AmadeusNormalizedFlight,
  type AmadeusProviderEvent,
} from './types'

export interface AmadeusSandboxProviderOptions {
  clientId?: string
  clientSecret?: string
  baseUrl?: string
  fetchImpl?: AmadeusFetch
  now?: () => number
  /** Injected OAuth for tests. */
  oauth?: AmadeusSandboxOAuth
  /** When false, health reports unavailable (credentials missing). */
  available?: boolean
  retry?: ProviderRetryPolicyOptions
  /** Collect events into this array when provided. */
  events?: AmadeusProviderEvent[]
  cabin?: string | null
  children?: number
}

export interface AmadeusSandboxProvider extends TravelProvider {
  lookupAirports(query: string, signal?: AbortSignal): Promise<AmadeusAirportLookup[]>
  mapAirline(code: string): string | null
  getOAuthStatus(): 'none' | 'valid' | 'expired'
  getTokenRefreshCount(): number
  /** Last normalized flights from successful search (test/debug). */
  getLastFlights(): AmadeusNormalizedFlight[]
}

function unsupported(
  providerId: string,
  mode: 'sandbox',
  domain: string,
): ProviderSearchResult {
  return {
    ok: false,
    providerId,
    mode,
    results: [],
    partial: false,
    empty: true,
    latencyMs: 0,
    error: `${domain}_not_supported`,
    retryable: false,
  }
}

export function createAmadeusSandboxProvider(
  options: AmadeusSandboxProviderOptions = {},
): AmadeusSandboxProvider {
  const config = resolveAmadeusSandboxConfig({
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    baseUrl: options.baseUrl,
  })
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis)
  const now = options.now ?? (() => Date.now())
  const events = options.events
  const mode = 'sandbox' as const

  const oauth = options.oauth ?? new AmadeusSandboxOAuth({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    tokenUrl: amadeusTokenUrl(config.baseUrl),
    fetchImpl,
    now,
    onTokenRefresh: (detail) => {
      emitAmadeusProviderEvent('provider.token.refresh', {
        latencyMs: detail.latencyMs,
        authRetry: detail.authRetry,
      }, events)
    },
  })

  const retryPolicy = createProviderRetryPolicy({
    maxAttempts: options.retry?.maxAttempts ?? 3,
    baseDelayMs: options.retry?.baseDelayMs ?? 20,
    maxDelayMs: options.retry?.maxDelayMs ?? 200,
    timeoutMs: options.retry?.timeoutMs ?? 8_000,
    sleep: options.retry?.sleep ?? (async () => undefined),
    circuitBreaker: options.retry?.circuitBreaker,
  })

  let lastFlights: AmadeusNormalizedFlight[] = []
  const forcedAvailable = options.available

  const isAvailable = (): boolean => {
    if (typeof forcedAvailable === 'boolean') return forcedAvailable
    return config.hasCredentials
  }

  const capabilities = (): ProviderCapabilityMap => ({
    flights: true,
    hotels: false,
    packages: false,
    booking: false,
    cancellation: false,
    sandbox: true,
    live: false,
  })

  const limits = (): ProviderLimits => ({
    ...DEFAULT_PROVIDER_LIMITS,
    timeoutMs: 8_000,
    maxRetries: 3,
  })

  async function searchFlightsOnce(
    request: FlightSearchRequest,
    signal?: AbortSignal,
  ): Promise<ProviderSearchResult> {
    const started = now()
    emitAmadeusProviderEvent('provider.request', {
      operation: 'searchFlights',
      origin: request.origin,
      destination: request.destination,
    }, events)

    if (!isAvailable()) {
      const latencyMs = now() - started
      emitAmadeusProviderEvent('provider.failure', {
        operation: 'searchFlights',
        code: 'SECRETS_MISSING',
        latencyMs,
      }, events)
      return {
        ok: false,
        providerId: AMADEUS_SANDBOX_PROVIDER_ID,
        mode,
        results: [],
        partial: false,
        empty: true,
        latencyMs,
        error: 'SECRETS_MISSING',
        retryable: false,
      }
    }

    const passengers = normalizePassengerCounts({
      adults: request.adults,
      children: options.children,
    })
    const travelClass = mapCabinToAmadeusTravelClass(options.cabin)
    const params = new URLSearchParams({
      originLocationCode: request.origin.toUpperCase(),
      destinationLocationCode: request.destination.toUpperCase(),
      departureDate: request.departureDate,
      adults: String(passengers.adults),
      currencyCode: (request.currency || 'SAR').toUpperCase(),
      max: '20',
    })
    if (request.returnDate) params.set('returnDate', request.returnDate)
    if (passengers.children > 0) params.set('children', String(passengers.children))
    if (travelClass) params.set('travelClass', travelClass)

    const url = `${config.baseUrl.replace(/\/$/, '')}/v2/shopping/flight-offers?${params}`
    let response: Response
    let authRetried = false
    try {
      const authorized = await oauth.authorizedFetch(url, {
        method: 'GET',
        signal: signal ?? request.signal,
      })
      response = authorized.response
      authRetried = authorized.authRetried
    } catch (err) {
      const classified = classifyProviderFailure(AMADEUS_SANDBOX_PROVIDER_ID, err)
      const latencyMs = now() - started
      emitAmadeusProviderEvent('provider.failure', {
        operation: 'searchFlights',
        code: classified.code,
        statusCode: classified.statusCode,
        latencyMs,
        authRetried,
      }, events)
      emitAmadeusProviderEvent('provider.latency', { operation: 'searchFlights', latencyMs }, events)
      return {
        ok: false,
        providerId: AMADEUS_SANDBOX_PROVIDER_ID,
        mode,
        results: [],
        partial: false,
        empty: true,
        latencyMs,
        error: classified.code,
        retryable: classified.retryable,
      }
    }

    const latencyMs = now() - started
    emitAmadeusProviderEvent('provider.latency', { operation: 'searchFlights', latencyMs }, events)

    if (!response.ok) {
      const classified = classifyProviderFailure(
        AMADEUS_SANDBOX_PROVIDER_ID,
        new Error(`amadeus_http_${response.status}`),
        response.status,
      )
      // Drain body without retaining secrets.
      await response.text().catch(() => '')
      emitAmadeusProviderEvent('provider.failure', {
        operation: 'searchFlights',
        code: classified.code,
        statusCode: response.status,
        latencyMs,
        authRetried,
      }, events)
      return {
        ok: false,
        providerId: AMADEUS_SANDBOX_PROVIDER_ID,
        mode,
        results: [],
        partial: false,
        empty: true,
        latencyMs,
        error: classified.code,
        retryable: classified.retryable || response.status === 401 || response.status === 429
          || response.status >= 500,
      }
    }

    const body = (await response.json()) as { data?: AmadeusOfferRaw[] }
    const flights = (body.data ?? []).map((raw, i) =>
      normalizeAmadeusFlightOffer(raw, i, passengers),
    )
    lastFlights = flights
    const results = flights.map(toDecisionEngineFlightOffer)

    emitAmadeusProviderEvent('provider.response', {
      operation: 'searchFlights',
      count: results.length,
      latencyMs,
      authRetried,
    }, events)
    emitAmadeusProviderEvent('provider.success', {
      operation: 'searchFlights',
      count: results.length,
      latencyMs,
    }, events)

    return {
      ok: true,
      providerId: AMADEUS_SANDBOX_PROVIDER_ID,
      mode,
      results,
      partial: false,
      empty: results.length === 0,
      latencyMs,
    }
  }

  const provider: AmadeusSandboxProvider = {
    id: AMADEUS_SANDBOX_PROVIDER_ID,
    displayName: 'Amadeus Sandbox',
    mode,
    capabilities,
    limits,
    getOAuthStatus: () => oauth.getStatus(),
    getTokenRefreshCount: () => oauth.getRefreshCount(),
    getLastFlights: () => lastFlights,
    mapAirline: (code) => mapAirlineCode(code),

    async health(signal?: AbortSignal): Promise<ProviderHealthResult> {
      const started = now()
      if (!isAvailable()) {
        return {
          providerId: AMADEUS_SANDBOX_PROVIDER_ID,
          ok: false,
          mode,
          latencyMs: now() - started,
          detail: 'secrets_missing',
          checkedAt: new Date().toISOString(),
        }
      }
      try {
        const token = await oauth.getToken()
        const latencyMs = now() - started
        if (!token.token) {
          return {
            providerId: AMADEUS_SANDBOX_PROVIDER_ID,
            ok: false,
            mode,
            latencyMs,
            detail: 'oauth_failed',
            checkedAt: new Date().toISOString(),
          }
        }
        // Light reference ping — airport keyword keeps payload small.
        const params = new URLSearchParams({
          keyword: 'RUH',
          subType: 'AIRPORT',
          'page[limit]': '1',
        })
        const url = `${config.baseUrl.replace(/\/$/, '')}/v1/reference-data/locations?${params}`
        const { response } = await oauth.authorizedFetch(url, { method: 'GET', signal })
        const ok = response.ok || response.status === 400
        await response.text().catch(() => '')
        return {
          providerId: AMADEUS_SANDBOX_PROVIDER_ID,
          ok,
          mode,
          latencyMs: now() - started,
          detail: ok ? 'sandbox_reachable' : `http_${response.status}`,
          checkedAt: new Date().toISOString(),
        }
      } catch (err) {
        return {
          providerId: AMADEUS_SANDBOX_PROVIDER_ID,
          ok: false,
          mode,
          latencyMs: now() - started,
          detail: err instanceof Error ? err.message : 'health_failed',
          checkedAt: new Date().toISOString(),
        }
      }
    },

    async searchFlights(request: FlightSearchRequest): Promise<ProviderSearchResult> {
      let attempt = 0
      const outcome = await retryPolicy.execute(AMADEUS_SANDBOX_PROVIDER_ID, async (signal) => {
        attempt += 1
        if (attempt > 1) {
          emitAmadeusProviderEvent('provider.retry', {
            operation: 'searchFlights',
            attempt,
          }, events)
        }
        const result = await searchFlightsOnce(request, signal)
        if (!result.ok && result.retryable) {
          throw classifyProviderFailure(
            AMADEUS_SANDBOX_PROVIDER_ID,
            new Error(result.error ?? 'retryable_failure'),
            result.error === 'RATE_LIMITED'
              ? 429
              : result.error === 'UNAUTHORIZED'
                ? 401
                : result.error === 'SERVER_ERROR'
                  ? 503
                  : null,
          )
        }
        return result
      })

      if (outcome.ok && outcome.value) {
        return outcome.value
      }

      emitAmadeusProviderEvent('provider.failure', {
        operation: 'searchFlights',
        code: outcome.code ?? 'UNKNOWN',
        attempts: outcome.attempts,
        circuitOpen: outcome.circuitOpen,
      }, events)

      return {
        ok: false,
        providerId: AMADEUS_SANDBOX_PROVIDER_ID,
        mode,
        results: [],
        partial: false,
        empty: true,
        latencyMs: 0,
        error: outcome.circuitOpen
          ? 'CIRCUIT_OPEN'
          : (outcome.code ?? outcome.error ?? 'PROVIDER_UNAVAILABLE'),
        retryable: !outcome.circuitOpen,
      }
    },

    async searchHotels(_request: HotelSearchRequest): Promise<ProviderSearchResult> {
      return unsupported(AMADEUS_SANDBOX_PROVIDER_ID, mode, 'hotels')
    },

    async searchPackages(_request: PackageSearchRequest): Promise<ProviderSearchResult> {
      return unsupported(AMADEUS_SANDBOX_PROVIDER_ID, mode, 'packages')
    },

    async lookupAirports(query: string, signal?: AbortSignal): Promise<AmadeusAirportLookup[]> {
      emitAmadeusProviderEvent('provider.request', {
        operation: 'lookupAirports',
        queryLength: query.length,
      }, events)
      if (!isAvailable()) return []
      const params = new URLSearchParams({
        keyword: query,
        subType: 'AIRPORT,CITY',
        'page[limit]': '10',
      })
      const url = `${config.baseUrl.replace(/\/$/, '')}/v1/reference-data/locations?${params}`
      const started = now()
      try {
        const { response } = await oauth.authorizedFetch(url, { method: 'GET', signal })
        if (!response.ok) {
          await response.text().catch(() => '')
          emitAmadeusProviderEvent('provider.failure', {
            operation: 'lookupAirports',
            statusCode: response.status,
          }, events)
          return []
        }
        const body = (await response.json()) as {
          data?: Array<{
            iataCode?: string
            name?: string
            address?: { cityName?: string; countryCode?: string }
          }>
        }
        const rows = (body.data ?? [])
          .map(normalizeAmadeusAirport)
          .filter((row): row is AmadeusAirportLookup => row != null)
        emitAmadeusProviderEvent('provider.success', {
          operation: 'lookupAirports',
          count: rows.length,
          latencyMs: now() - started,
        }, events)
        return rows
      } catch (err) {
        emitAmadeusProviderEvent('provider.failure', {
          operation: 'lookupAirports',
          code: classifyProviderFailure(AMADEUS_SANDBOX_PROVIDER_ID, err).code,
        }, events)
        return []
      }
    },
  }

  return provider
}

/** Register Amadeus sandbox onto an existing Sprint 90 registry (additive). */
export function registerAmadeusSandboxProvider(
  registry: {
    register: (
      provider: TravelProvider,
      priority?: { tier: 'primary' | 'secondary' | 'fallback'; rank?: number },
    ) => void
  },
  options?: AmadeusSandboxProviderOptions & {
    tier?: 'primary' | 'secondary' | 'fallback'
    rank?: number
  },
): AmadeusSandboxProvider {
  const provider = createAmadeusSandboxProvider(options)
  registry.register(provider, {
    tier: options?.tier ?? 'primary',
    rank: options?.rank ?? 0,
  })
  return provider
}
