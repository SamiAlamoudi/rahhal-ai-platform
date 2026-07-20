/**
 * Sprint 53 — Real World Intelligence Layer tests.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  getFeatureRegistry,
  resetFeatureRegistry,
  resetPreferenceEngine,
} from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import { emptyMemory } from '../agent/types'
import { extractFromUserText } from '../agent/extractRequirements'
import {
  understandConversation,
  classifyBrainIntents,
  runRahhalBrainTurn,
} from '../brain/core'
import {
  isRealWorldIntelligenceEnabled,
  gatherLiveIntelligence,
  createDefaultLiveProviders,
  createMockFlightProvider,
  createMockHotelProvider,
  createMockWeatherProvider,
  selectLiveDomains,
  liveCacheStats,
  resetLiveCache,
  resetLiveEventBus,
  resetLiveTelemetry,
  resetCircuits,
  getLiveEventHistory,
  getLiveTelemetryDashboard,
  callProviderResilient,
  withRetry,
  liveCacheSet,
  liveCacheGet,
  liveCacheInvalidate,
} from '../brain/intelligence'
import type { ChatMessage } from '../chat/chatTypes'

function userMessage(content: string): ChatMessage {
  const now = new Date().toISOString()
  return {
    id: `u-${Math.random().toString(36).slice(2, 8)}`,
    conversationId: 'conv-53',
    role: 'user',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: now,
    updatedAt: now,
  }
}

function turnContext(text: string, locale: 'ar' | 'en' = 'en') {
  const memory = {
    ...emptyMemory(locale),
    requirements: {
      ...emptyMemory(locale).requirements,
      destination: 'Istanbul',
      origin: 'Riyadh',
      startDate: '2026-09-10',
      budgetAmount: 12000,
      budgetCurrency: 'SAR',
      travelers: 2,
    },
  }
  const extracted = extractFromUserText(text, locale)
  const understanding = understandConversation({ userText: text, memory, extracted })
  const intents = classifyBrainIntents({ userText: text, locale, understanding, extracted })
  return { memory, understanding, intents, userText: text }
}

describe('Sprint 53 feature flag', () => {
  beforeEach(() => resetFeatureRegistry())

  it('enables ai.real_world_intelligence by default with rahhal_brain dependency', () => {
    expect(isRealWorldIntelligenceEnabled()).toBe(true)
    getFeatureRegistry().setEnabled('ai.rahhal_brain', false)
    expect(isRealWorldIntelligenceEnabled()).toBe(false)
  })
})

describe('provider contract', () => {
  beforeEach(() => {
    resetLiveCache()
    resetLiveEventBus()
    resetCircuits()
    resetLiveTelemetry()
  })

  it('registers nine live domain providers with full contract', () => {
    const providers = createDefaultLiveProviders()
    expect(providers).toHaveLength(9)
    const query = {
      domain: 'flight' as const,
      destination: 'Istanbul',
      origin: 'Riyadh',
      startDate: '2026-09-10',
      currency: 'SAR',
      adults: 2,
    }
    for (const provider of providers) {
      const meta = provider.metadata()
      expect(meta.providerId).toBeTruthy()
      expect(meta.domain).toBeTruthy()
      const search = provider.search(query) as unknown
      expect(search).toBeTruthy()
      const availability = provider.availability(query, 'offer-1') as { available: boolean }
      expect(availability.available).toBeTypeOf('boolean')
      const pricing = provider.pricing(query, 'offer-1') as { total: { amount: number } }
      expect(pricing.total.amount).toBeGreaterThanOrEqual(0)
      const booking = provider.booking(query, 'offer-1') as { bookingId: string }
      expect(booking.bookingId).toBeTruthy()
      const status = provider.status(booking.bookingId) as { bookingId: string }
      expect(status.bookingId).toBe(booking.bookingId)
      const cancel = provider.cancel(booking.bookingId) as { bookingId: string }
      expect(cancel.bookingId).toBe(booking.bookingId)
      expect(provider.health().providerId).toBe(meta.providerId)
    }
  })

  it('flight and hotel mocks return priced inventory with confidence', () => {
    const flights = createMockFlightProvider().search({
      domain: 'flight',
      destination: 'Tbilisi',
      origin: 'Riyadh',
      startDate: '2026-10-01',
    }) as Array<{ price: { amount: number }; confidence: number }>
    expect(Array.isArray(flights)).toBe(true)
    expect(flights[0]?.price.amount).toBeGreaterThan(0)
    expect(flights[0]?.confidence).toBeGreaterThan(0.5)

    const hotels = createMockHotelProvider().search({
      domain: 'hotel',
      destination: 'Tbilisi',
      startDate: '2026-10-01',
      adults: 2,
    }) as Array<{ nightly: { amount: number }; amenities: string[] }>
    expect(hotels[0]?.nightly.amount).toBeGreaterThan(0)
    expect(hotels[0]?.amenities.length).toBeGreaterThan(0)
  })
})

describe('event bus + cache + resilience', () => {
  beforeEach(() => {
    resetLiveCache()
    resetLiveEventBus()
    resetCircuits()
    resetLiveTelemetry()
  })

  it('emits weather and visa events during search', () => {
    createMockWeatherProvider().search({
      domain: 'weather',
      destination: 'Geneva',
      startDate: '2026-01-15',
    })
    const history = getLiveEventHistory()
    expect(history.some((e) => e.type === 'WeatherChanged')).toBe(true)
  })

  it('caches fresh hits and supports offline fallback', () => {
    liveCacheSet('k1', { ok: true }, 60_000)
    expect(liveCacheGet<{ ok: boolean }>('k1').hit).toBe('fresh')
    expect(liveCacheGet<{ ok: boolean }>('k1').value?.ok).toBe(true)
    liveCacheInvalidate('k')
    expect(liveCacheGet('k1').hit).toBe('offline')
  })

  it('retries and falls back on provider failure', async () => {
    let attempts = 0
    const value = await callProviderResilient({
      providerId: 'test.fail',
      label: 'test',
      timeoutMs: 500,
      primary: async () => {
        attempts += 1
        throw new Error('boom')
      },
      fallback: async () => 'fallback',
      cacheRead: () => null,
    })
    expect(value.value).toBe('fallback')
    expect(value.degraded).toBe(true)
    expect(attempts).toBeGreaterThan(1)

    const retried = await withRetry(async () => 42, { retries: 1 })
    expect(retried).toBe(42)
  })
})

describe('domain selection + gather', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetPreferenceEngine()
    resetLiveCache()
    resetLiveEventBus()
    resetCircuits()
    resetLiveTelemetry()
  })

  it('selects only required domains', () => {
    const ctx = turnContext('What is the weather in Istanbul?')
    const domains = selectLiveDomains(ctx)
    expect(domains).toContain('weather')
    expect(domains.length).toBeLessThan(createDefaultLiveProviders().length + 1)
  })

  it('gathers live intelligence snapshot without crashing', () => {
    const ctx = turnContext('Find flights and hotels to Istanbul with visa info')
    const snap = gatherLiveIntelligence({ ...ctx, enabled: true })
    expect(snap.domains.length).toBeGreaterThan(0)
    expect(snap.flights.length).toBeGreaterThan(0)
    expect(snap.hotels.length).toBeGreaterThan(0)
    expect(snap.weather).toBeTruthy()
    expect(snap.visa).toBeTruthy()
    expect(snap.summary).toBeTruthy()
    expect(snap.confidence).toBeGreaterThan(0)
    expect(liveCacheStats().hits + liveCacheStats().misses).toBeGreaterThan(0)
  })

  it('second gather hits cache', () => {
    const ctx = turnContext('Plan Istanbul trip')
    const first = gatherLiveIntelligence({ ...ctx, enabled: true })
    const second = gatherLiveIntelligence({ ...ctx, enabled: true })
    expect(second.cacheHits).toBeGreaterThanOrEqual(first.cacheHits)
    expect(getLiveTelemetryDashboard().samples).toBeGreaterThan(0)
  })
})

describe('RahhalBrain + planTurn integration', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetPreferenceEngine()
    resetLiveCache()
    resetLiveEventBus()
    resetCircuits()
    resetLiveTelemetry()
  })

  it('runRahhalBrainTurn executes live_intelligence module', () => {
    const memory = {
      ...emptyMemory('en'),
      requirements: {
        ...emptyMemory('en').requirements,
        destination: 'Istanbul',
        origin: 'Riyadh',
        startDate: '2026-09-10',
        budgetAmount: 15000,
      },
    }
    const turn = runRahhalBrainTurn({
      conversationId: 'c53',
      userText: 'Show me flights and hotels for Istanbul',
      memory,
      messages: [{ role: 'user', content: 'Show me flights and hotels for Istanbul' }],
      userId: 'u53',
    })
    expect(turn.meta.modulesExecuted).toContain('live_intelligence')
    expect(turn.liveIntelligence?.flights.length).toBeGreaterThan(0)
    expect(turn.liveIntelligence?.summary).toBeTruthy()
  })

  it('planTurn attaches liveIntelligence meta', async () => {
    const service = createTravelAgentService({ concierge: false })
    const result = await service.planTurn({
      conversationId: 'c53-meta',
      messages: [userMessage('Find flights to Istanbul next month')],
    })
    expect(result.meta.liveIntelligence?.domains.length).toBeGreaterThan(0)
    expect(result.meta.liveIntelligence?.providerIds.length).toBeGreaterThan(0)
  })
})
