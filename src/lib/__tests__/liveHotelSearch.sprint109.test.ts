/**
 * Sprint 109 — Live Hotel Search (Amadeus) tests.
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
  SPRINT109_LIVE_HOTEL_SEARCH_VERSION,
  LIVE_HOTEL_SEARCH_FEATURE_ID,
  isLiveHotelSearchEnabled,
  validateLiveHotelSearchCriteria,
  composeLiveHotelSearchRequest,
  mapGatewayOfferToHotelOffer,
  rankHotelOffers,
  runLiveHotelSearch,
  createLiveHotelSearchRunner,
  createLiveHotelSearchMetrics,
  type LiveHotelSearchCriteria,
  type HotelOffer,
} from '../agent/liveHotelSearch'

function baseCriteria(
  overrides?: Partial<LiveHotelSearchCriteria>,
): LiveHotelSearchCriteria {
  return {
    destination: 'DXB',
    checkInDate: '2026-09-15',
    checkOutDate: '2026-09-18',
    adults: 2,
    children: 1,
    rooms: 1,
    currency: 'SAR',
    maxResults: 10,
    ...overrides,
  }
}

function hotelResultRow(overrides?: Record<string, unknown>) {
  return {
    id: 'off_1',
    hotelId: 'H1',
    hotelName: 'Marina Hotel',
    title: 'Marina Hotel',
    name: 'Marina Hotel',
    city: 'Dubai',
    country: 'AE',
    latitude: 25.08,
    longitude: 55.14,
    roomType: 'STANDARD',
    boardType: 'BREAKFAST',
    rating: 4,
    stars: 4,
    price: 900,
    currency: 'SAR',
    taxes: 50,
    freeCancellation: true,
    refundable: true,
    amenities: ['WIFI', 'POOL', 'FAMILY'],
    images: ['https://example.com/h1.jpg'],
    provider: 'amadeus',
    providerId: 'amadeus',
    ...overrides,
  }
}

function amadeusLikeHotelProvider(overrides?: {
  empty?: boolean
  throwErr?: Error
  failOk?: boolean
  errorCode?: string
  rows?: Record<string, unknown>[]
}): TravelProvider {
  const base = createMockTravelProvider({
    id: 'amadeus',
    mode: 'sandbox',
    latencyMs: 0,
  })
  return {
    ...base,
    capabilities: () => ({
      flights: false,
      hotels: true,
      packages: false,
      booking: false,
      cancellation: false,
      sandbox: true,
      live: false,
    }),
    async searchHotels(request) {
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
      if (overrides?.empty) {
        return {
          ok: true,
          providerId: 'amadeus',
          mode: 'sandbox',
          results: [],
          partial: false,
          empty: true,
          latencyMs: 1,
        }
      }
      const rows = overrides?.rows ?? [
        hotelResultRow(),
        hotelResultRow({
          id: 'off_2',
          hotelId: 'H2',
          hotelName: 'Budget Inn',
          title: 'Budget Inn',
          name: 'Budget Inn',
          price: 400,
          stars: 2,
          rating: 2,
          freeCancellation: false,
          amenities: ['WIFI'],
          latitude: 25.2,
          longitude: 55.3,
        }),
        hotelResultRow({
          id: 'off_3',
          hotelId: 'H3',
          hotelName: 'Palace Luxury',
          title: 'Palace Luxury',
          name: 'Palace Luxury',
          price: 3500,
          stars: 5,
          rating: 5,
          amenities: ['WIFI', 'SPA', 'BUSINESS'],
          latitude: 25.1,
          longitude: 55.15,
        }),
      ]
      return {
        ok: true,
        providerId: 'amadeus',
        mode: 'sandbox',
        results: rows.map((r) => ({
          ...r,
          checkIn: request.checkIn,
          checkOut: request.checkOut,
        })),
        partial: false,
        empty: false,
        latencyMs: 1,
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

describe('Sprint 109 — Live Hotel Search', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
    vi.restoreAllMocks()
  })

  it('exposes version and feature flag default OFF', () => {
    expect(SPRINT109_LIVE_HOTEL_SEARCH_VERSION).toMatch(/live-hotel-search/)
    expect(LIVE_HOTEL_SEARCH_FEATURE_ID).toBe('ai.live_hotel_search')
    expect(getFeatureRegistry().isEnabled('ai.live_hotel_search')).toBe(false)
    expect(isLiveHotelSearchEnabled()).toBe(false)
  })

  describe('validation', () => {
    it('accepts valid criteria', () => {
      const v = validateLiveHotelSearchCriteria(baseCriteria())
      expect(v.ok).toBe(true)
      expect(v.normalized?.destination).toBe('DXB')
      expect(v.normalized?.rooms).toBe(1)
    })

    it('rejects missing dates, invalid destination, invalid occupancy', () => {
      expect(validateLiveHotelSearchCriteria(baseCriteria({
        checkInDate: '',
        checkOutDate: '',
      })).ok).toBe(false)
      expect(validateLiveHotelSearchCriteria(baseCriteria({
        destination: 'A',
      })).ok).toBe(false)
      expect(validateLiveHotelSearchCriteria(baseCriteria({
        adults: 0,
      })).ok).toBe(false)
      expect(validateLiveHotelSearchCriteria(baseCriteria({
        checkInDate: '2026-09-20',
        checkOutDate: '2026-09-15',
      })).ok).toBe(false)
    })
  })

  describe('composer + mapping + ranking', () => {
    it('composes gateway hotel request', () => {
      const composed = composeLiveHotelSearchRequest(baseCriteria({ rooms: 2 }))
      expect(composed.gatewayRequest.operation).toBe('search_hotels')
      expect(composed.gatewayRequest.providerId).toBe('amadeus')
      expect(composed.gatewayRequest.hotel?.checkIn).toBe('2026-09-15')
      expect(composed.gatewayRequest.hotel?.rooms).toBe(2)
    })

    it('maps gateway offer into HotelOffer', () => {
      const hotel = mapGatewayOfferToHotelOffer({
        id: 'off_1',
        providerId: 'amadeus',
        kind: 'hotel',
        title: 'Marina Hotel',
        price: 900,
        currency: 'SAR',
        raw: hotelResultRow(),
      })
      expect(hotel.hotelId).toBe('H1')
      expect(hotel.hotelName).toBe('Marina Hotel')
      expect(hotel.freeCancellation).toBe(true)
      expect(hotel.amenities).toContain('WIFI')
      expect(hotel.provider).toBe('amadeus')
    })

    it('ranks Best Overall, Budget, Luxury, Business, Family, Closest', () => {
      const hotels: HotelOffer[] = [
        mapGatewayOfferToHotelOffer({
          id: 'off_1',
          providerId: 'amadeus',
          kind: 'hotel',
          title: 'Marina',
          price: 900,
          currency: 'SAR',
          raw: hotelResultRow(),
        }),
        mapGatewayOfferToHotelOffer({
          id: 'off_2',
          providerId: 'amadeus',
          kind: 'hotel',
          title: 'Budget',
          price: 400,
          currency: 'SAR',
          raw: hotelResultRow({
            id: 'off_2',
            hotelId: 'H2',
            hotelName: 'Budget Inn',
            price: 400,
            stars: 2,
            amenities: ['WIFI'],
            latitude: 25.5,
            longitude: 55.5,
          }),
        }),
        mapGatewayOfferToHotelOffer({
          id: 'off_3',
          providerId: 'amadeus',
          kind: 'hotel',
          title: 'Palace',
          price: 3500,
          currency: 'SAR',
          raw: hotelResultRow({
            id: 'off_3',
            hotelId: 'H3',
            hotelName: 'Palace Luxury',
            price: 3500,
            stars: 5,
            amenities: ['WIFI', 'BUSINESS', 'SPA'],
            latitude: 25.09,
            longitude: 55.14,
          }),
        }),
      ]
      const rankings = rankHotelOffers(hotels, { latitude: 25.08, longitude: 55.14 })
      const byKind = Object.fromEntries(rankings.map((r) => [r.kind, r.offer?.hotelId]))
      expect(byKind.budget).toBe('H2')
      expect(byKind.luxury).toBe('H3')
      expect(byKind.closest_location).toBe('H1')
      expect(rankings.map((r) => r.kind)).toEqual([
        'best_overall',
        'budget',
        'luxury',
        'business',
        'family',
        'closest_location',
      ])
    })
  })

  describe('feature flag', () => {
    it('OFF does not call providers', async () => {
      const searchHotels = vi.fn()
      const provider: TravelProvider = {
        ...amadeusLikeHotelProvider(),
        searchHotels,
      }
      const result = await runLiveHotelSearch(baseCriteria(), {
        enabled: false,
        gateway: gatewayWith(provider),
      })
      expect(result.enabled).toBe(false)
      expect(result.logs).toContain('live_hotel_search_disabled')
      expect(searchHotels).not.toHaveBeenCalled()
    })

    it('ON performs hotel search', async () => {
      getFeatureRegistry().setEnabled('ai.live_hotel_search', true)
      const result = await runLiveHotelSearch(baseCriteria(), {
        enabled: true,
        gateway: gatewayWith(amadeusLikeHotelProvider()),
      })
      expect(result.enabled).toBe(true)
      expect(result.ok).toBe(true)
      expect(result.hotels.length).toBeGreaterThan(0)
      expect(result.hotelOffers[0]?.name).toBeTruthy()
      expect(result.rankings.length).toBe(6)
    })
  })

  describe('empty results + provider errors + timeouts', () => {
    it('empty results', async () => {
      const result = await runLiveHotelSearch(baseCriteria(), {
        enabled: true,
        gateway: gatewayWith(amadeusLikeHotelProvider({ empty: true })),
      })
      expect(result.ok).toBe(false)
      expect(result.empty).toBe(true)
      expect(result.error?.code).toBe('EMPTY_RESULTS')
      expect(result.error?.message).toMatch(/No hotels found/i)
    })

    it('provider auth error', async () => {
      const result = await runLiveHotelSearch(baseCriteria(), {
        enabled: true,
        gateway: gatewayWith(amadeusLikeHotelProvider({
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
    })

    it('timeout', async () => {
      const slow: TravelProvider = {
        ...amadeusLikeHotelProvider(),
        async searchHotels() {
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
      const result = await runLiveHotelSearch(baseCriteria({ timeoutMs: 5 }), {
        enabled: true,
        gateway,
      })
      expect(result.ok).toBe(false)
      expect(result.error).not.toBeNull()
    })

    it('records metrics', async () => {
      const metrics = createLiveHotelSearchMetrics()
      const runner = createLiveHotelSearchRunner({
        enabled: true,
        metrics,
        gateway: gatewayWith(amadeusLikeHotelProvider()),
      })
      await runner.search(baseCriteria())
      await runner.search(baseCriteria({ destination: '' }))
      const snap = metrics.snapshot()
      expect(snap.searches).toBe(2)
      expect(snap.successes).toBe(1)
      expect(snap.validationFailures).toBe(1)
    })
  })

  it('maps provider-unavailable gateway response', async () => {
    const gateway: ReturnType<typeof createProviderGateway> = {
      ...createProviderGateway({ sleep: async () => undefined }),
      async execute(): Promise<GatewayResponse> {
        return {
          version: 'test',
          enabled: true,
          operation: 'search_hotels',
          providerId: 'amadeus',
          ok: false,
          offers: [],
          empty: true,
          partial: false,
          latencyMs: 2,
          attempts: 1,
          error: {
            code: 'PROVIDER_UNAVAILABLE',
            message: 'unavailable',
            retryable: true,
            providerId: 'amadeus',
            rateLimited: false,
            timedOut: false,
          },
          logs: [],
        }
      },
    }
    const result = await runLiveHotelSearch(baseCriteria(), {
      enabled: true,
      gateway,
    })
    expect(result.error?.code).toBe('PROVIDER_UNAVAILABLE')
  })
})
