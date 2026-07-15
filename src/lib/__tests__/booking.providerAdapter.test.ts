import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createBookingComProviderAdapter,
  createAggregationEngine,
  createProviderRegistry,
  createMockBookingComAdapter,
  createMockExpediaAdapter,
  resolveBookingComProviderConfig,
  isBookingComConfigured,
  hotelOffersToNormalizedOffers,
} from '../agent/aggregation'
import type { HotelOffer } from '../../utils/contracts/models/hotel'
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

describe('Phase O Booking.com hotel ProviderAdapter', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('is unavailable without RapidAPI key', () => {
    const config = resolveBookingComProviderConfig({
      enabled: true,
      apiKey: null,
    })
    expect(isBookingComConfigured(config)).toBe(false)
    const adapter = createBookingComProviderAdapter({ config })
    expect(adapter.isAvailable()).toBe(false)
    expect(adapter.metadata.id).toBe('booking_com')
    expect(adapter.metadata.mocked).toBe(false)
  })

  it('becomes available with RapidAPI key', () => {
    const adapter = createBookingComProviderAdapter({
      config: {
        enabled: true,
        apiKey: 'test-rapidapi-key',
      },
    })
    expect(adapter.isAvailable()).toBe(true)
    expect(adapter.getCapabilities().features).toEqual(expect.arrayContaining([
      'search',
      'stay_normalize',
      'rapidapi',
    ]))
  })

  it('normalizes hotel offers into canonical agent payload (no Booking types)', () => {
    const offers: HotelOffer[] = [{
      id: 'H1',
      providerId: 'booking_com',
      title: 'Tokyo Central Inn',
      currency: 'USD',
      price: 420,
      originalPrice: null,
      rating: 8.4,
      hotelStars: 4,
      location: 'Tokyo',
      area: 'Shinjuku',
      checkIn: '2027-04-01',
      checkOut: '2027-04-05',
      familyFriendly: true,
      breakfastIncluded: true,
      freeCancellation: false,
      amenities: ['wifi'],
      roomTypes: [],
    }]
    const normalized = hotelOffersToNormalizedOffers(offers, 'booking_com', 4)
    expect(normalized).toHaveLength(1)
    expect(normalized[0].domain).toBe('hotels')
    expect(normalized[0].payload).toMatchObject({
      name: 'Tokyo Central Inn',
      area: 'Shinjuku',
      category: 'hotel',
      nights: 4,
      currency: 'USD',
      source: 'booking',
    })
    expect(JSON.stringify(normalized[0])).not.toMatch(/product_price|hotel_class|room_data/)
  })

  it('falls back from Booking.com to mock hotels when Booking fails', async () => {
    const booking = createBookingComProviderAdapter({
      config: { enabled: true, apiKey: 'key' },
      deps: {
        async search() {
          return {
            providerId: 'booking_com',
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
      booking,
      createMockExpediaAdapter(),
      createMockBookingComAdapter(),
    ])
    const engine = createAggregationEngine({
      registry,
      selectionStrategy: 'priority_fallback',
      retryPolicy: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
    })

    const result = await engine.aggregate({
      domain: 'hotels',
      locale: 'en',
      input: { destination: 'Japan', nights: 4, currency: 'USD' },
      selectionStrategy: 'priority_fallback',
    })

    expect(result.meta.fallbacksUsed).toBeGreaterThanOrEqual(1)
    expect(result.meta.providersSucceeded).toBe(1)
    expect(result.providerResults.some((p) => p.providerId === 'booking_com' && p.status === 'error')).toBe(true)
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items[0]?.payload).toMatchObject({
      name: expect.any(String),
      area: expect.any(String),
      nightly: expect.any(Number),
    })
  })

  it('uses Booking.com results when the real adapter succeeds', async () => {
    const booking = createBookingComProviderAdapter({
      config: { enabled: true, apiKey: 'key' },
      deps: {
        async search() {
          return {
            providerId: 'booking_com',
            status: 'ok',
            items: hotelOffersToNormalizedOffers([{
              id: 'LIVE1',
              providerId: 'booking_com',
              title: 'Live Booking Stay',
              currency: 'USD',
              price: 180,
              originalPrice: null,
              rating: 9.1,
              hotelStars: 5,
              location: 'Tokyo',
              area: 'Ginza',
              checkIn: '2027-04-01',
              checkOut: '2027-04-04',
              familyFriendly: false,
              breakfastIncluded: true,
              freeCancellation: true,
              amenities: [],
              roomTypes: [],
            }], 'booking_com', 3),
            durationMs: 12,
          }
        },
      },
    })
    const registry = createProviderRegistry([
      booking,
      createMockExpediaAdapter(),
      createMockBookingComAdapter(),
    ])
    const engine = createAggregationEngine({
      registry,
      selectionStrategy: 'priority_fallback',
    })
    const result = await engine.aggregate({
      domain: 'hotels',
      locale: 'en',
      input: { destination: 'Japan', nights: 3, currency: 'USD' },
    })
    expect(result.meta.providersSucceeded).toBe(1)
    expect(result.providerResults).toHaveLength(1)
    expect(result.items[0]?.payload.name).toBe('Live Booking Stay')
    expect(result.items[0]?.providerId).toBe('booking_com')
  })

  it('handles rate-limit responses from Booking.com', async () => {
    const booking = createBookingComProviderAdapter({
      config: { enabled: true, apiKey: 'key' },
      deps: {
        async search() {
          return {
            providerId: 'booking_com',
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
    const result = await booking.fetch({
      domain: 'hotels',
      locale: 'en',
      input: { destination: 'Japan', nights: 3 },
    })
    expect(result.status).toBe('rate_limited')
    expect(result.errorCode).toBe('rate_limited')
  })

  it('keeps TravelAgentService provider-blind while still merging hotel stays', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
    })
    const turn = await service.planTurn({
      conversationId: 'c1',
      messages: [user(COMPLETE_JAPAN_5D)],
    })
    expect(turn.tripPlan?.accommodations.length).toBeGreaterThan(0)
    expect(turn.toolBatch?.selected).toContain('hotels')
    expect(JSON.stringify(turn.meta)).not.toMatch(/BookingComHotelResult|BookingComApiClient/)
  })
})
