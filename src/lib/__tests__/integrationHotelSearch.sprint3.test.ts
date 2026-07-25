/**
 * Integration Sprint 3 — Live Hotel Search conversation bridge tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  INTEGRATION_LIVE_HOTEL_SEARCH_VERSION,
  buildConsultantHotelSummary,
  buildLiveHotelCriteriaFromContext,
  conversationHotelResultToToolData,
  getConversationHotelSearchCache,
  rankConversationHotels,
  resetConversationHotelSearchCache,
  runConversationAwareHotelSearch,
  tryConversationLiveHotelSearch,
} from '../agent/integrationHotelSearch'
import { extractFromUserText } from '../agent/extractRequirements'
import { emptyRequirements, mergeRequirements } from '../agent'
import {
  createHotelSearchEngine,
  resetDefaultHotelSearchEngine,
} from '../agent/hotelSearchEngine'
import { runHotelSearchTool } from '../agent/tools/searchEngineBridge'
import { resetDefaultProviderRuntimeRegistry } from '../agent/providerRuntime'
import type { AgentToolContext } from '../agent/tools/types'
import type { LiveHotelSearchResult } from '../agent/liveHotelSearch'
import { LIVE_HOTEL_SEARCH_FEATURE_ID } from '../agent/liveHotelSearch'

function ctx(partial?: {
  requirements?: Partial<ReturnType<typeof emptyRequirements>>
  input?: Record<string, unknown>
  locale?: 'ar' | 'en'
}): AgentToolContext {
  const requirements = mergeRequirements(emptyRequirements(), {
    destination: 'Casablanca',
    destinations: ['Casablanca'],
    startDate: '2026-09-10',
    endDate: '2026-09-14',
    travelers: 2,
    budgetCurrency: 'SAR',
    ...partial?.requirements,
  })
  return {
    locale: partial?.locale ?? 'ar',
    requirements,
    input: partial?.input ?? {},
    tripPlan: null,
    itinerary: null,
  }
}

function liveOk(overrides?: Partial<LiveHotelSearchResult>): LiveHotelSearchResult {
  return {
    version: '1.0.0-live-hotel-search',
    enabled: true,
    ok: true,
    empty: false,
    hotels: [
      {
        id: 'htl_1',
        hotelId: 'AMD1',
        hotelName: 'Casa Business Suites',
        city: 'Casablanca',
        country: 'MA',
        latitude: 33.57,
        longitude: -7.59,
        roomType: 'Deluxe',
        boardType: 'BREAKFAST',
        rating: 4.6,
        stars: 5,
        price: 650,
        currency: 'SAR',
        taxes: 40,
        freeCancellation: true,
        amenities: ['wifi', 'gym', 'breakfast', 'parking'],
        images: ['https://example.com/h1.jpg'],
        provider: 'amadeus',
      },
      {
        id: 'htl_2',
        hotelId: 'AMD2',
        hotelName: 'Budget Corniche Inn',
        city: 'Casablanca',
        country: 'MA',
        latitude: 33.6,
        longitude: -7.62,
        roomType: 'Standard',
        boardType: 'ROOM_ONLY',
        rating: 3.8,
        stars: 3,
        price: 280,
        currency: 'SAR',
        taxes: 20,
        freeCancellation: false,
        amenities: ['wifi'],
        images: [],
        provider: 'amadeus',
      },
    ],
    hotelOffers: [],
    rankings: [],
    latencyMs: 55,
    attempts: 1,
    error: null,
    validationErrors: [],
    logs: [],
    meta: {
      destination: 'Casablanca',
      checkInDate: '2026-09-10',
      checkOutDate: '2026-09-14',
      adults: 2,
      children: 0,
      rooms: 1,
      currency: 'SAR',
      providerId: 'amadeus',
      maxResults: 20,
    },
    ...overrides,
  }
}

describe('Integration Sprint 3 — Live Hotel Search', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetConversationHotelSearchCache()
    resetDefaultProviderRuntimeRegistry()
    resetDefaultHotelSearchEngine()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetConversationHotelSearchCache()
    resetDefaultProviderRuntimeRegistry()
    resetDefaultHotelSearchEngine()
    vi.restoreAllMocks()
  })

  it('keeps live hotel search flag OFF by default', () => {
    expect(getFeatureRegistry().isEnabled(LIVE_HOTEL_SEARCH_FEATURE_ID)).toBe(false)
    expect(INTEGRATION_LIVE_HOTEL_SEARCH_VERSION).toMatch(/integration-hotel/)
  })

  it('returns null from bridge when flag is OFF', async () => {
    expect(await tryConversationLiveHotelSearch(ctx())).toBeNull()
  })

  it('extracts Casablanca hotel ask and only needs dates later', () => {
    const extracted = extractFromUserText('I want a hotel in Casablanca.')
    // Destination resolver may canonicalize city → country (Morocco).
    expect(extracted.patch.destination?.toLowerCase()).toMatch(/casablanca|morocco/)
    expect(extracted.patch.startDate).toBeFalsy()
  })

  it('extracts Arabic hotel prefs: rooms, breakfast, pool, free cancel, area', () => {
    const extracted = extractFromUserText(
      'أبغى فندق في الدار البيضاء غرفتين مع إفطار ومسبح وإلغاء مجاني وسط المدينة',
    )
    expect(extracted.patch.destination).toBeTruthy()
    expect(extracted.patch.rooms).toBe(2)
    expect(extracted.patch.breakfastRequired).toBe(true)
    expect(extracted.patch.freeCancellationRequired).toBe(true)
    expect(extracted.patch.preferredArea).toBe('central')
    expect(extracted.patch.hotelAmenities).toEqual(expect.arrayContaining(['breakfast', 'pool']))
  })

  it('builds live hotel criteria with adults, children, rooms, currency', () => {
    const criteria = buildLiveHotelCriteriaFromContext(ctx({
      requirements: {
        destination: 'Casablanca',
        destinations: ['Casablanca'],
        startDate: '2026-10-01',
        endDate: '2026-10-05',
        travelers: 4,
        children: 2,
        rooms: 2,
        budgetCurrency: 'SAR',
      },
    }))
    expect(criteria.destination).toMatch(/Casablanca/i)
    expect(criteria.adults).toBe(2)
    expect(criteria.children).toBe(2)
    expect(criteria.rooms).toBe(2)
    expect(criteria.currency).toBe('SAR')
    expect(criteria.checkInDate).toBe('2026-10-01')
    expect(criteria.checkOutDate).toBe('2026-10-05')
  })

  it('ranks hotels with WHY explanations', () => {
    const ranked = rankConversationHotels([
      {
        id: '1',
        hotelId: 'A',
        providerId: 'amadeus',
        hotelName: 'Casa Business Suites',
        city: 'Casablanca',
        area: 'central',
        stars: 5,
        rating: 4.7,
        reviewCount: 320,
        pricePerNight: 650,
        currency: 'SAR',
        breakfastIncluded: true,
        freeCancellation: true,
        refundable: true,
        amenities: ['wifi', 'gym', 'breakfast', 'parking'],
        distanceKm: 1.2,
      },
      {
        id: '2',
        hotelId: 'B',
        providerId: 'amadeus',
        hotelName: 'Far Budget Inn',
        city: 'Casablanca',
        stars: 2,
        rating: 3.1,
        reviewCount: 12,
        pricePerNight: 200,
        currency: 'SAR',
        breakfastIncluded: false,
        freeCancellation: false,
        refundable: false,
        amenities: [],
        distanceKm: 18,
      },
    ], {
      breakfastRequired: true,
      freeCancellationRequired: true,
      amenities: ['gym'],
      tripPurpose: 'business',
      preferredArea: 'central',
    })

    expect(ranked[0]?.hotelName).toBe('Casa Business Suites')
    expect(ranked[0]?.reasons.length).toBeGreaterThan(0)
    expect(ranked[0]?.whyEn).toMatch(/breakfast|cancellation|budget|rating|location|business|amenities/i)
  })

  it('builds consultant summary without raw JSON', () => {
    const ranked = rankConversationHotels([
      {
        id: '1',
        hotelId: 'A',
        providerId: 'amadeus',
        hotelName: 'Casa Business Suites',
        city: 'Casablanca',
        stars: 5,
        rating: 4.7,
        pricePerNight: 650,
        currency: 'SAR',
        breakfastIncluded: true,
        freeCancellation: true,
        refundable: true,
        amenities: ['wifi', 'gym'],
      },
    ])
    const summary = buildConsultantHotelSummary(ranked, {
      destination: 'Casablanca',
      checkIn: '2026-09-10',
      checkOut: '2026-09-14',
    })
    expect(summary.en).toMatch(/Casablanca/)
    expect(summary.ar).not.toMatch(/\{"hotelId"/)
    expect(summary.en).not.toMatch(/providerConfidence/)
  })

  it('runs live bridge with injected provider and caches duplicates', async () => {
    getFeatureRegistry().setEnabled(LIVE_HOTEL_SEARCH_FEATURE_ID, true)
    const runLive = vi.fn(async () => liveOk())
    const first = await tryConversationLiveHotelSearch(ctx(), {
      enabled: true,
      runLive,
      fallbackToMock: false,
    })
    expect(first?.usedLive).toBe(true)
    expect(first?.stays.length).toBe(2)
    expect(first?.consultantSummaryAr).toBeTruthy()
    expect(runLive).toHaveBeenCalledTimes(1)

    const second = await tryConversationLiveHotelSearch(ctx(), {
      enabled: true,
      runLive,
      fallbackToMock: false,
    })
    expect(second?.cacheHit).toBe(true)
    expect(runLive).toHaveBeenCalledTimes(1)
    expect(getConversationHotelSearchCache().stats().hits).toBeGreaterThanOrEqual(1)
  })

  it('falls back to mock engine when live provider fails', async () => {
    getFeatureRegistry().setEnabled(LIVE_HOTEL_SEARCH_FEATURE_ID, true)
    const runLive = vi.fn(async () => liveOk({
      ok: false,
      empty: true,
      hotels: [],
      error: {
        code: 'RATE_LIMITED',
        message: 'rate limited',
        retryable: true,
        rateLimited: true,
        timedOut: false,
        httpStatus: 429,
      },
    }))
    const engine = createHotelSearchEngine({ forceMock: true })
    const result = await tryConversationLiveHotelSearch(ctx(), {
      enabled: true,
      runLive,
      engine,
      fallbackToMock: true,
    })
    expect(result).toBeTruthy()
    expect(result!.usedLive).toBe(false)
    expect(result!.stays.length).toBeGreaterThan(0)
  })

  it('runHotelSearchTool stays on mock path when flag OFF', async () => {
    const engine = createHotelSearchEngine({ forceMock: true })
    const { data, empty } = await runHotelSearchTool(engine, ctx())
    expect(empty).toBe(false)
    expect(data.searchEngine).toBe('hotelSearchEngine')
    expect(Array.isArray(data.stays)).toBe(true)
  })

  it('runConversationAwareHotelSearch uses live bridge when flag ON', async () => {
    getFeatureRegistry().setEnabled(LIVE_HOTEL_SEARCH_FEATURE_ID, true)
    const engine = createHotelSearchEngine({ forceMock: true })
    const { data, empty } = await runConversationAwareHotelSearch(engine, ctx(), {
      runLive: async () => liveOk(),
      fallbackToMock: false,
    })
    expect(empty).toBe(false)
    expect(data.searchEngine).toBe('liveHotelSearch')
    expect(data.consultantSummaryAr).toBeTruthy()
    const stay = (data.stays as Array<Record<string, unknown>>)[0]!
    expect(stay.whyAr).toBeTruthy()
  })

  it('conversationHotelResultToToolData includes ranking WHY fields', () => {
    const ranked = rankConversationHotels([
      {
        id: '1',
        hotelId: 'A',
        providerId: 'amadeus',
        hotelName: 'Casa Business Suites',
        city: 'Casablanca',
        stars: 5,
        rating: 4.7,
        pricePerNight: 650,
        currency: 'SAR',
        breakfastIncluded: true,
        freeCancellation: true,
        refundable: true,
        amenities: ['wifi'],
      },
    ])
    const summary = buildConsultantHotelSummary(ranked, {
      destination: 'Casablanca',
      checkIn: '2026-09-10',
      checkOut: '2026-09-14',
    })
    const toolData = conversationHotelResultToToolData({
      version: INTEGRATION_LIVE_HOTEL_SEARCH_VERSION,
      usedLive: true,
      cacheHit: false,
      empty: false,
      stays: ranked,
      highlights: { best: 'x', cheapest: 'y', highestRated: 'z' },
      consultantSummaryAr: summary.ar,
      consultantSummaryEn: summary.en,
      diagnostics: {
        providerId: 'amadeus',
        latencyMs: 10,
        destination: 'Casablanca',
        checkIn: '2026-09-10',
        checkOut: '2026-09-14',
        adults: 2,
        children: 0,
        rooms: 1,
        currency: 'SAR',
      },
    }, 4)
    const stay = (toolData.stays as Array<Record<string, unknown>>)[0]!
    expect(stay.reasons).toBeTruthy()
    expect(toolData.usedLive).toBe(true)
  })

  it('Hotel Search Engine cacheHit becomes true on duplicate query', async () => {
    const engine = createHotelSearchEngine({ forceMock: true })
    const req = {
      city: 'Casablanca',
      destination: 'Casablanca',
      checkIn: '2026-09-10',
      checkOut: '2026-09-14',
      adults: 2,
      children: 0,
      rooms: 1,
      currency: 'SAR',
    }
    const first = await engine.searchHotels(req)
    const second = await engine.searchHotels(req)
    expect(first.diagnostics.cacheHit).toBe(false)
    expect(second.diagnostics.cacheHit).toBe(true)
  })
})
