/**
 * Sprint 80 P1-3 — Conversational Provider Unification unit tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  CONVERSATIONAL_PROVIDER_UNIFY_FEATURE_ID,
  CONVERSATIONAL_PROVIDER_UNIFY_VERSION,
  ConversationalProviderError,
  classifyConversationalProviderFailure,
  conversationalRequestFingerprint,
  createConversationalProviderRegistry,
  createLiveFlightConversationalProvider,
  createMockFlightConversationalProvider,
  createMockHotelConversationalProvider,
  filterAvailableProviders,
  isConversationalProviderUnifyEnabled,
  isRetryableConversationalProviderCode,
  mapConversationalProviderRequest,
  normalizeToolSearchResultToOffers,
  normalizeToUnifiedSearchResult,
  resolveConversationalProviders,
  runConversationalProviderSearch,
  runUnifiedConversationFlightSearch,
  runUnifiedConversationHotelSearch,
  shouldUseConversationalProviderUnify,
  type ConversationalTravelProvider,
  type UnifiedProviderRequest,
  type UnifiedProviderSearchResult,
} from '../agent/conversationalProvider'
import { runConversationAwareFlightSearch } from '../agent/integrationFlightSearch'
import { runConversationAwareHotelSearch } from '../agent/integrationHotelSearch'
import { createFlightSearchEngine, resetDefaultFlightSearchEngine } from '../agent/flightSearchEngine'
import { createHotelSearchEngine, resetDefaultHotelSearchEngine } from '../agent/hotelSearchEngine'
import { resetDefaultProviderRuntimeRegistry } from '../agent/providerRuntime'
import { emptyRequirements, mergeRequirements } from '../agent'
import type { AgentToolContext } from '../agent/tools/types'

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
    durationDays: 5,
    ...partial?.requirements,
  })
  return {
    locale: partial?.locale ?? 'ar',
    requirements,
    input: partial?.input ?? {},
  } as AgentToolContext
}

describe('Sprint 80 P1-3 — Conversational Provider Unification', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetDefaultProviderRuntimeRegistry()
    resetDefaultFlightSearchEngine()
    resetDefaultHotelSearchEngine()
  })

  afterEach(() => {
    resetFeatureRegistry()
    vi.restoreAllMocks()
  })

  describe('feature flag (default OFF)', () => {
    it('registers ai.conversational_provider_unify as OFF', () => {
      expect(CONVERSATIONAL_PROVIDER_UNIFY_FEATURE_ID).toBe('ai.conversational_provider_unify')
      expect(getFeatureRegistry().isEnabled(CONVERSATIONAL_PROVIDER_UNIFY_FEATURE_ID)).toBe(false)
      expect(isConversationalProviderUnifyEnabled()).toBe(false)
      expect(shouldUseConversationalProviderUnify()).toBe(false)
    })

    it('allows test override without mutating registry', () => {
      expect(isConversationalProviderUnifyEnabled({ enabled: true })).toBe(true)
      expect(isConversationalProviderUnifyEnabled()).toBe(false)
    })

    it('exports a stable unify version', () => {
      expect(CONVERSATIONAL_PROVIDER_UNIFY_VERSION).toMatch(/conversational-provider-unify/)
    })
  })

  describe('errors', () => {
    it('classifies search_blocked_* as INVALID_REQUEST (non-retryable)', () => {
      const err = classifyConversationalProviderFailure(
        'mock-flights',
        new Error('search_blocked_origin_unconfirmed'),
      )
      expect(err).toBeInstanceOf(ConversationalProviderError)
      expect(err.code).toBe('INVALID_REQUEST')
      expect(err.retryable).toBe(false)
    })

    it('classifies timeouts and rate limits as retryable', () => {
      expect(classifyConversationalProviderFailure('mock-flights', new Error('Timeout')).code).toBe(
        'TIMEOUT',
      )
      expect(
        classifyConversationalProviderFailure('mock-flights', new Error('429 rate limit')).code,
      ).toBe('RATE_LIMITED')
      expect(isRetryableConversationalProviderCode('TIMEOUT')).toBe(true)
      expect(isRetryableConversationalProviderCode('INVALID_REQUEST')).toBe(false)
    })
  })

  describe('request mapper', () => {
    it('maps flight context into UnifiedProviderRequest via engine builder', () => {
      const request = mapConversationalProviderRequest({ domain: 'flights', ctx: ctx() })
      expect(request.domain).toBe('flights')
      expect(request.adults).toBe(2)
      expect(request.currency).toBe('SAR')
      expect(String(request.criteria.origin ?? '')).toBeTruthy()
      expect(String(request.criteria.destination ?? '')).toBeTruthy()
      expect(conversationalRequestFingerprint(request)).toContain('flights')
    })

    it('maps hotel context into UnifiedProviderRequest', () => {
      const request = mapConversationalProviderRequest({ domain: 'hotels', ctx: ctx() })
      expect(request.domain).toBe('hotels')
      expect(request.criteria).toBeTruthy()
    })

    it('throws ConversationalProviderError for incomplete flight criteria', () => {
      const incomplete = ctx({
        requirements: { origin: null, destination: 'Morocco', travelers: 2 },
      })
      expect(() =>
        mapConversationalProviderRequest({ domain: 'flights', ctx: incomplete }),
      ).toThrow(ConversationalProviderError)
    })

    it('accepts future domains as opaque criteria', () => {
      const request = mapConversationalProviderRequest({
        domain: 'cars',
        ctx: ctx({ input: { pickup: 'RUH' } }),
      })
      expect(request.domain).toBe('cars')
      expect(request.criteria.pickup).toBe('RUH')
    })
  })

  describe('response normalizer', () => {
    it('normalizes flight tool offers', () => {
      const offers = normalizeToolSearchResultToOffers('flights', 'mock-flights', {
        data: {
          offers: [
            {
              id: 'f1',
              airline: 'SV',
              from: 'RUH',
              to: 'CMN',
              price: 1200,
              currency: 'SAR',
              score: 0.9,
            },
          ],
        },
        empty: false,
      })
      expect(offers).toHaveLength(1)
      expect(offers[0]?.domain).toBe('flights')
      expect(offers[0]?.title).toContain('SV')
      expect(offers[0]?.price).toBe(1200)
    })

    it('normalizes hotel stays and attaches unify metadata', () => {
      const result = normalizeToUnifiedSearchResult({
        domain: 'hotels',
        providerId: 'mock-hotels',
        mode: 'mock',
        tool: {
          data: {
            stays: [{ hotelId: 'h1', name: 'Riad', nightly: 400, currency: 'SAR' }],
          },
          empty: false,
        },
        latencyMs: 12,
        ok: true,
      })
      expect(result.offers).toHaveLength(1)
      expect(result.toolData.conversationalProvider).toMatchObject({
        providerId: 'mock-hotels',
        domain: 'hotels',
      })
    })
  })

  describe('registry + resolver', () => {
    it('registers providers and rejects duplicates', () => {
      const provider = createMockFlightConversationalProvider({
        engine: createFlightSearchEngine({ forceMock: true }),
        getContext: () => ctx(),
      })
      const registry = createConversationalProviderRegistry([provider])
      expect(registry.size()).toBe(1)
      expect(registry.ids('flights')).toEqual(['mock-flights'])
      expect(() => registry.register(provider)).toThrow(/already registered/)
    })

    it('orders live before mock when live flag is preferred', async () => {
      const engine = createFlightSearchEngine({ forceMock: true })
      const getContext = () => ctx()
      const registry = createConversationalProviderRegistry([
        createMockFlightConversationalProvider({ engine, getContext }),
        createLiveFlightConversationalProvider({
          engine,
          getContext,
          liveEnabled: true,
        }),
      ])
      const resolved = resolveConversationalProviders({
        domain: 'flights',
        registry,
        liveFlightEnabled: true,
      })
      expect(resolved.preferLive).toBe(true)
      expect(resolved.providers[0]?.providerId).toBe('live-flights')

      const available = await filterAvailableProviders(resolved.providers, { enabled: true })
      expect(available.map((p) => p.providerId)).toContain('live-flights')
    })

    it('prefers mock when live flags are OFF', () => {
      const engine = createFlightSearchEngine({ forceMock: true })
      const getContext = () => ctx()
      const registry = createConversationalProviderRegistry([
        createMockFlightConversationalProvider({ engine, getContext }),
        createLiveFlightConversationalProvider({
          engine,
          getContext,
          liveEnabled: false,
        }),
      ])
      const resolved = resolveConversationalProviders({
        domain: 'flights',
        registry,
        liveFlightEnabled: false,
      })
      expect(resolved.preferLive).toBe(false)
      expect(resolved.providers[0]?.providerId).toBe('mock-flights')
    })
  })

  describe('search orchestrator (flag ON via deps)', () => {
    it('returns mock flight offers with tool-compatible shape', async () => {
      const engine = createFlightSearchEngine({ forceMock: true })
      const result = await runConversationalProviderSearch({
        domain: 'flights',
        ctx: ctx(),
        flightEngine: engine,
        liveFlightEnabled: false,
      })
      expect(result.ok).toBe(true)
      expect(result.domain).toBe('flights')
      expect(result.providerId).toBe('mock-flights')
      expect(result.mode).toBe('mock')
      expect(Array.isArray(result.toolData.offers)).toBe(true)
      expect((result.toolData.offers as unknown[]).length).toBeGreaterThan(0)
      expect(result.empty).toBe(false)
    })

    it('returns mock hotel stays with tool-compatible shape', async () => {
      const engine = createHotelSearchEngine({ forceMock: true })
      const result = await runConversationalProviderSearch({
        domain: 'hotels',
        ctx: ctx(),
        hotelEngine: engine,
        liveHotelEnabled: false,
      })
      expect(result.ok).toBe(true)
      expect(result.providerId).toBe('mock-hotels')
      expect(Array.isArray(result.toolData.stays)).toBe(true)
      expect((result.toolData.stays as unknown[]).length).toBeGreaterThan(0)
    })

    it('failovers to mock when primary provider fails retryably', async () => {
      const engine = createFlightSearchEngine({ forceMock: true })
      const getContext = () => ctx()
      const failing: ConversationalTravelProvider = {
        providerId: 'live-flights',
        domain: 'flights',
        displayName: 'Failing live',
        capabilities: () => ({ domain: 'flights', search: true, live: true }),
        isAvailable: () => true,
        async search(_request: UnifiedProviderRequest): Promise<UnifiedProviderSearchResult> {
          return {
            ok: false,
            domain: 'flights',
            providerId: 'live-flights',
            mode: 'live',
            offers: [],
            empty: true,
            latencyMs: 1,
            toolData: { offers: [] },
            error: 'network down',
            errorCode: 'NETWORK_FAILURE',
          }
        },
      }
      const registry = createConversationalProviderRegistry([
        failing,
        createMockFlightConversationalProvider({ engine, getContext }),
      ])
      const result = await runConversationalProviderSearch({
        domain: 'flights',
        ctx: ctx(),
        flightEngine: engine,
        registry,
        liveFlightEnabled: true,
      })
      expect(result.ok).toBe(true)
      expect(result.providerId).toBe('mock-flights')
    })
  })

  describe('toolBridge wiring (behavior preservation)', () => {
    it('keeps legacy path when unify flag is OFF (default)', async () => {
      const engine = createFlightSearchEngine({ forceMock: true })
      const legacy = await runConversationAwareFlightSearch(engine, ctx())
      expect(legacy.empty).toBe(false)
      expect(Array.isArray(legacy.data.offers)).toBe(true)
      expect(legacy.data.conversationalProvider).toBeUndefined()
    })

    it('uses unify layer when unifyEnabled override is true', async () => {
      const engine = createFlightSearchEngine({ forceMock: true })
      const unified = await runConversationAwareFlightSearch(engine, ctx(), {
        unifyEnabled: true,
        enabled: false,
      })
      expect(unified.empty).toBe(false)
      expect(Array.isArray(unified.data.offers)).toBe(true)
      expect(unified.data.conversationalProvider).toMatchObject({
        providerId: 'mock-flights',
        domain: 'flights',
      })
    })

    it('hotel bridge: legacy OFF vs unify ON', async () => {
      const engine = createHotelSearchEngine({ forceMock: true })
      const legacy = await runConversationAwareHotelSearch(engine, ctx())
      expect(legacy.data.conversationalProvider).toBeUndefined()

      const unified = await runConversationAwareHotelSearch(engine, ctx(), {
        unifyEnabled: true,
        enabled: false,
      })
      expect(unified.data.conversationalProvider).toMatchObject({
        providerId: 'mock-hotels',
      })
      expect(Array.isArray(unified.data.stays)).toBe(true)
    })

    it('direct unify helpers produce offers/stays', async () => {
      const flights = await runUnifiedConversationFlightSearch(
        createFlightSearchEngine({ forceMock: true }),
        ctx(),
        { enabled: false },
      )
      const hotels = await runUnifiedConversationHotelSearch(
        createHotelSearchEngine({ forceMock: true }),
        ctx(),
        { enabled: false },
      )
      expect((flights.data.offers as unknown[]).length).toBeGreaterThan(0)
      expect((hotels.data.stays as unknown[]).length).toBeGreaterThan(0)
    })

    it('legacy and unify mock paths return non-empty flight inventory', async () => {
      const engine = createFlightSearchEngine({ forceMock: true })
      const legacy = await runConversationAwareFlightSearch(engine, ctx())
      const unified = await runConversationAwareFlightSearch(engine, ctx(), {
        unifyEnabled: true,
      })
      expect((legacy.data.offers as unknown[]).length).toBeGreaterThan(0)
      expect((unified.data.offers as unknown[]).length).toBeGreaterThan(0)
    })
  })

  describe('hotel mock adapter', () => {
    it('exposes hotel capabilities', () => {
      const provider = createMockHotelConversationalProvider({
        engine: createHotelSearchEngine({ forceMock: true }),
        getContext: () => ctx(),
      })
      expect(provider.capabilities()).toEqual({
        domain: 'hotels',
        search: true,
        live: false,
      })
    })
  })
})
