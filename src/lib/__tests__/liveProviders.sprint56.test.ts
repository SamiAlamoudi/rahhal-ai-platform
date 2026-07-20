/**
 * Sprint 56 — Live Travel Provider Layer tests.
 * All network calls mocked via injectable fetch — no external I/O.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  AmadeusOAuthManager,
  SmartCache,
  ProviderHealthMonitor,
  ProviderRateLimiter,
  LiveProviderMetrics,
  createAmadeusLiveProvider,
  createDuffelLiveProvider,
  createBookingLiveProvider,
  createLiveProviderRuntime,
  normalizeBookingHotel,
  selectLiveProviders,
  withProviderFailover,
  wrapLiveProvider,
  bridgeLiveProviderToBooking,
  snapshotLiveProviderSecrets,
  redactSecrets,
  amadeusTokenUrl,
} from '../agent/liveProviders'
import type { LiveFetch, LiveProviderSdk } from '../agent/liveProviders'
import {
  getDefaultBookingProviderRegistry,
  resetDefaultBookingProviderRegistry,
} from '../agent/bookingIntelligence/orchestrator'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('Sprint 56 — Live Travel Provider Layer', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetDefaultBookingProviderRegistry()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetFeatureRegistry()
    resetDefaultBookingProviderRegistry()
  })

  describe('feature flags', () => {
    it('registers live provider flags default OFF', () => {
      const registry = getFeatureRegistry()
      expect(registry.isEnabled('ai.live_providers')).toBe(false)
      expect(registry.isEnabled('provider.amadeus')).toBe(false)
      expect(registry.isEnabled('provider.duffel')).toBe(false)
      expect(registry.isEnabled('provider.booking')).toBe(false)
    })
  })

  describe('OAuth refresh + auth retry', () => {
    it('caches tokens and refreshes on demand', async () => {
      let seq = 0
      const fetchImpl: LiveFetch = vi.fn(async () => {
        seq += 1
        return jsonResponse({
          access_token: `tok_${seq}`,
          expires_in: 3600,
          token_type: 'Bearer',
        })
      })
      const oauth = new AmadeusOAuthManager({
        clientId: 'cid',
        clientSecret: 'csecret',
        tokenUrl: amadeusTokenUrl('https://test.api.amadeus.com'),
        fetchImpl,
      })
      const first = await oauth.getToken()
      expect(first.token?.accessToken).toBe('tok_1')
      expect(first.fromCache).toBe(false)
      const cached = await oauth.getToken()
      expect(cached.fromCache).toBe(true)
      const refreshed = await oauth.refreshToken()
      expect(refreshed.token?.accessToken).toBe('tok_2')
      expect(oauth.getRefreshCount()).toBe(1)
      expect(fetchImpl).toHaveBeenCalledTimes(2)
    })

    it('retries authorized fetch after 401', async () => {
      let tokenSeq = 0
      const fetchImpl: LiveFetch = vi.fn(async (input, init) => {
        const url = String(input)
        if (url.includes('/oauth2/token')) {
          tokenSeq += 1
          return jsonResponse({
            access_token: `tok_${tokenSeq}`,
            expires_in: 3600,
            token_type: 'Bearer',
          })
        }
        const auth = String((init?.headers as Record<string, string>)?.Authorization ?? '')
        if (auth.includes('tok_1')) {
          return new Response('unauthorized', { status: 401 })
        }
        return jsonResponse({ ok: true })
      })
      const oauth = new AmadeusOAuthManager({
        clientId: 'cid',
        clientSecret: 'secret',
        tokenUrl: amadeusTokenUrl('https://test.api.amadeus.com'),
        fetchImpl,
      })
      const { response, authRetried } = await oauth.authorizedFetch(
        'https://test.api.amadeus.com/v2/shopping/flight-offers',
      )
      expect(authRetried).toBe(true)
      expect(response.ok).toBe(true)
      expect(oauth.getAuthRetryCount()).toBe(1)
    })
  })

  describe('adapters (mocked network)', () => {
    it('Amadeus searchFlights + airports + pricing', async () => {
      const fetchImpl: LiveFetch = vi.fn(async (input, init) => {
        const url = String(input)
        if (url.includes('/oauth2/token')) {
          return jsonResponse({ access_token: 'tok', expires_in: 3600, token_type: 'Bearer' })
        }
        if (url.includes('/reference-data/locations')) {
          return jsonResponse({
            data: [
              {
                iataCode: 'RUH',
                name: 'King Khalid',
                address: { cityName: 'Riyadh', countryCode: 'SA' },
              },
            ],
          })
        }
        if (url.includes('/flight-offers/pricing')) {
          return jsonResponse({
            data: {
              flightOffers: [
                {
                  id: 'OFF1',
                  price: { total: '1250.00', currency: 'SAR' },
                  itineraries: [
                    {
                      duration: 'PT3H',
                      segments: [
                        {
                          departure: { iataCode: 'RUH', at: '2026-08-01T08:00:00' },
                          arrival: { iataCode: 'DXB', at: '2026-08-01T11:00:00' },
                          carrierCode: 'SV',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          })
        }
        if (url.includes('/flight-offers')) {
          expect(init?.method ?? 'GET').toBe('GET')
          return jsonResponse({
            data: [
              {
                id: 'OFF1',
                price: { total: '1200.00', currency: 'SAR' },
                itineraries: [
                  {
                    duration: 'PT3H',
                    segments: [
                      {
                        departure: { iataCode: 'RUH', at: '2026-08-01T08:00:00' },
                        arrival: { iataCode: 'DXB', at: '2026-08-01T11:00:00' },
                        carrierCode: 'SV',
                      },
                    ],
                  },
                ],
              },
            ],
          })
        }
        throw new Error(`unexpected url ${url}`)
      })

      const amadeus = createAmadeusLiveProvider({
        clientId: 'cid',
        clientSecret: 'secret',
        baseUrl: 'https://test.api.amadeus.com',
        fetchImpl,
      })
      const airports = await amadeus.searchAirports!('riyadh')
      expect(airports[0]?.iata).toBe('RUH')
      const flights = await amadeus.searchFlights!({
        origin: 'RUH',
        destination: 'DXB',
        departureDate: '2026-08-01',
        currency: 'SAR',
      })
      expect(flights).toHaveLength(1)
      expect(flights[0]?.from).toBe('RUH')
      const priced = await amadeus.priceOffer!('OFF1')
      expect(priced?.amount).toBe(1250)
    })

    it('Duffel offer search / details / pricing + order stubs', async () => {
      const fetchImpl: LiveFetch = vi.fn(async (input) => {
        const url = String(input)
        if (url.includes('/air/offer_requests')) {
          return jsonResponse({
            data: {
              offers: [
                {
                  id: 'off_duf_1',
                  total_amount: '900.00',
                  total_currency: 'USD',
                  owner: { iata_code: 'EK' },
                  slices: [
                    {
                      duration: 'PT4H',
                      segments: [
                        {
                          originating_airport_iata_code: 'DXB',
                          destination_airport_iata_code: 'LHR',
                          departing_at: '2026-09-01T10:00:00Z',
                          arriving_at: '2026-09-01T14:00:00Z',
                          marketing_carrier: { iata_code: 'EK' },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          })
        }
        if (url.includes('/air/offers/')) {
          return jsonResponse({
            data: {
              id: 'off_duf_1',
              total_amount: '900.00',
              total_currency: 'USD',
              slices: [
                {
                  segments: [
                    {
                      originating_airport_iata_code: 'DXB',
                      destination_airport_iata_code: 'LHR',
                    },
                  ],
                },
              ],
            },
          })
        }
        throw new Error(`unexpected ${url}`)
      })
      const duffel = createDuffelLiveProvider({ token: 'duffel_test', fetchImpl })
      const offers = await duffel.searchFlights!({
        origin: 'DXB',
        destination: 'LHR',
        departureDate: '2026-09-01',
      })
      expect(offers[0]?.providerId).toBe('duffel')
      const details = await duffel.getOfferDetails!('off_duf_1')
      expect(details && 'from' in details ? details.from : null).toBe('DXB')
      const price = await duffel.priceOffer!('off_duf_1')
      expect(price?.amount).toBe(900)
      const order = await duffel.createOrder!('off_duf_1')
      expect(order.ok).toBe(true)
      expect(order.orderId).toContain('stub')
      const cancel = await duffel.cancelOrder!(order.orderId!)
      expect(cancel.ok).toBe(true)
    })

    it('Booking.com normalizes hotel price/currency/rating/photos/location', async () => {
      const normalized = normalizeBookingHotel(
        {
          hotel_id: 42,
          hotel_name: 'Marina Bay',
          address: 'Downtown',
          latitude: 25.2,
          longitude: 55.3,
          review_score: 8.7,
          class: 5,
          price_breakdown: { gross_price: 640, currency: 'AED' },
          main_photo_url: 'https://example.com/a.jpg',
          photos: [{ url_max750: 'https://example.com/b.jpg' }],
          is_free_cancellable: 1,
        },
        0,
      )
      expect(normalized.name).toBe('Marina Bay')
      expect(normalized.nightly.currency).toBe('AED')
      expect(normalized.rating).toBe(8.7)
      expect(normalized.photos).toHaveLength(2)
      expect(normalized.latitude).toBe(25.2)
      expect(normalized.area).toBe('Downtown')

      const fetchImpl: LiveFetch = vi.fn(async () =>
        jsonResponse({
          data: {
            hotels: [
              {
                hotel_id: 'h1',
                hotel_name: 'Test Hotel',
                city: 'Dubai',
                review_score: 9,
                min_total_price: 500,
                currency: 'USD',
                main_photo_url: 'https://example.com/h.jpg',
              },
            ],
          },
        }),
      )
      const booking = createBookingLiveProvider({ apiKey: 'rapid_test', fetchImpl })
      const hotels = await booking.searchHotels!({
        destination: '-782831',
        checkIn: '2026-08-10',
        checkOut: '2026-08-14',
      })
      expect(hotels[0]?.providerId).toBe('booking')
      expect(hotels[0]?.photos[0]).toContain('example.com')
    })
  })

  describe('cache / rate limit / health / metrics', () => {
    it('smart cache hits airports namespace with TTL', () => {
      let now = 1_000
      const cache = new SmartCache({ now: () => now, ttlByNamespace: { airports: 100 } })
      cache.set('airports', 'ruh', [{ iata: 'RUH' }])
      expect(cache.get('airports', 'ruh')).toEqual([{ iata: 'RUH' }])
      expect(cache.stats().hits).toBe(1)
      now = 1_200
      expect(cache.get('airports', 'ruh')).toBeUndefined()
      expect(cache.stats().misses).toBe(1)
    })

    it('rate limiter queues and rejects when queue is full', async () => {
      let now = 0
      const sleep = vi.fn(async (ms: number) => {
        now += ms
      })
      const limiter = new ProviderRateLimiter({
        maxRequests: 1,
        windowMs: 100,
        maxQueue: 1,
        now: () => now,
        sleep,
      })
      await limiter.acquire()
      const waiting = limiter.acquire()
      await expect(limiter.acquire()).rejects.toThrow('rate_limit_queue_full')
      now = 100
      await waiting
      expect(limiter.stats().accepted).toBe(2)
      expect(limiter.stats().rejected).toBe(1)
    })

    it('health monitor auto-disables unhealthy providers', () => {
      const health = new ProviderHealthMonitor({
        failureThreshold: 0.5,
        windowSize: 10,
      })
      for (let i = 0; i < 6; i += 1) {
        health.recordFailure('amadeus', 100, 'boom')
      }
      expect(health.isAvailable('amadeus')).toBe(false)
      const snap = health.snapshot('amadeus')
      expect(snap.disabled).toBe(true)
      expect(snap.healthy).toBe(false)
    })

    it('metrics track latency, failures, cache, search, readiness', () => {
      const metrics = new LiveProviderMetrics()
      metrics.recordApiCall('amadeus', 120, true)
      metrics.recordApiCall('amadeus', 200, false)
      metrics.recordCache(true)
      metrics.recordCache(false)
      metrics.recordSearchDuration(50)
      metrics.recordRankingDuration(30)
      metrics.recordBookingReadiness(true)
      metrics.recordBookingReadiness(false)
      const snap = metrics.snapshot()
      expect(snap.requests).toBe(2)
      expect(snap.providerFailures.amadeus).toBe(1)
      expect(snap.cacheHitRatio).toBe(0.5)
      expect(snap.bookingReadinessTrue).toBe(1)
      expect(snap.searchDurationMs).toBe(50)
    })
  })

  describe('provider selection + failover routing', () => {
    it('selects available high-quality providers and fails over', async () => {
      const health = new ProviderHealthMonitor()
      health.recordSuccess('duffel', 80, 0.9)
      health.recordSuccess('amadeus', 400, 0.7)

      const duffel: LiveProviderSdk = {
        providerId: 'duffel',
        displayName: 'Duffel',
        capabilities: {
          flights: true,
          hotels: false,
          activities: false,
          cars: false,
          transfers: false,
          insurance: false,
          airports: false,
        },
        isAvailable: () => true,
        searchFlights: async () => {
          throw new Error('duffel_down')
        },
      }
      const amadeus: LiveProviderSdk = {
        providerId: 'amadeus',
        displayName: 'Amadeus',
        capabilities: {
          flights: true,
          hotels: false,
          activities: false,
          cars: false,
          transfers: false,
          insurance: false,
          airports: false,
        },
        isAvailable: () => true,
        searchFlights: async () => [
          {
            id: 'a1',
            providerId: 'amadeus',
            from: 'RUH',
            to: 'DXB',
            airline: 'SV',
            cabin: 'ECONOMY',
            stops: 0,
            durationMinutes: 120,
            departureAt: null,
            arrivalAt: null,
            price: { amount: 800, currency: 'SAR' },
            refundable: true,
          },
        ],
      }

      const { selected, scores } = selectLiveProviders({
        providers: [amadeus, duffel],
        health,
        criteria: { domain: 'flights', preferSpeed: true },
      })
      expect(selected.length).toBe(2)
      expect(scores[0]?.providerId).toBe('duffel')

      const failover = await withProviderFailover({
        providers: selected,
        run: async (sdk) => (await sdk.searchFlights!({
          origin: 'RUH',
          destination: 'DXB',
          departureDate: '2026-08-01',
        })) ?? [],
        isEmpty: (offers) => offers.length === 0,
      })
      expect(failover.usedProviderId).toBe('amadeus')
      expect(failover.attempted).toEqual(['duffel', 'amadeus'])
      expect(failover.result).toHaveLength(1)
    })

    it('runtime searchFlights routes with cache + instrumentation', async () => {
      let calls = 0
      const fetchImpl: LiveFetch = vi.fn(async (input) => {
        const url = String(input)
        if (url.includes('/oauth2/token')) {
          return jsonResponse({ access_token: 'tok', expires_in: 3600, token_type: 'Bearer' })
        }
        calls += 1
        return jsonResponse({
          data: [
            {
              id: `OFF${calls}`,
              price: { total: '1000', currency: 'SAR' },
              itineraries: [
                {
                  duration: 'PT2H',
                  segments: [
                    {
                      departure: { iataCode: 'RUH', at: '2026-08-01T08:00:00' },
                      arrival: { iataCode: 'JED', at: '2026-08-01T10:00:00' },
                      carrierCode: 'SV',
                    },
                  ],
                },
              ],
            },
          ],
        })
      })
      const amadeus = createAmadeusLiveProvider({
        clientId: 'id',
        clientSecret: 'secret',
        fetchImpl,
      })
      const runtime = createLiveProviderRuntime({
        enabled: true,
        providers: [amadeus],
        rateLimit: { maxRequests: 20, windowMs: 60_000 },
      })
      const first = await runtime.searchFlights({
        origin: 'RUH',
        destination: 'JED',
        departureDate: '2026-08-01',
      })
      const second = await runtime.searchFlights({
        origin: 'RUH',
        destination: 'JED',
        departureDate: '2026-08-01',
      })
      expect(first.offers).toHaveLength(1)
      expect(second.offers).toHaveLength(1)
      expect(calls).toBe(1)
      expect(runtime.cacheStats().hits).toBeGreaterThanOrEqual(1)
      expect(runtime.metrics().cacheHitRatio).toBeGreaterThan(0)
    })
  })

  describe('bridge + booking intelligence composition', () => {
    it('bridges live SDK into BookingProvider without traveler-facing prose', async () => {
      const booking = createBookingLiveProvider({
        apiKey: 'k',
        fetchImpl: async () =>
          jsonResponse({
            data: {
              hotels: [
                {
                  hotel_id: 'h9',
                  hotel_name: 'Harbor Inn',
                  city: 'Jeddah',
                  review_score: 8,
                  currency: 'SAR',
                  min_total_price: 400,
                },
              ],
            },
          }),
      })
      const providers = bridgeLiveProviderToBooking(booking)
      expect(providers.some((p) => p.domain === 'hotels')).toBe(true)
      const hotels = providers.find((p) => p.domain === 'hotels')!
      const offers = await hotels.search({
        domain: 'hotels',
        destination: 'Jeddah',
        startDate: '2026-08-01',
        endDate: '2026-08-05',
      })
      expect(offers[0]?.title).toBe('Harbor Inn')
      expect(offers[0]?.price.currency).toBe('SAR')
    })

    it('default booking registry stays simulated when live layer is off', () => {
      const registry = getDefaultBookingProviderRegistry()
      expect(registry.list().some((p) => p.providerId.includes('sim'))).toBe(true)
      expect(registry.list().every((p) => !p.providerId.startsWith('amadeus:'))).toBe(true)
    })
  })

  describe('secrets hygiene', () => {
    it('snapshots presence only and redacts values', () => {
      const snap = snapshotLiveProviderSecrets()
      expect(snap).toHaveProperty('amadeusConfigured')
      expect(snap).toHaveProperty('sources')
      expect(redactSecrets('supersecretvalue')).toMatch(/^su…ue$/)
      expect(JSON.stringify(snap)).not.toMatch(/CLIENT_SECRET/)
    })
  })

  describe('wrap instrumentation', () => {
    it('records failures into health + metrics', async () => {
      const health = new ProviderHealthMonitor()
      const metrics = new LiveProviderMetrics()
      const cache = new SmartCache()
      const limiter = new ProviderRateLimiter({ maxRequests: 10, windowMs: 1000 })
      const sdk: LiveProviderSdk = {
        providerId: 'amadeus',
        displayName: 'Amadeus',
        capabilities: {
          flights: true,
          hotels: false,
          activities: false,
          cars: false,
          transfers: false,
          insurance: false,
          airports: false,
        },
        isAvailable: () => true,
        searchFlights: async () => {
          throw new Error('network')
        },
      }
      const wrapped = wrapLiveProvider({ sdk, health, rateLimiter: limiter, cache, metrics })
      await expect(
        wrapped.searchFlights!({
          origin: 'RUH',
          destination: 'DXB',
          departureDate: '2026-08-01',
        }),
      ).rejects.toThrow('network')
      expect(metrics.snapshot().providerFailures.amadeus).toBe(1)
      expect(health.snapshot('amadeus').failureCount).toBe(1)
    })
  })
})
