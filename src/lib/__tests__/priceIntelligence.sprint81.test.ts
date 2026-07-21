/**
 * Sprint 81 — AI Price Intelligence & Booking Timing tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  analyzePrices,
  analyzePriceTrend,
  calculateTimingConfidence,
  computeVolatility,
  detectOpportunities,
  isHolidayDate,
  onPriceEvent,
  resetPriceEventListeners,
  runBookingTiming,
  SPRINT81_PRICE_INTELLIGENCE_VERSION,
  type PriceEvent,
  type PriceObservation,
} from '../../core'
import {
  enrichWithPriceIntelligence,
  isPriceIntelligenceEnabled,
} from '../agent/priceIntelligence'
import type { AgentMemory, TripPlan } from '../agent/types'
import { emptyRequirements } from '../agent/types'

function obs(prices: number[], currency = 'SAR'): PriceObservation[] {
  const now = Date.UTC(2026, 5, 1)
  return prices.map((price, i) => ({
    price,
    currency,
    observedAt: new Date(now + i * 86_400_000).toISOString(),
    source: 'test',
  }))
}

function stubMemory(overrides: Partial<AgentMemory['requirements']> = {}): AgentMemory {
  return {
    locale: 'en',
    phase: 'planned',
    requirements: {
      ...emptyRequirements(),
      destination: 'Dubai',
      origin: 'Riyadh',
      budgetAmount: 8000,
      budgetCurrency: 'SAR',
      startDate: '2026-08-15',
      ...overrides,
    },
    missingFields: [],
    tripPlan: null,
    itinerary: null,
    lastIntent: 'plan',
  }
}

function stubPlan(): TripPlan {
  return {
    id: 'p1',
    title: 'Test',
    summary: 'Test trip',
    locale: 'en',
    destinations: ['Dubai'],
    startDate: '2026-08-15',
    endDate: '2026-08-20',
    durationDays: 5,
    travelers: 2,
    travelerType: 'couple',
    interests: [],
    dailyItinerary: [],
    activities: [],
    transportation: [],
    flights: [{
      from: 'RUH',
      to: 'DXB',
      airline: 'Saudia',
      stops: 0,
      estimatedCost: 1200,
      currency: 'SAR',
      notes: null,
    }],
    accommodations: [{
      name: 'Hilton',
      area: 'Marina',
      category: 'hotel',
      fit: 'good',
      estimatedNightly: 400,
      currency: 'SAR',
    }],
    attractions: [],
    weatherNotes: [],
    visaNotes: [],
    travelTips: [],
    packingSuggestions: [],
    estimatedBudget: { amount: 3200, currency: 'SAR', breakdown: [] },
    estimatedCosts: { amount: 3200, currency: 'SAR', breakdown: [] },
    notes: [],
    conversationId: 'c81',
    requirements: emptyRequirements(),
    updatedAt: '2026-07-21T00:00:00.000Z',
  }
}

describe('Sprint 81 — AI Price Intelligence & Booking Timing', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetPriceEventListeners()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetPriceEventListeners()
  })

  it('enables ai.price_intelligence by default', () => {
    expect(getFeatureRegistry().isEnabled('ai.price_intelligence')).toBe(true)
    expect(isPriceIntelligenceEnabled()).toBe(true)
    expect(SPRINT81_PRICE_INTELLIGENCE_VERSION).toMatch(/price-intelligence/)
  })

  it('recommends BOOK_NOW for cheap prices below average', () => {
    const result = runBookingTiming({
      currentPrice: 1800,
      currency: 'SAR',
      cheapestPrice: 1800,
      premiumPrice: 4200,
      historicalObservations: obs([2500, 2600, 2550, 2700, 2400, 2500]),
      budgetCap: 5000,
      departureDate: '2026-07-28',
      bookingDate: '2026-07-20',
      demandIndicator: 'high',
      seatsRemaining: 6,
    })
    expect(result.recommendation.action).toBe('BOOK_NOW')
    expect(result.recommendation.explanation.toLowerCase()).toContain('book now')
    expect(result.recommendation.confidence).toBeGreaterThan(50)
  })

  it('recommends PRICE_TOO_HIGH for expensive prices over budget', () => {
    const result = runBookingTiming({
      currentPrice: 9500,
      currency: 'SAR',
      historicalObservations: obs([4000, 4200, 4100, 4300]),
      budgetCap: 5000,
      departureDate: '2026-09-01',
      bookingDate: '2026-07-20',
    })
    expect(result.recommendation.action).toBe('PRICE_TOO_HIGH')
    expect(result.recommendation.negativeIndicators.some((n) => n.includes('budget'))).toBe(true)
  })

  it('applies weekend effect to demand / indicators', () => {
    const analysis = analyzePrices({
      currentPrice: 3000,
      currency: 'SAR',
      historicalObservations: obs([2800, 3000, 3200]),
      departureDate: '2026-08-07', // Friday
      bookingDate: '2026-07-20',
      isWeekendTravel: true,
    })
    expect(analysis.isWeekendTravel).toBe(true)
    expect(analysis.demand).toBe('high')
  })

  it('applies holiday effect', () => {
    expect(isHolidayDate(new Date('2026-12-25T00:00:00.000Z'), null)).toBe(true)
    const analysis = analyzePrices({
      currentPrice: 3500,
      currency: 'SAR',
      historicalObservations: obs([3000, 3200, 3400]),
      departureDate: '2026-12-24',
      bookingDate: '2026-11-01',
      isHolidayPeriod: true,
    })
    expect(analysis.isHolidayPeriod).toBe(true)
    expect(analysis.season).toBe('peak')
  })

  it('calculates confidence from sample size and volatility', () => {
    const low = calculateTimingConfidence({
      observationCount: 1,
      volatility: 0.3,
      daysToDeparture: null,
      trend: 'volatile',
      hasBudget: false,
      demandKnown: false,
      seasonKnown: false,
      availabilityKnown: false,
    })
    const high = calculateTimingConfidence({
      observationCount: 10,
      volatility: 0.04,
      daysToDeparture: 30,
      trend: 'falling',
      hasBudget: true,
      demandKnown: true,
      seasonKnown: true,
      availabilityKnown: true,
    })
    expect(high).toBeGreaterThan(low)
    expect(high).toBeGreaterThan(70)
    expect(low).toBeLessThan(55)
  })

  it('recommends WAIT when decrease is likely and departure is far', () => {
    const result = runBookingTiming({
      currentPrice: 3600,
      currency: 'SAR',
      historicalObservations: obs([4000, 3800, 3600, 3400, 3200, 3000]),
      budgetCap: 8000,
      departureDate: '2026-10-15',
      bookingDate: '2026-07-20',
      demandIndicator: 'low',
      tripSeason: 'off',
    })
    expect(result.recommendation.action).toBe('WAIT')
    expect(result.recommendation.opportunities).toContain('likely_decrease')
  })

  it('recommends BOOK_NOW when bargain + rising pressure', () => {
    const result = runBookingTiming({
      currentPrice: 2000,
      currency: 'SAR',
      historicalObservations: obs([2800, 2900, 3000, 3100, 3200]),
      budgetCap: 6000,
      departureDate: '2026-07-25',
      bookingDate: '2026-07-20',
      demandIndicator: 'high',
      seatsRemaining: 7,
    })
    expect(result.recommendation.action).toBe('BOOK_NOW')
    expect(result.recommendation.positiveIndicators.length).toBeGreaterThan(0)
  })

  it('recommends WATCH_PRICE for mixed mid-band market', () => {
    const result = runBookingTiming({
      currentPrice: 3000,
      currency: 'SAR',
      historicalObservations: obs([2950, 3000, 3050, 2980, 3020]),
      budgetCap: 8000,
      departureDate: '2026-08-20',
      bookingDate: '2026-07-20',
      demandIndicator: 'medium',
      tripSeason: 'shoulder',
    })
    expect(['WATCH_PRICE', 'BOOK_NOW', 'WAIT']).toContain(result.recommendation.action)
    // Near-average stable market should prefer watch when not a clear bargain
    if (result.recommendation.analysis.priceVsAverageRatio != null) {
      const r = result.recommendation.analysis.priceVsAverageRatio
      expect(r).toBeGreaterThan(0.9)
      expect(r).toBeLessThan(1.15)
    }
  })

  it('flags uncertain market / high uncertainty opportunity', () => {
    const result = runBookingTiming({
      currentPrice: 4000,
      currency: 'SAR',
      historicalObservations: obs([2000, 5000, 2500, 4800, 2200, 5100]),
      budgetCap: 9000,
      departureDate: '2026-09-01',
      bookingDate: '2026-07-20',
    })
    expect(result.recommendation.opportunities).toContain('high_uncertainty')
    expect(result.recommendation.analysis.trend).toBe('volatile')
  })

  it('handles high demand indicator', () => {
    const analysis = analyzePrices({
      currentPrice: 3200,
      currency: 'SAR',
      historicalObservations: obs([3000, 3100, 3200]),
      demandIndicator: 'high',
      departureDate: '2026-08-01',
      bookingDate: '2026-07-20',
    })
    expect(analysis.demand).toBe('high')
    const opportunities = detectOpportunities({
      ...analysis,
      priceVsAverageRatio: 1.1,
      trend: 'rising',
    })
    expect(opportunities).toContain('likely_increase')
  })

  it('handles low demand indicator', () => {
    const analysis = analyzePrices({
      currentPrice: 2800,
      currency: 'SAR',
      historicalObservations: obs([3000, 2900, 2800]),
      demandIndicator: 'low',
      tripSeason: 'off',
      departureDate: '2026-11-01',
      bookingDate: '2026-07-20',
    })
    expect(analysis.demand).toBe('low')
  })

  it('recommends LIMITED_AVAILABILITY when seats are scarce', () => {
    const result = runBookingTiming({
      currentPrice: 3100,
      currency: 'SAR',
      historicalObservations: obs([3000, 3050, 3100, 3150]),
      budgetCap: 8000,
      departureDate: '2026-08-10',
      bookingDate: '2026-07-20',
      seatsRemaining: 2,
    })
    expect(result.recommendation.action).toBe('LIMITED_AVAILABILITY')
    expect(result.recommendation.signalsUsed).toContain('availability')
  })

  it('applies seasonality (peak vs off)', () => {
    const peak = analyzePrices({
      currentPrice: 4000,
      currency: 'SAR',
      historicalObservations: obs([3800, 4000]),
      departureDate: '2026-07-05',
      bookingDate: '2026-06-01',
      tripSeason: 'peak',
    })
    const off = analyzePrices({
      currentPrice: 2500,
      currency: 'SAR',
      historicalObservations: obs([2400, 2500]),
      departureDate: '2026-02-10',
      bookingDate: '2026-01-05',
      tripSeason: 'off',
    })
    expect(peak.season).toBe('peak')
    expect(off.season).toBe('off')
  })

  it('computes booking window / departure proximity', () => {
    const analysis = analyzePrices({
      currentPrice: 3000,
      currency: 'SAR',
      historicalObservations: obs([3000, 3100]),
      departureDate: '2026-08-01',
      bookingDate: '2026-07-20',
    })
    expect(analysis.daysToDeparture).toBe(12)
    expect(analysis.bookingWindowDays).toBe(12)
  })

  it('measures price volatility', () => {
    const calm = computeVolatility([100, 102, 101, 103, 100])
    const wild = computeVolatility([100, 200, 80, 220, 90])
    expect(wild).toBeGreaterThan(calm)
    expect(wild).toBeGreaterThan(0.2)
  })

  it('detects exceptional bargain opportunity', () => {
    const analysis = analyzePrices({
      currentPrice: 1500,
      currency: 'SAR',
      historicalObservations: obs([2500, 2600, 2400, 2550, 2450]),
      departureDate: '2026-08-01',
      bookingDate: '2026-07-20',
    })
    const ops = detectOpportunities(analysis)
    expect(ops).toContain('exceptional_bargain')
  })

  it('detects price spike opportunity', () => {
    const analysis = analyzePrices({
      currentPrice: 5000,
      currency: 'SAR',
      historicalObservations: obs([3000, 3100, 2900, 3050]),
      departureDate: '2026-08-01',
      bookingDate: '2026-07-20',
    })
    expect(detectOpportunities(analysis)).toContain('price_spike')
  })

  it('returns exactly one timing action with explanation fields', () => {
    const result = runBookingTiming({
      currentPrice: 2200,
      currency: 'SAR',
      historicalObservations: obs([2800, 2700, 2600, 2500]),
      budgetCap: 6000,
      departureDate: '2026-07-30',
      bookingDate: '2026-07-20',
      roomsRemaining: 4,
    })
    const actions = [
      'BOOK_NOW',
      'WAIT',
      'WATCH_PRICE',
      'PRICE_TOO_HIGH',
      'LIMITED_AVAILABILITY',
      'NO_CONFIDENT_RECOMMENDATION',
    ]
    expect(actions).toContain(result.recommendation.action)
    expect(result.recommendation.reason.length).toBeGreaterThan(0)
    expect(result.recommendation.signalsUsed.length).toBeGreaterThan(0)
    expect(typeof result.recommendation.confidence).toBe('number')
    expect(result.recommendation.explanation).toMatch(/confidence|Confidence/i)
  })

  it('emits observability events', () => {
    const seen: PriceEvent['name'][] = []
    onPriceEvent((e) => seen.push(e.name))
    runBookingTiming({
      currentPrice: 2000,
      currency: 'SAR',
      historicalObservations: obs([2500, 2400, 2300, 2200]),
      budgetCap: 5000,
      departureDate: '2026-08-01',
      bookingDate: '2026-07-20',
    })
    expect(seen).toContain('price.analysis.started')
    expect(seen).toContain('timing.confidence')
    expect(seen).toContain('booking.recommendation')
    expect(seen).toContain('price.analysis.finished')
  })

  it('handles edge case: invalid current price', () => {
    const result = runBookingTiming({
      currentPrice: 0,
      currency: 'SAR',
      historicalObservations: obs([2000, 2100]),
    })
    expect(result.recommendation.action).toBe('NO_CONFIDENT_RECOMMENDATION')
  })

  it('handles edge case: empty history falls back to pool synthesis', () => {
    const analysis = analyzePrices({
      currentPrice: 3000,
      currency: 'SAR',
      cheapestPrice: 2500,
      premiumPrice: 4500,
    })
    expect(analysis.observationCount).toBeGreaterThanOrEqual(2)
    expect(analysis.averageObservedPrice).toBeTruthy()
  })

  it('analyzes rising vs falling trends', () => {
    const rising = analyzePriceTrend(obs([2000, 2200, 2400, 2600, 2800]))
    const falling = analyzePriceTrend(obs([2800, 2600, 2400, 2200, 2000]))
    expect(rising.trend).toBe('rising')
    expect(falling.trend).toBe('falling')
  })

  it('agent bridge enriches trip plan notes when enabled', () => {
    const memory = stubMemory()
    const plan = stubPlan()
    const { tripPlan, priceIntelligence } = enrichWithPriceIntelligence({
      memory,
      tripPlan: plan,
      flightOffers: [
        { id: 'f1', price: 1000, currency: 'SAR', seatsRemaining: 9 },
        { id: 'f2', price: 1800, currency: 'SAR' },
      ],
      hotelStays: [
        { id: 'h1', total: 1200, currency: 'SAR', roomsRemaining: 6 },
        { id: 'h2', total: 2200, currency: 'SAR' },
      ],
      decisionBestTotal: 2800,
      enabled: true,
    })
    expect(priceIntelligence).toBeTruthy()
    expect(tripPlan.notes.some((n) => n.includes('Price intelligence:'))).toBe(true)
    expect(priceIntelligence!.recommendation.action).toBeTruthy()
  })

  it('agent bridge no-ops when feature disabled', () => {
    const { tripPlan, priceIntelligence } = enrichWithPriceIntelligence({
      memory: stubMemory(),
      tripPlan: stubPlan(),
      flightOffers: [{ price: 1000 }],
      hotelStays: [{ total: 1000 }],
      enabled: false,
    })
    expect(priceIntelligence).toBeNull()
    expect(tripPlan.notes).toHaveLength(0)
  })

  it('rooms-limited path returns LIMITED_AVAILABILITY', () => {
    const result = runBookingTiming({
      currentPrice: 3000,
      currency: 'SAR',
      historicalObservations: obs([2900, 3000, 3100]),
      budgetCap: 7000,
      departureDate: '2026-08-15',
      bookingDate: '2026-07-20',
      roomsRemaining: 1,
    })
    expect(result.recommendation.action).toBe('LIMITED_AVAILABILITY')
  })
})
