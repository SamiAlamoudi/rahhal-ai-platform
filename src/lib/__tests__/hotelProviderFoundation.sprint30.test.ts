/**
 * Sprint 30 — Hotel Provider Foundation tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  createAggregationEngine,
  createProviderRegistry,
} from '../agent/aggregation'
import { createExecutionProviders } from '../brain/execution'
import { normalizeExecutionResults } from '../brain/search/normalize'
import {
  applyHotelMemoryPreferenceBoost,
  buildHotelCacheKey,
  createBookingConnectivityAdapter,
  createExpediaRapidAdapter,
  createFoundationHotelExecutionProvider,
  createHotelFoundationAggregationAdapters,
  createHotelProviderRegistry,
  createHotelbedsAdapter,
  createMockHotelsAdapter,
  createSandboxHotelProvider,
  hotelSearchNormalizer,
  hotelSearchRequestFromMemory,
  HotelHealthMonitor,
  HotelProviderMetrics,
  HotelRateLimiter,
  HotelSearchCache,
  isHotelProviderFoundationEnabled,
  isHotelSandboxOnly,
  resetHotelProviderFoundation,
  searchHotelsForOrchestrator,
  toAggregationHotelOffers,
  toContractHotelOffers,
  toHotelSearchPayload,
  withHotelRetry,
  type HotelSearchRequest,
  type NormalizedHotelResult,
} from '../hotels'

const SAMPLE_REQ: HotelSearchRequest = {
  destination: 'Jeddah',
  checkIn: '2026-08-10',
  checkOut: '2026-08-13',
  adults: 2,
  currency: 'SAR',
  preferredHotels: ['Hilton'],
}

describe('Sprint 30 feature flag', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetHotelProviderFoundation()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetHotelProviderFoundation()
  })

  it('registers providers.hotel_foundation disabled by default', () => {
    expect(getFeatureRegistry().isEnabled('providers.hotel_foundation')).toBe(false)
    expect(isHotelProviderFoundationEnabled()).toBe(false)
  })

  it('requires brain.execution before providers.hotel_foundation', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('providers.hotel_foundation', true)
    expect(registry.isEnabled('providers.hotel_foundation')).toBe(false)
    registry.setEnabled('ai.concierge', true)
    registry.setEnabled('brain.enabled', true)
    registry.setEnabled('brain.concierge', true)
    registry.setEnabled('brain.travel_engine', true)
    registry.setEnabled('brain.trip_planning', true)
    registry.setEnabled('brain.execution', true)
    registry.setEnabled('providers.hotel_foundation', true)
    expect(registry.isEnabled('providers.hotel_foundation')).toBe(true)
  })

  it('is sandbox-only (no production credentials)', () => {
    expect(isHotelSandboxOnly()).toBe(true)
  })
})

describe('HotelSearchNormalizer', () => {
  it('normalizes vendor payloads into unified hotel results', () => {
    const offers = hotelSearchNormalizer.normalizeMany(
      [
        {
          hotelName: 'Harbor Inn',
          currencyCode: 'SAR',
          product_price: undefined,
          price: 900,
          nights: 3,
          stars: 4,
          reviewScore: 8.6,
          reviewCount: 210,
          facilities: [{ name: 'WiFi' }, { name: 'Pool' }],
          photos: [{ url_max1080: 'https://images.example.com/a.jpg' }],
          freeCancellation: true,
          breakfastIncluded: true,
        } as never,
      ],
      {
        providerId: 'hotelbeds',
        checkIn: '2026-08-10',
        checkOut: '2026-08-13',
        nights: 3,
        sandbox: true,
      },
    )

    expect(offers).toHaveLength(1)
    const offer = offers[0]
    expect(offer.name).toBe('Harbor Inn')
    expect(offer.starRating).toBe(4)
    expect(offer.guestReviews.score).toBe(8.6)
    expect(offer.amenities).toEqual(expect.arrayContaining(['WiFi', 'Pool']))
    expect(offer.images[0]?.url).toContain('images.example.com')
    expect(offer.cancellation.freeCancellation).toBe(true)
    expect(offer.taxesAndFees.taxes).toBeGreaterThan(0)
    expect(offer.rooms.length).toBeGreaterThan(0)
    expect(offer.sandbox).toBe(true)
  })
})

describe('Sandbox adapters', () => {
  it('Hotelbeds / Expedia Rapid / Booking Connectivity return unified search results', async () => {
    for (const create of [
      createHotelbedsAdapter,
      createExpediaRapidAdapter,
      createBookingConnectivityAdapter,
    ]) {
      const provider = create()
      const caps = provider.getCapabilities()
      expect(caps.search).toBe(true)
      expect(caps.roomAvailability).toBe(true)
      expect(caps.pricing).toBe(true)
      expect(caps.cancellationPolicy).toBe(true)
      expect(caps.taxesAndFees).toBe(true)
      expect(caps.images).toBe(true)
      expect(caps.amenities).toBe(true)
      expect(caps.starRating).toBe(true)
      expect(caps.guestReviews).toBe(true)
      expect(caps.sandboxOnly).toBe(true)

      const result = await provider.searchHotels(SAMPLE_REQ)
      expect(result.success).toBe(true)
      expect(result.sandbox).toBe(true)
      expect(result.data!.length).toBeGreaterThan(0)
      expect(result.data![0].providerId).toBe(provider.metadata.id)

      const hotelId = result.data![0].id
      const rooms = await provider.getRoomAvailability({
        hotelId,
        checkIn: SAMPLE_REQ.checkIn,
        checkOut: SAMPLE_REQ.checkOut,
        adults: 2,
      })
      expect(rooms.success).toBe(true)
      expect(rooms.data!.length).toBeGreaterThan(0)

      const pricing = await provider.getPricing({
        hotelId,
        checkIn: SAMPLE_REQ.checkIn,
        checkOut: SAMPLE_REQ.checkOut,
        adults: 2,
      })
      expect(pricing.success).toBe(true)
      expect(pricing.data!.nightly).toBeGreaterThan(0)
      expect(pricing.data!.taxesAndFees.totalInclusive).toBeGreaterThan(0)

      const cancel = await provider.getCancellationPolicy(hotelId)
      expect(cancel.success).toBe(true)
      expect(cancel.data!.summary).toBeTruthy()
    }
  })
})

describe('HotelProviderRegistry failover / timeout / cache', () => {
  beforeEach(() => {
    resetHotelProviderFoundation()
  })
  afterEach(() => {
    resetHotelProviderFoundation()
  })

  it('fails over to the next provider when the primary fails', async () => {
    const failing = createBookingConnectivityAdapter({
      failWith: { code: 'upstream_error', message: 'boom', retryable: true },
    })
    const secondary = createHotelbedsAdapter()
    const registry = createHotelProviderRegistry({
      providers: [failing, secondary, createMockHotelsAdapter()],
      retryPolicy: { maxAttempts: 0, baseDelayMs: 1, maxDelayMs: 1 },
    })

    const result = await registry.search(SAMPLE_REQ, {
      providerChain: ['booking_connectivity', 'hotelbeds', 'mock_hotels'],
      bypassCache: true,
    })

    expect(result.offers.length).toBeGreaterThan(0)
    expect(result.providerId).toBe('hotelbeds')
    expect(result.fallbackCount).toBeGreaterThanOrEqual(1)
    expect(result.attempts[0]?.success).toBe(false)
    expect(result.attempts[1]?.success).toBe(true)
  })

  it('times out a slow provider and continues failover', async () => {
    const slow = createExpediaRapidAdapter({ delayMs: 80 })
    const fast = createMockHotelsAdapter()
    const registry = createHotelProviderRegistry({
      providers: [slow, fast],
      timeoutMs: 20,
      retryPolicy: { maxAttempts: 0, baseDelayMs: 1, maxDelayMs: 1 },
    })

    const result = await registry.search(SAMPLE_REQ, {
      providerChain: ['expedia_rapid', 'mock_hotels'],
      bypassCache: true,
      timeoutMs: 20,
      maxRetries: 0,
    })

    expect(result.providerId).toBe('mock_hotels')
    expect(result.attempts.some((a) => a.providerId === 'expedia_rapid' && a.errorCode === 'timeout')).toBe(true)
    expect(result.offers.length).toBeGreaterThan(0)
  })

  it('caches unified hotel results', async () => {
    const cache = new HotelSearchCache<NormalizedHotelResult[]>(60_000)
    const provider = createHotelbedsAdapter()
    const spy = vi.spyOn(provider, 'searchHotels')
    const registry = createHotelProviderRegistry({
      providers: [provider],
      cache,
    })

    const first = await registry.search(SAMPLE_REQ)
    const second = await registry.search(SAMPLE_REQ)

    expect(first.fromCache).toBe(false)
    expect(second.fromCache).toBe(true)
    expect(second.offers).toEqual(first.offers)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(buildHotelCacheKey({ destination: 'Jeddah', adults: 2 })).toContain('destination=Jeddah')
  })

  it('enforces rate limiting then fails over', async () => {
    const limiter = new HotelRateLimiter({ defaultPerMinute: 1, coolDownMs: 5_000 })
    const primary = createSandboxHotelProvider({
      metadata: {
        id: 'booking_connectivity',
        displayName: 'Booking.com Connectivity',
        priority: 95,
        reliability: 0.92,
        mode: 'sandbox',
        version: '1.0.0',
      },
      brand: 'Booking',
      rateLimitPerMinute: 1,
    })
    const fallback = createMockHotelsAdapter()
    const registry = createHotelProviderRegistry({
      providers: [primary, fallback],
      rateLimiter: limiter,
      retryPolicy: { maxAttempts: 0, baseDelayMs: 1, maxDelayMs: 1 },
    })

    // Consume the single token for booking_connectivity.
    expect(limiter.allow('booking_connectivity', 1).allowed).toBe(true)

    const result = await registry.search(SAMPLE_REQ, {
      providerChain: ['booking_connectivity', 'mock_hotels'],
      bypassCache: true,
    })

    expect(result.attempts[0]?.errorCode).toBe('rate_limited')
    expect(result.providerId).toBe('mock_hotels')
    expect(result.offers.length).toBeGreaterThan(0)
  })

  it('records health and metrics', async () => {
    const health = new HotelHealthMonitor({ degradedAfter: 1, unhealthyAfter: 2 })
    const metrics = new HotelProviderMetrics()
    const failing = createHotelbedsAdapter({
      failWith: { code: 'upstream_error', message: 'down', retryable: true },
    })
    const ok = createMockHotelsAdapter()
    const registry = createHotelProviderRegistry({
      providers: [failing, ok],
      health,
      metrics,
      retryPolicy: { maxAttempts: 0, baseDelayMs: 1, maxDelayMs: 1 },
    })

    await registry.search(SAMPLE_REQ, {
      providerChain: ['hotelbeds', 'mock_hotels'],
      bypassCache: true,
    })

    expect(health.get('hotelbeds').consecutiveFailures).toBeGreaterThanOrEqual(1)
    expect(health.get('mock_hotels').status).toBe('healthy')
    expect(metrics.get('hotelbeds').failures).toBeGreaterThanOrEqual(1)
    expect(metrics.get('mock_hotels').successes).toBeGreaterThanOrEqual(1)
  })
})

describe('Retry policy', () => {
  it('retries retryable failures with backoff', async () => {
    let attempts = 0
    const value = await withHotelRetry(
      async () => {
        attempts++
        if (attempts < 3) {
          throw Object.assign(new Error('temp'), { code: 'upstream_error' })
        }
        return 'ok'
      },
      {
        policy: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 2 },
        sleep: async () => undefined,
      },
    )
    expect(value).toBe('ok')
    expect(attempts).toBe(3)
  })
})

describe('Bridge: contracts / aggregation / execution / memory', () => {
  beforeEach(() => {
    resetHotelProviderFoundation()
  })
  afterEach(() => {
    resetHotelProviderFoundation()
  })

  it('maps to contract HotelOffer with additive enrichment', async () => {
    const result = await createHotelbedsAdapter().searchHotels(SAMPLE_REQ)
    const contracts = toContractHotelOffers(result.data!)
    expect(contracts[0].title).toBeTruthy()
    expect(contracts[0].hotelStars).toBeGreaterThan(0)
    expect(contracts[0].images?.length).toBeGreaterThan(0)
    expect(contracts[0].taxesAndFeesTotal).toBeGreaterThan(0)
    expect(contracts[0].sandbox).toBe(true)
  })

  it('maps to aggregation offers and runs Search Aggregation Engine path', async () => {
    const adapters = createHotelFoundationAggregationAdapters()
    const registry = createProviderRegistry(adapters)
    const engine = createAggregationEngine({
      registry,
      selectionStrategy: 'priority_fallback',
      retryPolicy: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
    })
    const aggregated = await engine.aggregate({
      domain: 'hotels',
      locale: 'en',
      input: {
        destination: 'Jeddah',
        startDate: '2026-08-10',
        nights: 3,
        travelers: 2,
        currency: 'SAR',
        preferredHotels: ['Hilton'],
      },
    })
    expect(aggregated.items.length).toBeGreaterThan(0)
    expect(aggregated.meta.providersSucceeded).toBeGreaterThanOrEqual(1)

    const fromBridge = toAggregationHotelOffers(
      (await createHotelbedsAdapter().searchHotels(SAMPLE_REQ)).data!,
    )
    expect(fromBridge[0].domain).toBe('hotels')
    expect(fromBridge[0].payload.amenities).toBeTruthy()
  })

  it('execution provider returns HotelSearchPayload for SearchAggregation normalize', async () => {
    const provider = createFoundationHotelExecutionProvider({
      registry: createHotelProviderRegistry({
        providers: [createBookingConnectivityAdapter()],
      }),
    })
    const payload = await provider.search({
      task: {
        id: 't1',
        type: 'hotel_search',
        priority: 1,
        dependencies: [],
        status: 'running',
        retryCount: 0,
        maxRetries: 0,
        timeoutMs: 2000,
        estimatedDurationMs: 100,
        metadata: {
          destination: 'Jeddah',
          departureCity: null,
          startDate: '2026-08-10',
          endDate: '2026-08-13',
          adults: 2,
          children: 0,
          infants: 0,
          cabinClass: null,
          budgetAmount: null,
          currency: 'SAR',
          preferredAirlines: [],
          preferredHotels: ['Hilton'],
          activities: [],
          notes: null,
          tripPlanId: 'plan-1',
          label: 'Hotels',
        },
        startedAt: null,
        finishedAt: null,
        error: null,
      },
      tripPlan: {
        id: 'plan-1',
        sessionId: 's1',
        conversationId: 'c1',
        locale: 'en',
        status: 'complete',
        destination: 'Jeddah',
        departureCity: 'Riyadh',
        travelDates: {
          startDate: '2026-08-10',
          endDate: '2026-08-13',
          durationDays: 3,
          flexible: false,
        },
        flexibility: false,
        travelerCount: 2,
        adults: 2,
        children: 0,
        infants: 0,
        cabinClass: null,
        hotelPreferences: ['Hilton'],
        roomRequirements: null,
        transportation: ['flight'],
        activities: [],
        budget: { amount: 5000, currency: 'SAR', flexible: true },
        airlinePreferences: [],
        notes: null,
        agentTripPlan: null,
        updatedAt: new Date().toISOString(),
      },
    })

    expect(payload.kind).toBe('hotels')
    expect(payload.offers.length).toBeGreaterThan(0)

    const normalized = normalizeExecutionResults([
      {
        taskId: 't1',
        type: 'hotel_search',
        status: 'completed',
        success: true,
        durationMs: 10,
        retryCount: 0,
        data: payload,
        error: null,
        providerId: provider.id,
      },
    ])
    expect(normalized.some((o) => o.kind === 'hotel')).toBe(true)
  })

  it('createExecutionProviders wires foundation hotels when enabled', () => {
    const { providers } = createExecutionProviders({
      mode: 'mock',
      hotelFoundationEnabled: true,
    })
    expect(providers.hotels.id).toBe('hotel_foundation')
  })

  it('orchestrator/memory helpers prefer remembered hotel brands', async () => {
    const req = hotelSearchRequestFromMemory({
      destination: 'Jeddah',
      startDate: '2026-08-10',
      endDate: '2026-08-13',
      adults: 2,
      preferredHotels: ['Marriott'],
      currency: 'SAR',
    })
    expect(req.preferredHotels).toContain('Marriott')

    const unified = await searchHotelsForOrchestrator({
      destination: 'Jeddah',
      preferredHotels: ['Hilton'],
      startDate: '2026-08-10',
      endDate: '2026-08-13',
      adults: 2,
    })
    expect(unified.offers.length).toBeGreaterThan(0)

    const boosted = applyHotelMemoryPreferenceBoost(
      [{ name: 'City Hostel' }, { name: 'Hilton Jeddah' }],
      ['Hilton'],
    )
    expect(boosted[0].name).toContain('Hilton')
  })

  it('toHotelSearchPayload preserves sandbox mock flag', () => {
    const payload = toHotelSearchPayload([
      {
        id: 'h1',
        providerId: 'hotelbeds',
        name: 'Test',
        description: null,
        currency: 'SAR',
        price: 100,
        nightly: 100,
        originalPrice: null,
        starRating: 4,
        guestReviews: { score: 8, count: 10, label: 'Good' },
        location: 'Center',
        area: 'Center',
        latitude: null,
        longitude: null,
        checkIn: '2026-08-10',
        checkOut: '2026-08-11',
        nights: 1,
        familyFriendly: false,
        breakfastIncluded: true,
        amenities: [],
        images: [],
        rooms: [],
        cancellation: {
          freeCancellation: true,
          deadline: null,
          penaltyAmount: 0,
          currency: 'SAR',
          summary: 'Free',
        },
        taxesAndFees: {
          currency: 'SAR',
          taxes: 10,
          fees: 2,
          totalInclusive: 100,
          baseExclusive: 88,
          notes: [],
        },
        bookingUrl: null,
        sandbox: true,
      },
    ])
    expect(payload.mock).toBe(true)
    expect(payload.offers[0].stars).toBe(4)
  })
})
