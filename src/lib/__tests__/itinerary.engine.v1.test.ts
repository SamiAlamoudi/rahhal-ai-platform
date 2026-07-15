/**
 * Phase AD — Itinerary Generation Engine v1 deterministic unit tests.
 */
import { describe, expect, it } from 'vitest'
import {
  createItineraryEngine,
  ItineraryEngine,
  createRecommendationEngine,
  scoreBudgetFit,
  scoreActivityDiversity,
  computeOptimizationScores,
  optimizeDaysForBudget,
  type ItineraryEngineInput,
} from '../ai'
import { getDefaultPaymentProviderType } from '../payment'
import { resolveProviderFeatureFlags, isLiveProviderFlagEnabled } from '../agent/aggregation'

function baseInput(overrides: Partial<ItineraryEngineInput> = {}): ItineraryEngineInput {
  return {
    destination: 'Tokyo',
    destinations: ['Tokyo', 'Kyoto'],
    locale: 'en',
    startDate: '2027-04-01',
    endDate: '2027-04-05',
    durationDays: 5,
    budgetAmount: 12000,
    budgetCurrency: 'SAR',
    origin: 'Riyadh',
    travelerType: 'couple',
    travelStyle: 'cultural',
    interests: ['food', 'culture', 'museum'],
    constraints: {
      preferDirectFlights: true,
      preferCentralHotels: true,
      maxActivitiesPerDay: 3,
    },
    optimizationGoal: 'preference_score',
    profile: {
      interests: ['food', 'culture'],
      travelStyle: 'cultural',
      preferDirectFlights: true,
      preferCentralHotels: true,
      budgetStyle: 'midrange',
    },
    ...overrides,
  }
}

describe('Phase AD ItineraryEngine generation', () => {
  it('generates complete itinerary with days, activities, flights, hotels, transport, costs, free time', () => {
    const engine = createItineraryEngine()
    const itinerary = engine.generate(baseInput())

    expect(itinerary.version).toBe(1)
    expect(itinerary.durationDays).toBe(5)
    expect(itinerary.days).toHaveLength(5)
    expect(itinerary.flights.length).toBeGreaterThanOrEqual(2)
    expect(itinerary.hotels.length).toBeGreaterThanOrEqual(1)
    expect(itinerary.transportation.length).toBeGreaterThan(0)
    expect(itinerary.costs.total).toBeGreaterThan(0)
    expect(itinerary.costs.flights).toBeGreaterThan(0)
    expect(itinerary.costs.hotels).toBeGreaterThan(0)

    for (const day of itinerary.days) {
      expect(day.slots.some((s) => s.kind === 'free_time')).toBe(true)
      expect(day.freeTimeMinutes).toBeGreaterThan(0)
      expect(day.activities.length).toBeGreaterThan(0)
    }
  })

  it('uses RecommendationEngine output when recommendations are provided', () => {
    const engine = createItineraryEngine()
    const itinerary = engine.generate(baseInput({
      recommendations: [
        {
          id: 'rec-sushi',
          title: 'Sushi tasting',
          kind: 'activity',
          score: 90,
          confidence: 0.9,
          matchedPreferences: ['interest:food'],
          tags: ['food'],
          estimatedCost: 150,
        },
        {
          id: 'rec-temple',
          title: 'Temple walk',
          kind: 'activity',
          score: 88,
          confidence: 0.85,
          matchedPreferences: ['interest:culture'],
          tags: ['culture'],
          estimatedCost: 40,
        },
      ],
    }))

    expect(itinerary.recommendationIds).toEqual(expect.arrayContaining(['rec-sushi', 'rec-temple']))
    const titles = itinerary.days.flatMap((d) => d.slots.map((s) => s.title)).join(' ')
    expect(titles).toMatch(/Sushi tasting|Temple walk/)
  })

  it('respects destination constraints and trip duration', () => {
    const engine = createItineraryEngine()
    const itinerary = engine.generate(baseInput({
      destinations: ['Osaka', 'Kyoto'],
      durationDays: 3,
      endDate: '2027-04-03',
    }))
    expect(itinerary.durationDays).toBe(3)
    expect(itinerary.days).toHaveLength(3)
    expect(itinerary.destinations).toEqual(['Osaka', 'Kyoto'])
    expect(itinerary.days.map((d) => d.location)).toEqual(['Osaka', 'Kyoto', 'Osaka'])
  })

  it('is deterministic for identical inputs', () => {
    const engine = createItineraryEngine()
    const input = baseInput()
    const a = engine.generate(input)
    const b = engine.generate(input)
    expect(a.days.map((d) => d.slots.map((s) => s.id))).toEqual(
      b.days.map((d) => d.slots.map((s) => s.id)),
    )
    expect(a.costs.total).toBe(b.costs.total)
    expect(a.optimization.scores.overall).toBe(b.optimization.scores.overall)
    expect(a.explanation.confidence).toBe(b.explanation.confidence)
  })
})

describe('Phase AD optimization goals', () => {
  it('supports minimum travel time optimization', () => {
    const engine = createItineraryEngine()
    const itinerary = engine.generate(baseInput({ optimizationGoal: 'minimum_travel_time' }))
    expect(itinerary.optimization.goal).toBe('minimum_travel_time')
    expect(itinerary.optimization.improvementsApplied.length).toBeGreaterThan(0)
    expect(itinerary.explanation.optimizationSummary).toMatch(/Minimum travel time|Optimized/i)
  })

  it('supports budget fit optimization and may replace expensive activities', () => {
    const engine = createItineraryEngine()
    const itinerary = engine.generate(baseInput({
      optimizationGoal: 'budget_fit',
      budgetAmount: 5000,
      recommendations: [
        { id: 'a1', title: 'Luxury spa', kind: 'activity', tags: ['luxury'], estimatedCost: 900 },
        { id: 'a2', title: 'Private chef', kind: 'activity', tags: ['food'], estimatedCost: 800 },
        { id: 'a3', title: 'Helicopter tour', kind: 'activity', tags: ['adventure'], estimatedCost: 1200 },
      ],
    }))
    expect(itinerary.optimization.goal).toBe('budget_fit')
    expect(itinerary.costs.budgetAmount).toBe(5000)
    expect(typeof itinerary.costs.withinBudget).toBe('boolean')
  })

  it('supports preference score and activity diversity goals', () => {
    const engine = createItineraryEngine()
    const pref = engine.generate(baseInput({ optimizationGoal: 'preference_score' }))
    const diversity = engine.generate(baseInput({ optimizationGoal: 'activity_diversity' }))
    expect(pref.optimization.goal).toBe('preference_score')
    expect(diversity.optimization.goal).toBe('activity_diversity')
    expect(pref.optimization.scores.preferenceScore).toBeGreaterThan(0)
    expect(diversity.optimization.scores.activityDiversity).toBeGreaterThan(0)
  })
})

describe('Phase AD explanation surface', () => {
  it('explains itinerary with confidence, summary, assumptions, trade-offs', () => {
    const engine = createItineraryEngine()
    const itinerary = engine.generate(baseInput())
    expect(itinerary.explanation.confidence).toBeGreaterThan(0)
    expect(itinerary.explanation.optimizationSummary.length).toBeGreaterThan(0)
    expect(itinerary.explanation.assumptions.length).toBeGreaterThan(0)
    expect(itinerary.explanation.tradeOffs.length).toBeGreaterThan(0)
    expect(itinerary.optimization.summary).toBe(itinerary.explanation.optimizationSummary)
  })

  it('produces Arabic explanation copy when locale=ar', () => {
    const engine = createItineraryEngine()
    const itinerary = engine.generate(baseInput({ locale: 'ar' }))
    expect(itinerary.title).toMatch(/[\u0600-\u06FF]/)
    expect(itinerary.explanation.assumptions.some((a) => /[\u0600-\u06FF]/.test(a))).toBe(true)
  })
})

describe('Phase AD optimizer helpers', () => {
  it('scores budget fit and diversity', () => {
    expect(scoreBudgetFit(8000, 10000)).toBeGreaterThan(scoreBudgetFit(15000, 10000))
    const days = createItineraryEngine().generate(baseInput()).days
    expect(scoreActivityDiversity(days)).toBeGreaterThan(0)
    const scores = computeOptimizationScores({
      days,
      transportMinutes: 120,
      totalCost: 9000,
      budgetAmount: 12000,
      interests: ['food', 'culture'],
    })
    expect(scores.overall).toBeGreaterThan(0.3)
  })

  it('budget optimizer replaces expensive activities with free time', () => {
    const engine = createItineraryEngine()
    const base = engine.generate(baseInput({
      budgetAmount: 100000,
      recommendations: [
        { id: 'x', title: 'Ultra spa', kind: 'activity', tags: ['luxury'], estimatedCost: 2000 },
      ],
    }))
    const { days, applied } = optimizeDaysForBudget(base.days, 1)
    expect(applied.length).toBeGreaterThan(0)
    expect(days.some((d) => d.slots.some((s) => s.kind === 'free_time' && s.notes))).toBe(true)
  })
})

describe('Phase AD integration + safety posture', () => {
  it('can be constructed with an explicit RecommendationEngine', () => {
    const engine = new ItineraryEngine(createRecommendationEngine())
    const itinerary = engine.generate(baseInput({ durationDays: 2 }))
    expect(itinerary.days).toHaveLength(2)
    expect(itinerary.flights[0]?.direct).toBe(true)
  })

  it('keeps mock payment and live providers off', () => {
    expect(getDefaultPaymentProviderType()).toBe('mock')
    expect(import.meta.env.VITE_PAYMENT_PROVIDER).toBe('mock')
    const flags = resolveProviderFeatureFlags({ liveIntegrationEnabled: false })
    expect(isLiveProviderFlagEnabled(flags, 'amadeus')).toBe(false)
  })
})
