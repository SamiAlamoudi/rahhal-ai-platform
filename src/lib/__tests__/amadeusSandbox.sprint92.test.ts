/**
 * Sprint 92 — Amadeus Sandbox TravelProvider tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  assertProviderSurface,
  createMockTravelProvider,
  createProviderCircuitBreaker,
  createProviderRegistry,
  normalizeAmadeusFlightOffer,
  mapAirlineCode,
  mapCabinToAmadeusTravelClass,
  normalizeCurrency,
  normalizePassengerCounts,
  parseDurationMinutes,
  createAmadeusSandboxProvider,
  registerAmadeusSandboxProvider,
  AmadeusSandboxOAuth,
  amadeusTokenUrl,
  onAmadeusProviderEvent,
  resetAmadeusProviderEventListeners,
  resolveAmadeusSandboxConfig,
  isProductionDeployTarget,
  toUnifiedTripFlightOffer,
  toBookableFlightSegment,
  composeUnifiedTrip,
  toBookableTrip,
  SPRINT92_AMADEUS_SANDBOX_VERSION,
  type AmadeusProviderEvent,
  type AmadeusOfferRaw,
} from '../../core'
import {
  isAmadeusSandboxEnabled,
  AMADEUS_SANDBOX_FEATURE_ID,
  createAmadeusSandboxRegistry,
} from '../agent/providers/amadeusSandbox'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function tokenResponse(expiresIn = 1800): Response {
  return jsonResponse({
    access_token: 'test-access-token',
    token_type: 'Bearer',
    expires_in: expiresIn,
  })
}

const sampleOffer: AmadeusOfferRaw = {
  id: 'OFFER1',
  type: 'flight-offer',
  numberOfBookableSeats: 5,
  itineraries: [{
    duration: 'PT3H20M',
    segments: [
      {
        departure: { iataCode: 'RUH', at: '2026-08-15T08:00:00' },
        arrival: { iataCode: 'DXB', at: '2026-08-15T11:20:00' },
        carrierCode: 'SV',
        numberOfStops: 0,
      },
    ],
  }],
  price: { total: '1250.00', currency: 'SAR' },
  travelerPricings: [{ fareDetailsBySegment: [{ cabin: 'ECONOMY' }] }],
  pricingOptions: { refundableFare: true },
}

describe('Sprint 92 — Amadeus Sandbox', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetAmadeusProviderEventListeners()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetAmadeusProviderEventListeners()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('exposes version and feature flag defaults', () => {
    expect(SPRINT92_AMADEUS_SANDBOX_VERSION).toMatch(/amadeus-sandbox/)
    expect(getFeatureRegistry().isEnabled('providers.amadeus.enabled')).toBe(true)
    expect(AMADEUS_SANDBOX_FEATURE_ID).toBe('providers.amadeus.enabled')
    expect(isAmadeusSandboxEnabled({ env: { VITE_DEPLOY_TARGET: 'preview' } })).toBe(true)
    expect(isAmadeusSandboxEnabled({ env: { VITE_DEPLOY_TARGET: 'production' } })).toBe(false)
    expect(isAmadeusSandboxEnabled({
      env: { VITE_DEPLOY_TARGET: 'production', PROVIDERS_AMADEUS_ENABLED: 'true' },
    })).toBe(true)
  })

  describe('normalization', () => {
    it('normalizes flights, cabins, airlines, currencies, passengers', () => {
      expect(parseDurationMinutes('PT3H20M')).toBe(200)
      expect(mapCabinToAmadeusTravelClass('business')).toBe('BUSINESS')
      expect(mapAirlineCode('SV')).toBe('Saudia')
      expect(normalizeCurrency('sar')).toBe('SAR')
      expect(normalizePassengerCounts({ adults: 2, children: 1 })).toEqual({
        adults: 2,
        children: 1,
      })

      const flight = normalizeAmadeusFlightOffer(sampleOffer, 0, { adults: 2, children: 0 })
      expect(flight.origin).toBe('RUH')
      expect(flight.destination).toBe('DXB')
      expect(flight.airline).toBe('SV')
      expect(flight.airlineName).toBe('Saudia')
      expect(flight.price).toBe(1250)
      expect(flight.currency).toBe('SAR')
      expect(flight.durationMinutes).toBe(200)
      expect(flight.stops).toBe(0)
      expect(flight.cabin).toBe('ECONOMY')
      expect(flight.availability).toBe('available')
      expect(flight.metadata.source).toBe('amadeus_sandbox')
    })
  })

  describe('OAuth', () => {
    it('caches tokens and refreshes on expiry / 401', async () => {
      let tokenCalls = 0
      let flightCalls = 0
      const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.includes('/oauth2/token')) {
          tokenCalls += 1
          return tokenResponse(1) // expires immediately after skew
        }
        if (url.includes('/flight-offers')) {
          flightCalls += 1
          const auth = String((init?.headers as Record<string, string>)?.Authorization ?? '')
          expect(auth).toMatch(/^Bearer /)
          if (flightCalls === 1) {
            return new Response('unauthorized', { status: 401 })
          }
          return jsonResponse({ data: [sampleOffer] })
        }
        return new Response('not found', { status: 404 })
      }) as unknown as typeof fetch

      let now = 1_000
      const oauth = new AmadeusSandboxOAuth({
        clientId: 'id',
        clientSecret: 'secret',
        tokenUrl: amadeusTokenUrl('https://test.api.amadeus.com'),
        fetchImpl,
        refreshSkewMs: 0,
        now: () => now,
      })

      const first = await oauth.getToken()
      expect(first.token?.accessToken).toBe('test-access-token')
      expect(first.fromCache).toBe(false)
      expect(tokenCalls).toBe(1)

      const cached = await oauth.getToken()
      expect(cached.fromCache).toBe(true)
      expect(tokenCalls).toBe(1)

      now += 2_000
      const refreshed = await oauth.refreshToken()
      expect(refreshed.refreshed).toBe(true)
      expect(tokenCalls).toBe(2)
      expect(oauth.getRefreshCount()).toBe(1)

      const provider = createAmadeusSandboxProvider({
        clientId: 'id',
        clientSecret: 'secret',
        fetchImpl,
        oauth,
        now: () => now,
        retry: { maxAttempts: 2, sleep: async () => undefined },
      })

      const result = await provider.searchFlights({
        origin: 'RUH',
        destination: 'DXB',
        departureDate: '2026-08-15',
        adults: 1,
        currency: 'SAR',
      })
      expect(result.ok).toBe(true)
      expect(result.results.length).toBe(1)
      expect(oauth.getAuthRetryCount()).toBeGreaterThanOrEqual(1)
    })
  })

  describe('TravelProvider surface', () => {
    it('implements required TravelProvider methods and rejects hotels/packages', async () => {
      const provider = createAmadeusSandboxProvider({
        clientId: 'id',
        clientSecret: 'secret',
        available: true,
        fetchImpl: vi.fn(async (input: RequestInfo | URL) => {
          const url = String(input)
          if (url.includes('/oauth2/token')) return tokenResponse()
          if (url.includes('/locations')) return jsonResponse({ data: [{ iataCode: 'RUH', name: 'Riyadh' }] })
          return jsonResponse({ data: [sampleOffer] })
        }) as unknown as typeof fetch,
      })

      expect(assertProviderSurface(provider)).toEqual([])
      expect(provider.mode).toBe('sandbox')
      expect(provider.capabilities().flights).toBe(true)
      expect(provider.capabilities().hotels).toBe(false)

      const hotels = await provider.searchHotels({
        destination: 'DXB',
        checkIn: '2026-08-15',
      })
      expect(hotels.ok).toBe(false)
      expect(hotels.error).toMatch(/hotels_not_supported/)

      const packages = await provider.searchPackages({ destination: 'DXB' })
      expect(packages.ok).toBe(false)
    })

    it('searches flights and normalizes sandbox responses', async () => {
      const events: AmadeusProviderEvent[] = []
      const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/oauth2/token')) return tokenResponse()
        if (url.includes('/flight-offers')) return jsonResponse({ data: [sampleOffer] })
        return jsonResponse({ data: [] })
      }) as unknown as typeof fetch

      const provider = createAmadeusSandboxProvider({
        clientId: 'id',
        clientSecret: 'secret',
        fetchImpl,
        events,
        retry: { sleep: async () => undefined },
      })

      const result = await provider.searchFlights({
        origin: 'RUH',
        destination: 'DXB',
        departureDate: '2026-08-15',
        adults: 2,
        currency: 'SAR',
      })

      expect(result.ok).toBe(true)
      expect(result.empty).toBe(false)
      expect(result.results[0]?.airline).toBe('Saudia')
      expect(result.results[0]?.price).toBe(1250)
      expect(result.results[0]?.currency).toBe('SAR')
      expect(provider.getLastFlights()[0]?.origin).toBe('RUH')

      const names = events.map((e) => e.name)
      expect(names).toContain('provider.request')
      expect(names).toContain('provider.success')
      expect(names).toContain('provider.latency')
      expect(JSON.stringify(events)).not.toMatch(/secret|test-access-token/i)
    })

    it('looks up airports and maps airline codes', async () => {
      const provider = createAmadeusSandboxProvider({
        clientId: 'id',
        clientSecret: 'secret',
        fetchImpl: vi.fn(async (input: RequestInfo | URL) => {
          const url = String(input)
          if (url.includes('/oauth2/token')) return tokenResponse()
          return jsonResponse({
            data: [{
              iataCode: 'DXB',
              name: 'Dubai International',
              address: { cityName: 'Dubai', countryCode: 'AE' },
            }],
          })
        }) as unknown as typeof fetch,
      })

      const airports = await provider.lookupAirports('Dubai')
      expect(airports[0]?.iata).toBe('DXB')
      expect(provider.mapAirline('EK')).toBe('Emirates')
    })
  })

  describe('failures / retry / circuit breaker', () => {
    it('retries retryable provider failures then succeeds', async () => {
      let flightCalls = 0
      const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/oauth2/token')) return tokenResponse()
        if (url.includes('/flight-offers')) {
          flightCalls += 1
          if (flightCalls < 3) return new Response('busy', { status: 503 })
          return jsonResponse({ data: [sampleOffer] })
        }
        return jsonResponse({ data: [] })
      }) as unknown as typeof fetch

      const provider = createAmadeusSandboxProvider({
        clientId: 'id',
        clientSecret: 'secret',
        fetchImpl,
        retry: { maxAttempts: 3, sleep: async () => undefined },
      })

      const result = await provider.searchFlights({
        origin: 'RUH',
        destination: 'DXB',
        departureDate: '2026-08-15',
      })
      expect(result.ok).toBe(true)
      expect(flightCalls).toBe(3)
    })

    it('opens circuit breaker after repeated failures', async () => {
      const breaker = createProviderCircuitBreaker({
        failureThreshold: 2,
        openMs: 60_000,
        halfOpenSuccesses: 1,
      })
      const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/oauth2/token')) return tokenResponse()
        return new Response('down', { status: 500 })
      }) as unknown as typeof fetch

      const provider = createAmadeusSandboxProvider({
        clientId: 'id',
        clientSecret: 'secret',
        fetchImpl,
        retry: {
          maxAttempts: 1,
          sleep: async () => undefined,
          circuitBreaker: breaker,
        },
      })

      const first = await provider.searchFlights({
        origin: 'RUH',
        destination: 'DXB',
        departureDate: '2026-08-15',
      })
      expect(first.ok).toBe(false)

      const second = await provider.searchFlights({
        origin: 'RUH',
        destination: 'DXB',
        departureDate: '2026-08-15',
      })
      expect(second.ok).toBe(false)

      const third = await provider.searchFlights({
        origin: 'RUH',
        destination: 'DXB',
        departureDate: '2026-08-15',
      })
      expect(third.error).toBe('CIRCUIT_OPEN')
    })

    it('maps 429 / 401 / 404 style failures without leaking secrets', async () => {
      const events: AmadeusProviderEvent[] = []
      const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/oauth2/token')) return tokenResponse()
        return new Response('rate', { status: 429 })
      }) as unknown as typeof fetch

      const provider = createAmadeusSandboxProvider({
        clientId: 'id',
        clientSecret: 'super-secret-value',
        fetchImpl,
        events,
        retry: { maxAttempts: 1, sleep: async () => undefined },
      })

      const result = await provider.searchFlights({
        origin: 'RUH',
        destination: 'DXB',
        departureDate: '2026-08-15',
      })
      expect(result.ok).toBe(false)
      expect(result.retryable).toBe(true)
      expect(JSON.stringify(events)).not.toMatch(/super-secret-value/)
    })
  })

  describe('registry integration', () => {
    it('registers into Sprint 90 ProviderRegistry with mock failover', async () => {
      const registry = createProviderRegistry()
      registerAmadeusSandboxProvider(registry, {
        clientId: 'id',
        clientSecret: 'secret',
        tier: 'primary',
        fetchImpl: vi.fn(async (input: RequestInfo | URL) => {
          const url = String(input)
          if (url.includes('/oauth2/token')) return tokenResponse()
          return new Response('down', { status: 500 })
        }) as unknown as typeof fetch,
        retry: { maxAttempts: 1, sleep: async () => undefined },
      })
      registry.register(createMockTravelProvider({ id: 'mock-fallback' }), {
        tier: 'fallback',
        rank: 10,
      })

      const result = await registry.searchFlightsWithFailover({
        origin: 'RUH',
        destination: 'DXB',
        departureDate: '2026-08-15',
      })
      expect(result.ok).toBe(true)
      expect(result.providerId).toBe('mock-fallback')
      expect(result.failoverUsed).toBe(true)
    })

    it('createAmadeusSandboxRegistry respects feature flag', () => {
      getFeatureRegistry().setEnabled('providers.amadeus.enabled', false)
      const disabled = createAmadeusSandboxRegistry({
        clientId: 'id',
        clientSecret: 'secret',
      })
      expect(disabled.enabled).toBe(false)
      expect(disabled.amadeus).toBeNull()

      getFeatureRegistry().setEnabled('providers.amadeus.enabled', true)
      const enabled = createAmadeusSandboxRegistry({
        clientId: 'id',
        clientSecret: 'secret',
        enabled: true,
      })
      expect(enabled.enabled).toBe(true)
      expect(enabled.amadeus?.id).toBe('amadeus')
    })
  })

  describe('config / secrets', () => {
    it('resolves API key aliases and never embeds secrets in event payloads', () => {
      const config = resolveAmadeusSandboxConfig({
        env: {
          AMADEUS_API_KEY: 'key-value',
          AMADEUS_API_SECRET: 'secret-value',
        },
      })
      expect(config.hasCredentials).toBe(true)
      expect(config.clientId).toBe('key-value')
      expect(config.baseUrl).toContain('test.api.amadeus.com')
      expect(isProductionDeployTarget({ VITE_DEPLOY_TARGET: 'production' })).toBe(true)

      const missing = createAmadeusSandboxProvider({})
      expect(missing.capabilities().sandbox).toBe(true)
      expect(assertProviderSurface(missing)).toEqual([])
    })

    it('emits token.refresh events without secrets', async () => {
      const seen: AmadeusProviderEvent[] = []
      onAmadeusProviderEvent((e) => seen.push(e))

      let now = 1_000
      const fetchImpl = vi.fn(async () => tokenResponse()) as unknown as typeof fetch
      const oauth = new AmadeusSandboxOAuth({
        clientId: 'id',
        clientSecret: 'secret',
        tokenUrl: amadeusTokenUrl('https://test.api.amadeus.com'),
        fetchImpl,
        now: () => now,
        onTokenRefresh: () => {
          seen.push({
            name: 'provider.token.refresh',
            at: new Date().toISOString(),
            providerId: 'amadeus',
            detail: { latencyMs: 1 },
          })
        },
      })
      await oauth.getToken()
      now += 10
      await oauth.refreshToken()
      expect(seen.some((e) => e.name === 'provider.token.refresh')).toBe(true)
      expect(JSON.stringify(seen)).not.toMatch(/secret/)
    })
  })

  describe('Sprint 93 / 94 additive adapters', () => {
    it('maps Amadeus flights into Unified Trip and BookableTrip shapes', () => {
      const flight = normalizeAmadeusFlightOffer(sampleOffer, 0, { adults: 1, children: 0 })
      const tripOffer = toUnifiedTripFlightOffer(flight)
      expect(tripOffer.origin).toBe('RUH')
      expect(tripOffer.providerId).toBe('amadeus')

      const { trip } = composeUnifiedTrip({
        destination: 'Dubai',
        origin: 'Riyadh',
        startDate: '2026-08-15',
        endDate: '2026-08-20',
        adults: 1,
        currency: 'SAR',
        flightOffers: [tripOffer],
        usePlaceholders: true,
      })
      expect(trip.flights[0]?.providerId).toBe('amadeus')
      expect(trip.valid).toBe(true)

      const bookable = toBookableTrip(trip)
      expect(bookable.flights?.[0]?.origin).toBe('RUH')
      expect(toBookableFlightSegment(flight).providerId).toBe('amadeus')
    })
  })
})
