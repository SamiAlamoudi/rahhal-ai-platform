import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createAmadeusProviderAdapter,
  createAggregationEngine,
  createProviderRegistry,
  createMockAmadeusAdapter,
  resolveAmadeusProviderConfig,
  isAmadeusConfigured,
  resolveAmadeusEnvironment,
  PRODUCTION_HOST,
  SANDBOX_HOST,
  flightOffersToNormalizedOffers,
} from '../agent/aggregation'
import type { NormalizedFlightOffer } from '../../integrations/providers/amadeus/flightNormalization'
import { createTravelAgentService } from '../agent/travelAgentService'
import { createMockAgentToolRegistry } from '../agent/tools/stubs'
import { COMPLETE_JAPAN_5D } from './agentTestFixtures'
import type { ChatMessage } from '../chat/chatTypes'

function user(content: string): ChatMessage {
  return {
    id: `u-${Math.random().toString(36).slice(2, 7)}`,
    conversationId: 'c1',
    role: 'user',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  }
}

describe('Phase N Amadeus flight ProviderAdapter', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('resolves sandbox vs production from AMADEUS_BASE_URL', () => {
    expect(resolveAmadeusEnvironment(SANDBOX_HOST)).toBe('sandbox')
    expect(resolveAmadeusEnvironment(PRODUCTION_HOST)).toBe('production')
    expect(resolveAmadeusEnvironment('https://test.api.amadeus.com/v1')).toBe('sandbox')
  })

  it('is unavailable without credentials or token proxy', () => {
    const config = resolveAmadeusProviderConfig({
      enabled: true,
      clientId: null,
      clientSecret: null,
      tokenUrl: null,
      invokeApiKey: null,
    })
    expect(isAmadeusConfigured(config)).toBe(false)
    const adapter = createAmadeusProviderAdapter({ config })
    expect(adapter.isAvailable()).toBe(false)
    expect(adapter.metadata.id).toBe('amadeus')
    expect(adapter.metadata.mocked).toBe(false)
  })

  it('becomes available with AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET', () => {
    const adapter = createAmadeusProviderAdapter({
      config: {
        enabled: true,
        clientId: 'test-client',
        clientSecret: 'test-secret',
        baseUrl: SANDBOX_HOST,
      },
    })
    expect(adapter.isAvailable()).toBe(true)
    expect(adapter.getCapabilities().features).toEqual(expect.arrayContaining([
      'oauth',
      'token_refresh',
      'client_credentials',
      'sandbox',
    ]))
  })

  it('normalizes flight offers into canonical agent payload (no Amadeus types)', () => {
    const offers = [{
      id: 'OFF1',
      providerId: 'amadeus',
      title: 'Saudi SW123',
      currency: 'USD',
      price: 720,
      originalPrice: null,
      rating: 4.2,
      itinerary: {
        segments: [
          {
            origin: 'RUH',
            destination: 'HND',
            departure: '2027-04-01T08:00:00',
            arrival: '2027-04-01T22:00:00',
            carrier: 'Saudi',
            flightNumber: 'SV123',
            aircraft: null,
            cabin: 'economy',
            durationMinutes: 600,
          },
        ],
        totalDuration: 600,
        stops: 0,
        refundable: false,
        baggageIncluded: true,
      },
      familyFriendly: true,
      cancellationPolicy: 'non-refundable',
      bookingClass: 'Y',
      travelTimeScore: 80,
      overallFlightQuality: 85,
    }] as NormalizedFlightOffer[]

    const normalized = flightOffersToNormalizedOffers(offers, 'amadeus')
    expect(normalized).toHaveLength(1)
    expect(normalized[0].domain).toBe('flights')
    expect(normalized[0].payload).toMatchObject({
      airline: 'Saudi',
      from: 'RUH',
      to: 'HND',
      stops: 0,
      price: 720,
      currency: 'USD',
      source: 'amadeus',
    })
    expect(JSON.stringify(normalized[0])).not.toMatch(/itineraries|validatingAirlineCodes|travelerPricings/)
  })

  it('falls back from Amadeus to mock flights when Amadeus fails', async () => {
    const amadeus = createAmadeusProviderAdapter({
      config: {
        enabled: true,
        clientId: 'id',
        clientSecret: 'secret',
        baseUrl: SANDBOX_HOST,
      },
      deps: {
        async search() {
          return {
            providerId: 'amadeus',
            status: 'error',
            items: [],
            error: 'upstream_down',
            errorCode: 'upstream_error',
            durationMs: 5,
          }
        },
      },
    })
    const registry = createProviderRegistry([
      amadeus,
      createMockAmadeusAdapter(),
    ])
    const engine = createAggregationEngine({
      registry,
      selectionStrategy: 'priority_fallback',
      retryPolicy: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
    })

    const result = await engine.aggregate({
      domain: 'flights',
      locale: 'en',
      input: { origin: 'RUH', destination: 'Japan', travelers: 2, currency: 'USD' },
      selectionStrategy: 'priority_fallback',
    })

    expect(result.meta.fallbacksUsed).toBeGreaterThanOrEqual(1)
    expect(result.meta.providersSucceeded).toBe(1)
    expect(result.providerResults.some((p) => p.providerId === 'amadeus' && p.status === 'error')).toBe(true)
    expect(result.providerResults.some((p) => p.providerId === 'amadeus_mock' && p.status === 'ok')).toBe(true)
    expect(result.items[0]?.payload).toMatchObject({
      airline: expect.any(String),
      from: expect.any(String),
      to: expect.any(String),
    })
  })

  it('uses Amadeus results when the real adapter succeeds', async () => {
    const amadeus = createAmadeusProviderAdapter({
      config: {
        enabled: true,
        clientId: 'id',
        clientSecret: 'secret',
      },
      deps: {
        async search() {
          return {
            providerId: 'amadeus',
            status: 'ok',
            items: flightOffersToNormalizedOffers([{
              id: 'LIVE1',
              providerId: 'amadeus',
              title: 'Live Air',
              currency: 'USD',
              price: 640,
              originalPrice: null,
              rating: 4,
              itinerary: {
                segments: [{
                  origin: 'RUH',
                  destination: 'HND',
                  departure: '2027-04-01T10:00:00',
                  arrival: '2027-04-01T23:00:00',
                  carrier: 'Live Air',
                  flightNumber: 'LA1',
                  aircraft: null,
                  cabin: 'economy',
                  durationMinutes: 700,
                }],
                totalDuration: 700,
                stops: 0,
                refundable: false,
                baggageIncluded: true,
              },
              familyFriendly: true,
              cancellationPolicy: null,
              bookingClass: 'Y',
              travelTimeScore: 70,
              overallFlightQuality: 75,
            }], 'amadeus'),
            durationMs: 12,
          }
        },
      },
    })
    const registry = createProviderRegistry([amadeus, createMockAmadeusAdapter()])
    const engine = createAggregationEngine({
      registry,
      selectionStrategy: 'priority_fallback',
    })
    const result = await engine.aggregate({
      domain: 'flights',
      locale: 'en',
      input: { origin: 'RUH', destination: 'Japan', travelers: 2, currency: 'USD' },
    })
    expect(result.meta.providersSucceeded).toBe(1)
    expect(result.providerResults).toHaveLength(1)
    expect(result.items[0]?.payload.airline).toBe('Live Air')
    expect(result.items[0]?.providerId).toBe('amadeus')
  })

  it('handles rate-limit responses from Amadeus', async () => {
    const amadeus = createAmadeusProviderAdapter({
      config: { enabled: true, clientId: 'id', clientSecret: 'secret' },
      deps: {
        async search() {
          return {
            providerId: 'amadeus',
            status: 'rate_limited',
            items: [],
            error: 'rate_limited',
            errorCode: 'rate_limited',
            retryAfterMs: 1000,
            durationMs: 3,
          }
        },
      },
    })
    const result = await amadeus.fetch({
      domain: 'flights',
      locale: 'en',
      input: { destination: 'Japan' },
    })
    expect(result.status).toBe('rate_limited')
    expect(result.errorCode).toBe('rate_limited')
  })

  it('keeps TravelAgentService provider-blind while still merging flight offers', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
    })
    const turn = await service.planTurn({
      conversationId: 'c1',
      messages: [user(COMPLETE_JAPAN_5D)],
    })
    expect(turn.tripPlan?.flights.length).toBeGreaterThan(0)
    expect(turn.toolBatch?.selected).toContain('flights')
    // Agent never receives Amadeus class names on the tool surface.
    expect(JSON.stringify(turn.meta)).not.toMatch(/AmadeusFlightOffer|AmadeusOAuthClient/)
  })
})
