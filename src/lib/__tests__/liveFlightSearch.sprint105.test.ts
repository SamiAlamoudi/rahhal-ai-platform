/**
 * Sprint 105 — Live Flight Search (Amadeus Production Bridge) tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  createProviderGateway,
  createGatewayProviderRegistry,
  createMockTravelProvider,
  ProviderError,
  type TravelProvider,
  type GatewayResponse,
} from '../../core'
import {
  SPRINT105_LIVE_FLIGHT_SEARCH_VERSION,
  LIVE_FLIGHT_SEARCH_FEATURE_ID,
  isLiveFlightSearchEnabled,
  validateLiveFlightSearchCriteria,
  composeLiveFlightSearchRequest,
  mapGatewayOfferToRahhalFlight,
  mapGatewayResponseToLiveFlightSearch,
  createLiveFlightSearchMetrics,
  createLiveFlightSearchRunner,
  runLiveFlightSearch,
  type LiveFlightSearchCriteria,
} from '../agent/liveFlightSearch'

function baseCriteria(
  overrides?: Partial<LiveFlightSearchCriteria>,
): LiveFlightSearchCriteria {
  return {
    origin: 'RUH',
    destination: 'DXB',
    departureDate: '2026-09-15',
    returnDate: '2026-09-20',
    adults: 2,
    children: 1,
    cabin: 'economy',
    currency: 'SAR',
    maxResults: 10,
    nonStop: false,
    ...overrides,
  }
}

function amadeusLikeProvider(overrides?: {
  empty?: boolean
  throwErr?: Error
  failOk?: boolean
  errorCode?: string
  latencyMs?: number
}): TravelProvider {
  const base = createMockTravelProvider({
    id: 'amadeus',
    mode: 'sandbox',
    latencyMs: overrides?.latencyMs ?? 0,
    emptyFlights: overrides?.empty,
  })
  return {
    ...base,
    async searchFlights(request) {
      if (overrides?.throwErr) throw overrides.throwErr
      if (overrides?.failOk) {
        return {
          ok: false,
          providerId: 'amadeus',
          mode: 'sandbox',
          results: [],
          partial: false,
          empty: true,
          latencyMs: 1,
          error: overrides.errorCode ?? 'PROVIDER_UNAVAILABLE',
          retryable: overrides.errorCode === 'RATE_LIMITED',
        }
      }
      const result = await base.searchFlights(request)
      return {
        ...result,
        results: result.results.map((row) => ({
          ...row,
          airline: 'Saudia',
          carrierCode: 'SV',
          durationMinutes: 200,
          stops: request.nonStop ? 0 : 1,
          cabin: 'ECONOMY',
          origin: request.origin,
          destination: request.destination,
          departureAt: `${request.departureDate}T08:00:00`,
          arrivalAt: `${request.departureDate}T11:20:00`,
          refundable: true,
          seatsRemaining: 5,
          providerConfidence: 0.9,
          availability: 'available',
        })),
      }
    },
  }
}

function gatewayWith(provider: TravelProvider) {
  const registry = createGatewayProviderRegistry({ enableAmadeus: false })
  registry.register('amadeus', provider, { enabled: true })
  return createProviderGateway({
    registry,
    sleep: async () => undefined,
    timeoutMs: 2_000,
    maxAttempts: 3,
  })
}

describe('Sprint 105 — Live Flight Search', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
    vi.restoreAllMocks()
  })

  it('exposes version and feature flag default OFF', () => {
    expect(SPRINT105_LIVE_FLIGHT_SEARCH_VERSION).toMatch(/live-flight-search/)
    expect(LIVE_FLIGHT_SEARCH_FEATURE_ID).toBe('ai.live_flight_search')
    expect(getFeatureRegistry().isEnabled('ai.live_flight_search')).toBe(false)
    expect(isLiveFlightSearchEnabled()).toBe(false)
  })

  describe('validation', () => {
    it('accepts valid criteria and normalizes IATA / currency', () => {
      const v = validateLiveFlightSearchCriteria(baseCriteria({
        origin: 'ruh',
        destination: 'dxb',
        currency: 'sar',
      }))
      expect(v.ok).toBe(true)
      expect(v.normalized?.origin).toBe('RUH')
      expect(v.normalized?.destination).toBe('DXB')
      expect(v.normalized?.currency).toBe('SAR')
      expect(v.normalized?.children).toBe(1)
    })

    it('rejects invalid airport codes', () => {
      const v = validateLiveFlightSearchCriteria(baseCriteria({ origin: 'RIYADH' }))
      expect(v.ok).toBe(false)
      expect(v.errors.some((e) => /IATA/i.test(e))).toBe(true)
    })

    it('rejects invalid dates and return before departure', () => {
      expect(validateLiveFlightSearchCriteria(baseCriteria({
        departureDate: '2026-13-40',
      })).ok).toBe(false)
      expect(validateLiveFlightSearchCriteria(baseCriteria({
        departureDate: '2026-09-20',
        returnDate: '2026-09-10',
      })).ok).toBe(false)
    })
  })

  describe('composer + mapper', () => {
    it('composes gateway flight request with cabin / max / nonStop', () => {
      const composed = composeLiveFlightSearchRequest(baseCriteria({
        nonStop: true,
        maxResults: 5,
        cabin: 'business',
      }))
      expect(composed.gatewayRequest.operation).toBe('search_flights')
      expect(composed.gatewayRequest.providerId).toBe('amadeus')
      expect(composed.gatewayRequest.flight?.nonStop).toBe(true)
      expect(composed.gatewayRequest.flight?.maxResults).toBe(5)
      expect(composed.gatewayRequest.flight?.cabin).toBe('business')
      expect(composed.amadeusOptions.cabin).toBe('business')
    })

    it('maps gateway offers into Rahhal models without provider SDK types', () => {
      const flight = mapGatewayOfferToRahhalFlight({
        id: 'OFFER1',
        providerId: 'amadeus',
        kind: 'flight',
        title: 'SV RUH→DXB',
        price: 1250,
        currency: 'SAR',
        raw: {
          airline: 'Saudia',
          carrierCode: 'SV',
          origin: 'RUH',
          destination: 'DXB',
          durationMinutes: 200,
          stops: 0,
          cabin: 'ECONOMY',
          refundable: true,
          providerConfidence: 0.9,
        },
      })
      expect(flight.origin).toBe('RUH')
      expect(flight.airline).toBe('Saudia')
      expect(flight.price).toBe(1250)
      expect(Object.keys(flight)).not.toContain('payload')
    })
  })

  describe('feature flag OFF', () => {
    it('does not call providers and returns disabled', async () => {
      const searchFlights = vi.fn()
      const provider: TravelProvider = {
        ...amadeusLikeProvider(),
        searchFlights: searchFlights.mockResolvedValue({
          ok: true,
          providerId: 'amadeus',
          mode: 'sandbox',
          results: [],
          partial: false,
          empty: true,
          latencyMs: 0,
        }),
      }
      const result = await runLiveFlightSearch(baseCriteria(), {
        enabled: false,
        gateway: gatewayWith(provider),
      })
      expect(result.enabled).toBe(false)
      expect(result.logs).toContain('live_flight_search_disabled')
      expect(searchFlights).not.toHaveBeenCalled()
    })
  })

  describe('feature flag ON', () => {
    it('successful search returns Rahhal flight offers', async () => {
      getFeatureRegistry().setEnabled('ai.live_flight_search', true)
      const result = await runLiveFlightSearch(baseCriteria(), {
        enabled: true,
        gateway: gatewayWith(amadeusLikeProvider()),
      })
      expect(result.enabled).toBe(true)
      expect(result.ok).toBe(true)
      expect(result.flights.length).toBeGreaterThan(0)
      expect(result.flightOffers[0]?.origin).toBe('RUH')
      expect(result.meta.providerId).toBe('amadeus')
    })

    it('empty results', async () => {
      const result = await runLiveFlightSearch(baseCriteria(), {
        enabled: true,
        gateway: gatewayWith(amadeusLikeProvider({ empty: true })),
      })
      expect(result.ok).toBe(false)
      expect(result.empty).toBe(true)
      expect(result.error?.code).toBe('EMPTY_RESULTS')
    })

    it('authentication failure', async () => {
      const result = await runLiveFlightSearch(baseCriteria(), {
        enabled: true,
        gateway: gatewayWith(amadeusLikeProvider({
          throwErr: new ProviderError({
            code: 'UNAUTHORIZED',
            message: 'invalid credentials',
            providerId: 'amadeus',
            statusCode: 401,
            retryable: false,
          }),
        })),
      })
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBe('UNAUTHORIZED')
      expect(result.error?.httpStatus).toBe(401)
      expect(result.error?.message).toMatch(/authentication|credentials|token/i)
    })

    it('timeout', async () => {
      const slow: TravelProvider = {
        ...amadeusLikeProvider(),
        async searchFlights() {
          await new Promise((r) => setTimeout(r, 80))
          throw new Error('should abort')
        },
      }
      const gateway = createProviderGateway({
        registry: (() => {
          const registry = createGatewayProviderRegistry({ enableAmadeus: false })
          registry.register('amadeus', slow, { enabled: true })
          return registry
        })(),
        sleep: async () => undefined,
        timeoutMs: 5,
        maxAttempts: 2,
      })
      const result = await runLiveFlightSearch(baseCriteria({ timeoutMs: 5 }), {
        enabled: true,
        gateway,
      })
      expect(result.ok).toBe(false)
      expect(result.error).not.toBeNull()
    })

    it('invalid airport / dates short-circuit before gateway', async () => {
      const searchFlights = vi.fn()
      const provider: TravelProvider = {
        ...amadeusLikeProvider(),
        searchFlights,
      }
      const badAirport = await runLiveFlightSearch(baseCriteria({ origin: 'XX' }), {
        enabled: true,
        gateway: gatewayWith(provider),
      })
      expect(badAirport.validationErrors.length).toBeGreaterThan(0)
      expect(searchFlights).not.toHaveBeenCalled()

      const badDate = await runLiveFlightSearch(baseCriteria({
        departureDate: 'not-a-date',
      }), {
        enabled: true,
        gateway: gatewayWith(provider),
      })
      expect(badDate.error?.code).toBe('VALIDATION_ERROR')
      expect(searchFlights).not.toHaveBeenCalled()
    })

    it('provider unavailable', async () => {
      const gateway: ReturnType<typeof createProviderGateway> = {
        ...createProviderGateway({ sleep: async () => undefined }),
        async execute(): Promise<GatewayResponse> {
          return {
            version: 'test',
            enabled: true,
            operation: 'search_flights',
            providerId: 'duffel',
            ok: false,
            offers: [],
            empty: true,
            partial: false,
            latencyMs: 1,
            attempts: 0,
            error: {
              code: 'PROVIDER_UNAVAILABLE',
              message: 'duffel disabled in Phase 1',
              retryable: false,
              providerId: 'duffel',
              rateLimited: false,
              timedOut: false,
            },
            logs: ['unavailable'],
          }
        },
      }
      const result = await runLiveFlightSearch(baseCriteria(), {
        enabled: true,
        gateway,
      })
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBe('PROVIDER_UNAVAILABLE')
    })

    it('retries then succeeds after transient network failure', async () => {
      let calls = 0
      const base = amadeusLikeProvider()
      const flaky: TravelProvider = {
        ...base,
        async searchFlights(request) {
          calls += 1
          if (calls === 1) throw new Error('network failure')
          return base.searchFlights(request)
        },
      }
      const result = await runLiveFlightSearch(baseCriteria(), {
        enabled: true,
        gateway: gatewayWith(flaky),
      })
      expect(result.ok).toBe(true)
      expect(calls).toBeGreaterThanOrEqual(2)
      expect(result.attempts).toBeGreaterThanOrEqual(2)
    })

    it('rate limit classification', async () => {
      const result = await runLiveFlightSearch(baseCriteria(), {
        enabled: true,
        gateway: gatewayWith(amadeusLikeProvider({
          throwErr: new ProviderError({
            code: 'RATE_LIMITED',
            message: '429 Too Many Requests',
            providerId: 'amadeus',
            statusCode: 429,
            retryable: true,
          }),
        })),
      })
      // Exhausted retries → failure; rate limit should surface
      expect(result.ok).toBe(false)
      expect(
        result.error?.rateLimited
        || result.error?.code === 'RATE_LIMITED'
        || result.error?.retryable,
      ).toBe(true)
    })

    it('records metrics for success and validation failure', async () => {
      const metrics = createLiveFlightSearchMetrics()
      const runner = createLiveFlightSearchRunner({
        enabled: true,
        metrics,
        gateway: gatewayWith(amadeusLikeProvider()),
      })
      await runner.search(baseCriteria())
      await runner.search(baseCriteria({ origin: 'INVALID' }))
      const snap = metrics.snapshot()
      expect(snap.searches).toBe(2)
      expect(snap.successes).toBe(1)
      expect(snap.validationFailures).toBe(1)
    })
  })

  describe('mapping validation from gateway response', () => {
    it('builds flightOffers for Decision Engine', () => {
      const mapped = mapGatewayResponseToLiveFlightSearch(
        {
          version: 'gw',
          enabled: true,
          operation: 'search_flights',
          providerId: 'amadeus',
          ok: true,
          offers: [{
            id: '1',
            providerId: 'amadeus',
            kind: 'flight',
            title: 'SV',
            price: 900,
            currency: 'SAR',
            raw: {
              origin: 'RUH',
              destination: 'DXB',
              airline: 'Saudia',
              carrierCode: 'SV',
              stops: 0,
            },
          }],
          empty: false,
          partial: false,
          latencyMs: 12,
          attempts: 1,
          error: null,
          logs: [],
        },
        { enabled: true },
      )
      expect(mapped.ok).toBe(true)
      expect(mapped.flightOffers).toHaveLength(1)
      expect(mapped.flightOffers[0]?.providerId).toBe('amadeus')
    })
  })
})
