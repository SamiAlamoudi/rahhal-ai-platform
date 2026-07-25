/**
 * Integration Sprint 2 — Live Flight Search conversation bridge tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  INTEGRATION_LIVE_FLIGHT_SEARCH_VERSION,
  buildConsultantFlightSummary,
  buildLiveCriteriaFromContext,
  conversationResultToToolData,
  getConversationFlightSearchCache,
  rankConversationFlights,
  resetConversationFlightSearchCache,
  tryConversationLiveFlightSearch,
} from '../agent/integrationFlightSearch'
import { extractFromUserText } from '../agent/extractRequirements'
import { emptyRequirements, mergeRequirements } from '../agent'
import { createFlightSearchEngine, resetDefaultFlightSearchEngine } from '../agent/flightSearchEngine'
import { runConversationAwareFlightSearch } from '../agent/integrationFlightSearch'
import { runFlightSearchTool } from '../agent/tools/searchEngineBridge'
import { resetDefaultProviderRuntimeRegistry } from '../agent/providerRuntime'
import type { AgentToolContext } from '../agent/tools/types'
import type { LiveFlightSearchResult } from '../agent/liveFlightSearch'
import { LIVE_FLIGHT_SEARCH_FEATURE_ID } from '../agent/liveFlightSearch'

function ctx(partial?: {
  requirements?: Partial<ReturnType<typeof emptyRequirements>>
  input?: Record<string, unknown>
  locale?: 'ar' | 'en'
}): AgentToolContext {
  const requirements = mergeRequirements(emptyRequirements(), {
    origin: 'Riyadh',
    destination: 'Morocco',
    destinations: ['Morocco'],
    startDate: '2026-08-01',
    travelers: 2,
    budgetCurrency: 'SAR',
    ...partial?.requirements,
  })
  return {
    locale: partial?.locale ?? 'ar',
    requirements,
    input: partial?.input ?? {},
  } as AgentToolContext
}

function liveOk(overrides?: Partial<LiveFlightSearchResult>): LiveFlightSearchResult {
  return {
    version: '1.0.0-live-flight-search',
    enabled: true,
    ok: true,
    empty: false,
    flights: [
      {
        id: 'amd_1',
        providerId: 'amadeus',
        airline: 'SV',
        carrierCode: 'SV',
        price: 1200,
        currency: 'SAR',
        durationMinutes: 360,
        stops: 0,
        cabin: 'economy',
        origin: 'RUH',
        destination: 'CMN',
        departureAt: '2026-08-01T08:00:00Z',
        arrivalAt: '2026-08-01T14:00:00Z',
        refundable: true,
        seatsRemaining: 4,
        providerConfidence: 0.95,
        availability: 'available',
        title: 'SV RUH→CMN',
      },
      {
        id: 'amd_2',
        providerId: 'amadeus',
        airline: 'AT',
        carrierCode: 'AT',
        price: 980,
        currency: 'SAR',
        durationMinutes: 420,
        stops: 1,
        cabin: 'economy',
        origin: 'RUH',
        destination: 'CMN',
        departureAt: '2026-08-01T19:00:00Z',
        arrivalAt: '2026-08-02T02:00:00Z',
        refundable: false,
        seatsRemaining: 2,
        providerConfidence: 0.9,
        availability: 'available',
        title: 'AT RUH→CMN',
      },
    ],
    flightOffers: [],
    latencyMs: 42,
    attempts: 1,
    error: null,
    validationErrors: [],
    logs: [],
    meta: {
      origin: 'RUH',
      destination: 'CMN',
      departureDate: '2026-08-01',
      adults: 2,
      children: 0,
      currency: 'SAR',
      providerId: 'amadeus',
      maxResults: 20,
      nonStop: false,
    },
    ...overrides,
  }
}

describe('Integration Sprint 2 — Live Flight Search', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetConversationFlightSearchCache()
    resetDefaultProviderRuntimeRegistry()
    resetDefaultFlightSearchEngine()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetConversationFlightSearchCache()
    resetDefaultProviderRuntimeRegistry()
    resetDefaultFlightSearchEngine()
    vi.restoreAllMocks()
  })

  it('keeps live flight search flag OFF by default', () => {
    expect(getFeatureRegistry().isEnabled(LIVE_FLIGHT_SEARCH_FEATURE_ID)).toBe(false)
    expect(INTEGRATION_LIVE_FLIGHT_SEARCH_VERSION).toMatch(/integration-flight/)
  })

  it('returns null from bridge when flag is OFF (no behavior change)', async () => {
    const result = await tryConversationLiveFlightSearch(ctx())
    expect(result).toBeNull()
  })

  it('extracts Morocco next-week intent with flexible dates', () => {
    const extracted = extractFromUserText('I want to travel to Morocco next week.')
    expect(extracted.patch.destination?.toLowerCase()).toMatch(/morocco|marrakech|casablanca/)
    expect(extracted.patch.startDate).toBeTruthy()
    expect(extracted.patch.datesFlexible).toBe(true)
  })

  it('extracts Arabic Morocco trip with cabin and airline preferences', () => {
    const extracted = extractFromUserText(
      'أبغى أسافر المغرب الأسبوع القادم درجة رجال الأعمال على الخطوط السعودية صباحاً مع طفلين',
    )
    expect(extracted.patch.destination).toBeTruthy()
    expect(extracted.patch.cabinPreference).toBe('business')
    expect(extracted.patch.preferredAirline).toBe('SV')
    expect(extracted.patch.preferredDepartureTime).toBe('morning')
    expect(extracted.patch.children).toBe(2)
    expect(extracted.patch.datesFlexible).toBe(true)
  })

  it('builds live criteria with adults, children, cabin, currency', () => {
    const criteria = buildLiveCriteriaFromContext(ctx({
      requirements: {
        origin: 'Jeddah',
        destination: 'Casablanca',
        destinations: ['Casablanca'],
        startDate: '2026-09-10',
        endDate: '2026-09-17',
        travelers: 4,
        children: 2,
        cabinPreference: 'business',
        budgetCurrency: 'SAR',
      },
    }))
    expect(criteria.origin).toBe('JED')
    expect(criteria.destination).toBe('CMN')
    expect(criteria.adults).toBe(2)
    expect(criteria.children).toBe(2)
    expect(criteria.cabin).toBe('business')
    expect(criteria.currency).toBe('SAR')
    expect(criteria.returnDate).toBe('2026-09-17')
  })

  it('ranks flights with WHY explanations (price, stops, convenience)', () => {
    const ranked = rankConversationFlights([
      {
        id: '1',
        providerId: 'amadeus',
        airline: 'SV',
        origin: 'RUH',
        destination: 'CMN',
        departureAt: '2026-08-01T08:00:00Z',
        arrivalAt: '2026-08-01T14:00:00Z',
        durationMinutes: 360,
        stops: 0,
        cabin: 'economy',
        price: 1200,
        currency: 'SAR',
        baggage: '1 PC',
        refundable: true,
      },
      {
        id: '2',
        providerId: 'amadeus',
        airline: 'AT',
        origin: 'RUH',
        destination: 'CMN',
        departureAt: '2026-08-01T22:00:00Z',
        arrivalAt: '2026-08-02T06:00:00Z',
        durationMinutes: 480,
        stops: 2,
        cabin: 'economy',
        price: 900,
        currency: 'SAR',
        baggage: null,
        refundable: false,
      },
    ], { preferredAirline: 'SV', preferredDepartureTime: 'morning' })

    expect(ranked[0]?.airline).toBe('SV')
    expect(ranked[0]?.reasons.length).toBeGreaterThan(0)
    expect(ranked[0]?.whyEn.length).toBeGreaterThan(10)
    expect(ranked[0]?.whyAr.length).toBeGreaterThan(5)
  })

  it('builds consultant summary without raw JSON dumps', () => {
    const ranked = rankConversationFlights([
      {
        id: '1',
        providerId: 'amadeus',
        airline: 'SV',
        origin: 'RUH',
        destination: 'CMN',
        departureAt: '2026-08-01T08:00:00Z',
        arrivalAt: '2026-08-01T14:00:00Z',
        durationMinutes: 360,
        stops: 0,
        cabin: 'economy',
        price: 1200,
        currency: 'SAR',
        baggage: '1 PC',
        refundable: true,
      },
    ])
    const summary = buildConsultantFlightSummary(ranked, {
      origin: 'RUH',
      destination: 'CMN',
      departureDate: '2026-08-01',
      returnDate: null,
    })
    expect(summary.ar).toMatch(/RUH/)
    expect(summary.en).toMatch(/option/i)
    expect(summary.ar).not.toMatch(/\{"id"/)
    expect(summary.en).not.toMatch(/providerConfidence/)
  })

  it('runs live bridge with injected provider and caches duplicate searches', async () => {
    getFeatureRegistry().setEnabled(LIVE_FLIGHT_SEARCH_FEATURE_ID, true)
    const runLive = vi.fn(async () => liveOk())
    const first = await tryConversationLiveFlightSearch(ctx(), {
      enabled: true,
      runLive,
      fallbackToMock: false,
    })
    expect(first?.usedLive).toBe(true)
    expect(first?.offers.length).toBe(2)
    expect(first?.consultantSummaryAr).toBeTruthy()
    expect(runLive).toHaveBeenCalledTimes(1)

    const second = await tryConversationLiveFlightSearch(ctx(), {
      enabled: true,
      runLive,
      fallbackToMock: false,
    })
    expect(second?.cacheHit).toBe(true)
    expect(runLive).toHaveBeenCalledTimes(1)
    expect(getConversationFlightSearchCache().stats().hits).toBeGreaterThanOrEqual(1)
  })

  it('falls back to mock engine when live provider fails', async () => {
    getFeatureRegistry().setEnabled(LIVE_FLIGHT_SEARCH_FEATURE_ID, true)
    const runLive = vi.fn(async () => liveOk({
      ok: false,
      empty: true,
      flights: [],
      error: {
        code: 'PROVIDER_UNAVAILABLE',
        message: 'upstream down',
        retryable: true,
        rateLimited: false,
        timedOut: false,
        httpStatus: 503,
      },
    }))
    const engine = createFlightSearchEngine({ forceMock: true })
    const result = await tryConversationLiveFlightSearch(ctx(), {
      enabled: true,
      runLive,
      engine,
      fallbackToMock: true,
    })
    expect(result).toBeTruthy()
    expect(result!.usedLive).toBe(false)
    expect(result!.offers.length).toBeGreaterThan(0)
  })

  it('runFlightSearchTool stays on mock path when flag OFF', async () => {
    const engine = createFlightSearchEngine({ forceMock: true })
    const { data, empty } = await runFlightSearchTool(engine, ctx({
      requirements: {
        origin: 'Riyadh',
        destination: 'Dubai',
        destinations: ['Dubai'],
        startDate: '2026-08-01',
        travelers: 2,
      },
    }))
    expect(empty).toBe(false)
    expect(data.searchEngine).toBe('flightSearchEngine')
    expect(Array.isArray(data.offers)).toBe(true)
  })

  it('runConversationAwareFlightSearch uses live bridge when flag ON', async () => {
    getFeatureRegistry().setEnabled(LIVE_FLIGHT_SEARCH_FEATURE_ID, true)
    const engine = createFlightSearchEngine({ forceMock: true })
    const { data, empty } = await runConversationAwareFlightSearch(engine, ctx({
      requirements: {
        origin: 'Riyadh',
        destination: 'Casablanca',
        destinations: ['Casablanca'],
        startDate: '2026-08-01',
        endDate: '2026-08-08',
        travelers: 2,
        children: 0,
        cabinPreference: 'economy',
      },
    }), {
      runLive: async () => liveOk(),
      fallbackToMock: false,
    })
    expect(empty).toBe(false)
    expect(data.searchEngine).toBe('liveFlightSearch')
    expect(data.consultantSummaryAr).toBeTruthy()
    expect(Array.isArray(data.offers)).toBe(true)
  })

  it('conversationResultToToolData includes ranking WHY fields', () => {
    const ranked = rankConversationFlights([
      {
        id: '1',
        providerId: 'amadeus',
        airline: 'SV',
        origin: 'RUH',
        destination: 'CMN',
        departureAt: '2026-08-01T08:00:00Z',
        arrivalAt: '2026-08-01T14:00:00Z',
        durationMinutes: 360,
        stops: 0,
        cabin: 'economy',
        price: 1200,
        currency: 'SAR',
        baggage: '1 PC',
        refundable: true,
      },
    ])
    const summary = buildConsultantFlightSummary(ranked, {
      origin: 'RUH',
      destination: 'CMN',
      departureDate: '2026-08-01',
      returnDate: null,
    })
    const toolData = conversationResultToToolData({
      version: INTEGRATION_LIVE_FLIGHT_SEARCH_VERSION,
      usedLive: true,
      cacheHit: false,
      empty: false,
      offers: ranked,
      highlights: { best: 'SV', cheapest: 'SV', fastest: 'SV' },
      consultantSummaryAr: summary.ar,
      consultantSummaryEn: summary.en,
      diagnostics: {
        providerId: 'amadeus',
        latencyMs: 10,
        adults: 2,
        children: 0,
        cabin: 'economy',
        currency: 'SAR',
        origin: 'RUH',
        destination: 'CMN',
        departureDate: '2026-08-01',
        returnDate: null,
        timezone: 'Asia/Riyadh',
      },
    }, 2)
    const offer = (toolData.offers as Array<Record<string, unknown>>)[0]!
    expect(offer.whyAr).toBeTruthy()
    expect(offer.reasons).toBeTruthy()
    expect(toolData.usedLive).toBe(true)
  })

  it('Flight Search Engine cacheHit becomes true on duplicate query', async () => {
    const engine = createFlightSearchEngine({ forceMock: true })
    const req = {
      origin: 'RUH',
      destination: 'DXB',
      departureDate: '2026-09-01',
      adults: 1,
      children: 0,
      cabin: 'economy' as const,
      currency: 'SAR',
    }
    const first = await engine.searchFlights(req)
    const second = await engine.searchFlights(req)
    expect(first.diagnostics.cacheHit).toBe(false)
    expect(second.diagnostics.cacheHit).toBe(true)
  })
})
