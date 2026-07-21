/**
 * Sprint 60 — Real Hotel Provider Integration (Booking.com)
 * All network calls mocked via injectable fetch — no external I/O.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  BookingProviderError,
  createBookingLiveProvider,
  createProviderRequestId,
  hasBookingCredentials,
  isLiveProviderEnabled,
  isLiveProvidersEnabled,
  logProviderRequest,
  normalizeBookingHotel,
  readBookingApiKey,
  setProviderLogSink,
  type LiveFetch,
  type ProviderLogEntry,
} from '../agent/liveProviders'
import { rankOffersV2 } from '../agent/bookingIntelligence/rankingV2'
import {
  getDefaultBookingProviderRegistry,
  resetDefaultBookingProviderRegistry,
} from '../agent/bookingIntelligence/orchestrator'
import type { FusedOffer } from '../agent/bookingIntelligence/types'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })
}

const SAMPLE_HOTEL = {
  hotel_id: 'htl-42',
  hotel_name: 'Marina Pearl',
  address: 'Sheikh Zayed Rd 12',
  city: 'Dubai',
  latitude: 25.2048,
  longitude: 55.2708,
  review_score: 8.8,
  class: 5,
  currency: 'AED',
  min_total_price: 2400,
  price_breakdown: {
    gross_price: 2400,
    included_taxes: 240,
    currency: 'AED',
    gross_amount_per_night: [{ amount: '600' }],
  },
  main_photo_url: 'https://example.com/marina.jpg',
  photos: [{ url_max750: 'https://example.com/marina-2.jpg' }],
  is_free_cancellable: 1,
  facilities: [{ name: 'Pool' }, { name: 'WiFi' }, { name: 'Breakfast' }],
  room_data: [
    {
      room_name: 'Deluxe King',
      bed_configurations: [{ bed_types: [{ name: 'King', count: 1 }] }],
    },
  ],
  distance_to_city_center_km: 1.2,
}

describe('Sprint 60 — Booking.com real hotel provider', () => {
  const logs: ProviderLogEntry[] = []

  beforeEach(() => {
    resetFeatureRegistry()
    resetDefaultBookingProviderRegistry()
    logs.length = 0
    setProviderLogSink((entry) => {
      logs.push(entry)
    })
  })

  afterEach(() => {
    setProviderLogSink(null)
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    resetFeatureRegistry()
    resetDefaultBookingProviderRegistry()
  })

  describe('credentials (env only)', () => {
    it('reads BOOKING_API_KEY / RAPIDAPI_KEY from environment', () => {
      vi.stubEnv('BOOKING_API_KEY', 'booking-secret')
      expect(readBookingApiKey()).toBe('booking-secret')
      expect(hasBookingCredentials()).toBe(true)
    })
  })

  describe('normalization / mapping', () => {
    it('maps provider payload into Rahhal hotel model fields', () => {
      const hotel = normalizeBookingHotel(SAMPLE_HOTEL, 0, 'USD', 4)
      expect(hotel).toMatchObject({
        id: 'htl-42',
        providerId: 'booking',
        name: 'Marina Pearl',
        address: 'Sheikh Zayed Rd 12',
        stars: 5,
        rating: 8.8,
        roomType: 'Deluxe King (1x King)',
        cancellationPolicy: 'Free cancellation',
        currency: 'AED',
        refundable: true,
        distanceFromCenterKm: 1.2,
      })
      expect(hotel.nightly.amount).toBe(600)
      expect(hotel.total.amount).toBe(2400)
      expect(hotel.taxes.amount).toBe(240)
      expect(hotel.photos.length).toBeGreaterThanOrEqual(2)
      expect(hotel.amenities).toEqual(expect.arrayContaining(['Pool', 'WiFi', 'Breakfast']))
      expect(hotel.latitude).toBeCloseTo(25.2048)
      expect(hotel.longitude).toBeCloseTo(55.2708)
    })
  })

  describe('hotel search', () => {
    it('successful search resolves destination and returns normalized hotels', async () => {
      const fetchImpl: LiveFetch = vi.fn(async (input) => {
        const url = String(input)
        if (url.includes('searchDestination')) {
          return jsonResponse({
            data: [
              {
                dest_id: '-782831',
                search_type: 'city',
                label: 'Dubai',
                city_name: 'Dubai',
              },
            ],
          })
        }
        if (url.includes('/hotels/search')) {
          expect(url).toContain('dest_id=-782831')
          expect(url).toContain('checkin=2026-10-01')
          expect(url).toContain('checkout=2026-10-05')
          expect(url).toContain('adults=2')
          return jsonResponse({ data: { hotels: [SAMPLE_HOTEL] } })
        }
        throw new Error(`unexpected ${url}`)
      })

      const booking = createBookingLiveProvider({
        apiKey: 'rapid_test',
        fetchImpl,
      })
      const hotels = await booking.searchHotels!({
        destination: 'Dubai',
        checkIn: '2026-10-01',
        checkOut: '2026-10-05',
        adults: 2,
        currency: 'AED',
      })
      expect(hotels).toHaveLength(1)
      expect(hotels[0]?.name).toBe('Marina Pearl')
      expect(hotels[0]?.total.currency).toBe('AED')
      expect(logs.some((l) => l.provider === 'booking' && l.status === 'ok')).toBe(true)
      expect(logs[0]?.requestId).toMatch(/^bkg_/)
      expect(typeof logs[0]?.durationMs).toBe('number')
    })

    it('empty results return [] without throwing', async () => {
      const fetchImpl: LiveFetch = vi.fn(async (input) => {
        const url = String(input)
        if (url.includes('searchDestination')) {
          return jsonResponse({ data: [{ dest_id: '1', search_type: 'city', label: 'X' }] })
        }
        return jsonResponse({ data: { hotels: [] } })
      })
      const booking = createBookingLiveProvider({ apiKey: 'k', fetchImpl })
      await expect(
        booking.searchHotels!({
          destination: 'Dubai',
          checkIn: '2026-10-01',
          checkOut: '2026-10-03',
        }),
      ).resolves.toEqual([])
      expect(logs.some((l) => l.status === 'empty')).toBe(true)
    })

    it('invalid city/destination returns [] gracefully', async () => {
      const fetchImpl: LiveFetch = vi.fn(async (input) => {
        const url = String(input)
        if (url.includes('searchDestination')) {
          return jsonResponse({ data: [] })
        }
        return textResponse('Invalid dest_id', 400)
      })
      const booking = createBookingLiveProvider({ apiKey: 'k', fetchImpl })
      await expect(
        booking.searchHotels!({
          destination: 'NotARealCityZZZ',
          checkIn: '2026-10-01',
          checkOut: '2026-10-03',
        }),
      ).resolves.toEqual([])
      expect(logs.some((l) => l.status === 'invalid_destination')).toBe(true)
    })

    it('rate limit throws typed BookingProviderError', async () => {
      const fetchImpl: LiveFetch = vi.fn(async (input) => {
        const url = String(input)
        if (url.includes('searchDestination')) {
          return jsonResponse({ data: [{ dest_id: '1', search_type: 'city', label: 'Dubai' }] })
        }
        return textResponse('quota exceeded', 429)
      })
      const booking = createBookingLiveProvider({ apiKey: 'k', fetchImpl })
      await expect(
        booking.searchHotels!({
          destination: 'Dubai',
          checkIn: '2026-10-01',
          checkOut: '2026-10-03',
        }),
      ).rejects.toMatchObject({
        name: 'BookingProviderError',
        code: 'rate_limit',
        httpStatus: 429,
        retryable: true,
      })
      expect(logs.some((l) => l.status === 'rate_limit')).toBe(true)
    })

    it('timeout throws typed timeout error', async () => {
      const fetchImpl: LiveFetch = vi.fn(async () => {
        throw new DOMException('The operation was aborted.', 'AbortError')
      })
      const booking = createBookingLiveProvider({
        apiKey: 'k',
        fetchImpl,
        timeoutMs: 5,
      })
      await expect(
        booking.searchHotels!({
          destination: '-782831',
          checkIn: '2026-10-01',
          checkOut: '2026-10-03',
        }),
      ).rejects.toBeInstanceOf(BookingProviderError)
      await expect(
        booking.searchHotels!({
          destination: '-782831',
          checkIn: '2026-10-01',
          checkOut: '2026-10-03',
        }),
      ).rejects.toMatchObject({ code: 'timeout' })
      expect(logs.some((l) => l.status === 'timeout')).toBe(true)
    })

    it('provider unavailable (5xx) throws typed error', async () => {
      const fetchImpl: LiveFetch = vi.fn(async (input) => {
        const url = String(input)
        if (url.includes('searchDestination')) {
          return jsonResponse({ data: [{ dest_id: '1', search_type: 'city', label: 'Dubai' }] })
        }
        return textResponse('upstream down', 503)
      })
      const booking = createBookingLiveProvider({ apiKey: 'k', fetchImpl })
      await expect(
        booking.searchHotels!({
          destination: 'Dubai',
          checkIn: '2026-10-01',
          checkOut: '2026-10-03',
        }),
      ).rejects.toMatchObject({ code: 'provider_unavailable' })
    })
  })

  describe('ranking with flights present', () => {
    it('ranks hotels by distance, rating, price, and traveler profile', () => {
      const offers: FusedOffer[] = [
        {
          id: 'far-cheap',
          domain: 'hotels',
          providerId: 'booking',
          title: 'Far Budget Inn',
          price: { amount: 400, currency: 'SAR' },
          rating: 3.5,
          stars: 3,
          walkingDistanceMeters: 4000,
          locationScore: 0.35,
          qualityScore: 0.5,
          confidence: 0.5,
          fusedFromProviderIds: ['booking'],
        },
        {
          id: 'near-luxury',
          domain: 'hotels',
          providerId: 'booking',
          title: 'Nest Central',
          price: { amount: 900, currency: 'SAR' },
          rating: 4.8,
          stars: 5,
          walkingDistanceMeters: 300,
          locationScore: 0.98,
          qualityScore: 0.9,
          confidence: 0.9,
          hotelChain: 'Nest',
          fusedFromProviderIds: ['booking'],
        },
      ]
      const ranked = rankOffersV2({
        offers,
        preferences: {
          userId: 'u60',
          preferredAirlines: [],
          preferredHotelChains: ['Nest'],
          seatType: null,
          hotelStarsMin: 4,
          maxWalkingDistanceMeters: 1500,
          preferredAirports: [],
          mealPreference: null,
          budgetStyle: 'luxury',
          persona: 'luxury',
          pastSelectedOfferIds: [],
          pastSelectedProviderIds: [],
          updatedAt: new Date().toISOString(),
        },
        budgetAmount: 2000,
      })
      expect(ranked[0]?.id).toBe('near-luxury')
      expect(ranked[0]?.rankFactors.location).toBeGreaterThan(ranked[1]?.rankFactors.location ?? 0)
      expect(ranked[0]?.rankFactors.rating).toBeGreaterThan(ranked[1]?.rankFactors.rating ?? 0)
      expect(ranked[0]?.rankFactors.preference).toBeGreaterThan(0.5)
    })
  })

  describe('logging', () => {
    it('never logs credentials', () => {
      logProviderRequest({
        requestId: createProviderRequestId('bkg'),
        provider: 'booking',
        operation: 'searchHotels',
        durationMs: 9,
        status: 'error',
        detail: 'failed X-RapidAPI-Key: supersecretkey api_key=abc123',
      })
      expect(logs[0]?.detail).not.toMatch(/supersecretkey|abc123/i)
      expect(logs[0]?.detail).toContain('[redacted]')
      expect(logs[0]?.provider).toBe('booking')
    })
  })

  describe('mock mode still works', () => {
    it('keeps live Booking.com OFF by default so simulated hotels remain', () => {
      const registry = getFeatureRegistry()
      expect(registry.isEnabled('ai.live_providers')).toBe(false)
      expect(registry.isEnabled('provider.booking')).toBe(false)
      expect(isLiveProvidersEnabled()).toBe(false)
      expect(isLiveProviderEnabled('booking')).toBe(false)

      const booking = getDefaultBookingProviderRegistry()
      const hotels = booking.forDomain('hotels')
      expect(hotels.some((p) => p.providerId.startsWith('sim-'))).toBe(true)
      expect(hotels.every((p) => !p.providerId.startsWith('booking:'))).toBe(true)
    })
  })
})
