/**
 * Sprint 73 — Hotel Search Engine tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import {
  applyHotelFilters,
  createHotelSearchEngine,
  decodeHotelCursor,
  dedupeHotels,
  encodeHotelCursor,
  enrichMockHotel,
  normalizeHotelOffer,
  paginateHotels,
  rankHotels,
  resetDefaultHotelSearchEngine,
  sortHotels,
  SPRINT73_HOTEL_SEARCH_VERSION,
  type UnifiedHotel,
} from '../agent/hotelSearchEngine'
import {
  createProviderRuntimeRegistry,
  resetDefaultProviderRuntimeRegistry,
} from '../agent/providerRuntime'

function sampleHotels(): UnifiedHotel[] {
  return [
    enrichMockHotel({ city: 'Dubai', pricePerNight: 400, stars: 4, rating: 8.0, distanceKm: 2 }, 0),
    enrichMockHotel({ city: 'Dubai', pricePerNight: 280, stars: 3, rating: 7.2, distanceKm: 5, breakfastIncluded: false }, 1),
    enrichMockHotel({ city: 'Dubai', pricePerNight: 650, stars: 5, rating: 9.1, distanceKm: 1.2, reviewCount: 400 }, 2),
    {
      ...enrichMockHotel({
        city: 'Dubai',
        hotelName: 'Palm Resort',
        pricePerNight: 500,
        stars: 5,
        rating: 8.8,
        distanceKm: 3,
        coordinates: { latitude: 25.11, longitude: 55.14 },
      }, 3),
      provider: 'booking',
    },
  ]
}

describe('Sprint 73 — Hotel Search Engine', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetDefaultProviderRuntimeRegistry()
    resetDefaultHotelSearchEngine()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetDefaultProviderRuntimeRegistry()
    resetDefaultHotelSearchEngine()
  })

  it('exposes version and searchHotels in mock mode', async () => {
    const engine = createHotelSearchEngine({ forceMock: true })
    expect(engine.version).toBe(SPRINT73_HOTEL_SEARCH_VERSION)
    const page = await engine.searchHotels({
      city: 'Dubai',
      checkIn: '2026-09-01',
      checkOut: '2026-09-04',
    })
    expect(page.hotels.length).toBeGreaterThan(0)
    expect(page.diagnostics.requestId).toMatch(/^htl_/)
    expect(page.hotels[0]).toMatchObject({
      hotelName: expect.any(String),
      currency: expect.any(String),
      bookingToken: expect.any(String),
    })
  })

  it('supports city, by-id, and nearby search', async () => {
    const engine = createHotelSearchEngine({ forceMock: true })
    const city = await engine.searchCityHotels({ city: 'Riyadh' })
    expect(city.hotels.length).toBeGreaterThan(0)

    const byId = await engine.searchHotelById({ hotelId: 'palm-resort', city: 'Dubai' })
    expect(byId.hotels.length).toBeGreaterThan(0)
    expect(byId.hotels[0]?.hotelId).toBe('palm-resort')

    const nearby = await engine.searchNearbyHotels({
      city: 'Dubai',
      latitude: 25.2,
      longitude: 55.27,
      radiusKm: 50,
    })
    expect(nearby.hotels.length).toBeGreaterThan(0)
    expect(nearby.hotels.every((h) => typeof h.distanceKm === 'number')).toBe(true)
  })

  it('ranks hotels by recommendation score', () => {
    const ranked = rankHotels(sampleHotels())
    expect(ranked[0]?.score).toBeGreaterThanOrEqual(ranked[1]?.score ?? 0)
  })

  it('deduplicates hotels keeping highest confidence provider', () => {
    const booking = {
      ...enrichMockHotel({
        city: 'Dubai',
        hotelName: 'Palm Resort',
        coordinates: { latitude: 25.11, longitude: 55.14 },
        pricePerNight: 500,
      }, 0),
      provider: 'booking' as const,
    }
    const mockDup = {
      ...booking,
      hotelId: 'mock_dup',
      provider: 'mock' as const,
      pricePerNight: 900,
    }
    const other = enrichMockHotel({ city: 'Dubai', hotelName: 'Marina Inn' }, 1)
    const deduped = dedupeHotels([mockDup, other, booking])
    expect(deduped).toHaveLength(2)
    const kept = deduped.find((h) => h.hotelName === 'Palm Resort')
    expect(kept?.provider).toBe('booking')
    expect(kept?.pricePerNight).toBe(500)
  })

  it('applies filters', () => {
    const filtered = applyHotelFilters(sampleHotels(), {
      maxPrice: 450,
      minStars: 4,
      minRating: 7.5,
      breakfastIncluded: true,
      refundableOnly: true,
      freeCancellationOnly: true,
    })
    expect(
      filtered.every(
        (h) =>
          h.pricePerNight <= 450
          && h.stars >= 4
          && h.rating >= 7.5
          && h.breakfastIncluded
          && h.refundable
          && h.freeCancellation,
      ),
    ).toBe(true)
  })

  it('sorts by price, rating, nearest, stars', () => {
    const hotels = sampleHotels()
    expect(sortHotels(hotels, 'lowest_price')[0]?.pricePerNight).toBeLessThanOrEqual(
      sortHotels(hotels, 'lowest_price')[1]?.pricePerNight ?? Infinity,
    )
    expect(sortHotels(hotels, 'highest_rating')[0]?.rating).toBeGreaterThanOrEqual(
      sortHotels(hotels, 'highest_rating')[1]?.rating ?? 0,
    )
    expect(sortHotels(hotels, 'nearest')[0]?.distanceKm ?? 0).toBeLessThanOrEqual(
      sortHotels(hotels, 'nearest')[1]?.distanceKm ?? Infinity,
    )
    expect(sortHotels(hotels, 'stars')[0]?.stars).toBeGreaterThanOrEqual(
      sortHotels(hotels, 'stars')[1]?.stars ?? 0,
    )
  })

  it('supports cursor pagination', () => {
    const hotels = sampleHotels()
    const first = paginateHotels(hotels, 2, null)
    expect(first.page).toHaveLength(2)
    expect(first.hasMore).toBe(true)
    expect(decodeHotelCursor(first.nextCursor)).toBe(2)
    const second = paginateHotels(hotels, 2, first.nextCursor)
    expect(second.page[0]?.hotelId).not.toBe(first.page[0]?.hotelId)
    expect(encodeHotelCursor(0)).toBeTruthy()
  })

  it('returns diagnostics without secrets and includes hotelbeds future slot', async () => {
    const engine = createHotelSearchEngine({ forceMock: true })
    const page = await engine.searchHotels({ city: 'Jeddah' })
    const json = JSON.stringify(page.diagnostics)
    expect(json).not.toMatch(/sk_|secret_|token_|password/i)
    expect(page.diagnostics.providersUsed).toContain('hotelbeds')
    expect(page.diagnostics.modes.hotelbeds).toBe('future')
    expect(page.diagnostics).toHaveProperty('fallbackUsed')
    expect(page.diagnostics).toHaveProperty('cacheHit')
  })

  it('normalizes live-shaped booking offers', () => {
    const normalized = normalizeHotelOffer({
      id: 'bk_1',
      providerId: 'booking',
      name: 'Marina Bay Hotel',
      area: 'Dubai Marina',
      stars: 5,
      rating: 9.0,
      nightly: { amount: 520, currency: 'SAR' },
      total: { amount: 1560, currency: 'SAR' },
      taxes: { amount: 78, currency: 'SAR' },
      amenities: ['wifi', 'pool', 'breakfast'],
      roomType: 'deluxe',
      cancellationPolicy: 'Free cancellation',
      refundable: true,
      latitude: 25.08,
      longitude: 55.14,
      photos: ['https://cdn.example/a.jpg'],
    })
    expect(normalized?.provider).toBe('booking')
    expect(normalized?.breakfastIncluded).toBe(true)
    expect(normalized?.freeCancellation).toBe(true)
    expect(normalized?.coordinates?.latitude).toBe(25.08)
  })

  it('automatic failover yields hotels without user-facing failure', async () => {
    const registry = createProviderRuntimeRegistry({ forceMock: true })
    const engine = createHotelSearchEngine({ registry })
    const page = await engine.searchHotels({
      city: 'Dubai',
      sort: 'lowest_price',
      filters: { maxStars: 5 },
    })
    expect(page.hotels.length).toBeGreaterThan(0)
    expect(page.total).toBeGreaterThan(0)
  })
})
