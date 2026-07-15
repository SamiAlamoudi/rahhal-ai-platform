/**
 * Phase AC — Recommendation Engine v1 extensive unit tests.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  RecommendationEngine,
  createRecommendationEngine,
  scoreCandidate,
  seasonFromMonth,
  InMemoryPreferenceEngine,
  resetPreferenceEngine,
  calculatePreferenceWeights,
  normalizePreferenceWeights,
  createRankingEngine,
  stableSort,
  breakTies,
  emptyPersonalizationProfile,
  type RecommendationContext,
  type RecommendationCandidateInput,
  type RankedItem,
} from '../ai'
import { getDefaultPaymentProviderType } from '../payment'
import { resolveProviderFeatureFlags, isLiveProviderFlagEnabled } from '../agent/aggregation'

function baseContext(overrides: Partial<RecommendationContext> = {}): RecommendationContext {
  return {
    destination: 'Tokyo',
    destinations: ['Tokyo', 'Kyoto'],
    locale: 'en',
    tripDurationDays: 7,
    travelMonth: 4,
    season: null,
    budgetAmount: 8000,
    budgetCurrency: 'SAR',
    travelerType: 'couple',
    travelStyle: 'cultural',
    interests: ['food', 'culture'],
    popularDestinations: ['Tokyo', 'Paris', 'Dubai'],
    ...overrides,
  }
}

function candidates(): RecommendationCandidateInput[] {
  return [
    {
      id: 'itin-culture',
      kind: 'itinerary',
      title: 'Tokyo Culture Week',
      estimatedCost: 7200,
      durationDays: 7,
      popularity: 0.9,
      seasonalityTags: ['spring', 'autumn'],
      travelStyles: ['cultural', 'balanced'],
      travelerTypes: ['couple', 'solo'],
      tags: ['food', 'culture', 'museum'],
      destination: 'Tokyo',
      baseScore: 80,
    },
    {
      id: 'itin-adventure',
      kind: 'itinerary',
      title: 'Japan Adventure Dash',
      estimatedCost: 11000,
      durationDays: 10,
      popularity: 0.6,
      seasonalityTags: ['summer'],
      travelStyles: ['adventure', 'packed'],
      travelerTypes: ['friends'],
      tags: ['adventure', 'outdoor'],
      destination: 'Osaka',
      baseScore: 70,
    },
    {
      id: 'itin-budget',
      kind: 'itinerary',
      title: 'Budget Tokyo Bites',
      estimatedCost: 4500,
      durationDays: 6,
      popularity: 0.75,
      seasonalityTags: ['spring', 'winter'],
      travelStyles: ['budget_focus'],
      travelerTypes: ['solo', 'couple'],
      tags: ['food', 'budget'],
      destination: 'Tokyo',
      baseScore: 65,
    },
  ]
}

describe('Phase AC RecommendationEngine v1 scoring', () => {
  it('scores using traveler prefs, popularity, budget, style, seasonality, duration', () => {
    const engine = createRecommendationEngine()
    const result = engine.recommendV1({
      context: baseContext(),
      candidates: candidates(),
      maxResults: 3,
    })

    expect(result.primary).toBeTruthy()
    expect(result.primary?.score.components.travelerPreferences).toBeGreaterThan(0)
    expect(result.primary?.score.components.destinationPopularity).toBeGreaterThan(0)
    expect(result.primary?.score.components.budgetFit).toBeGreaterThan(0)
    expect(result.primary?.score.components.travelStyle).toBeGreaterThan(0)
    expect(result.primary?.score.components.seasonality).toBeGreaterThan(0)
    expect(result.primary?.score.components.tripDuration).toBeGreaterThan(0)
    expect(result.primary?.score.overall).toBeGreaterThan(50)
  })

  it('prefers cultural spring couple itinerary over mismatched adventure', () => {
    const engine = createRecommendationEngine()
    const result = engine.recommendV1({
      context: baseContext({ travelMonth: 4, travelStyle: 'cultural', travelerType: 'couple' }),
      candidates: candidates(),
    })
    expect(result.primary?.candidateId).toBe('itin-culture')
    expect(result.primary?.rank).toBe(1)
    expect(result.recommendations.map((r) => r.candidateId)[0]).toBe('itin-culture')
    expect(result.recommendations.map((r) => r.candidateId)).toContain('itin-adventure')
  })

  it('each recommendation includes score, confidence, reasons, matched/unmatched prefs', () => {
    const engine = createRecommendationEngine()
    const result = engine.recommendV1({
      context: baseContext(),
      candidates: candidates(),
      explicitPreferences: ['culture', 'food'],
    })
    for (const rec of result.recommendations) {
      expect(rec.score.overall).toBeGreaterThan(0)
      expect(rec.confidence).toBeGreaterThan(0)
      expect(rec.reasons.length).toBeGreaterThan(0)
      expect(Array.isArray(rec.matchedPreferences)).toBe(true)
      expect(Array.isArray(rec.unmatchedPreferences)).toBe(true)
      expect(rec.reasons[0]?.code).toBeTruthy()
      expect(rec.reasons[0]?.message).toBeTruthy()
    }
    expect(result.primary?.matchedPreferences.some((m) => m.includes('interest:food') || m.includes('interest:culture'))).toBe(true)
  })

  it('is deterministic across repeated runs', () => {
    const engine = createRecommendationEngine()
    const request = { context: baseContext(), candidates: candidates(), maxResults: 3 }
    const a = engine.recommendV1(request)
    const b = engine.recommendV1(request)
    expect(a.recommendations.map((r) => r.candidateId)).toEqual(
      b.recommendations.map((r) => r.candidateId),
    )
    expect(a.recommendations.map((r) => r.score.overall)).toEqual(
      b.recommendations.map((r) => r.score.overall),
    )
  })

  it('uses Arabic reason messages when locale=ar', () => {
    const engine = createRecommendationEngine()
    const result = engine.recommendV1({
      context: baseContext({ locale: 'ar' }),
      candidates: candidates(),
    })
    expect(result.primary?.reasons.some((r) => /[\u0600-\u06FF]/.test(r.message))).toBe(true)
  })
})

describe('Phase AC scoreCandidate components', () => {
  it('maps months to seasons', () => {
    expect(seasonFromMonth(1)).toBe('winter')
    expect(seasonFromMonth(4)).toBe('spring')
    expect(seasonFromMonth(7)).toBe('summer')
    expect(seasonFromMonth(10)).toBe('autumn')
    expect(seasonFromMonth(null)).toBeNull()
  })

  it('penalizes budget stretch and season mismatch', () => {
    const expensive = scoreCandidate(
      candidates()[1]!,
      baseContext({ budgetAmount: 5000, travelMonth: 4 }),
      null,
    )
    const seasonal = scoreCandidate(
      candidates()[0]!,
      baseContext({ budgetAmount: 8000, travelMonth: 4 }),
      null,
    )
    expect(expensive.components.budgetFit).toBeLessThan(seasonal.components.budgetFit)
    expect(seasonal.components.seasonality).toBeGreaterThan(expensive.components.seasonality)
  })

  it('rewards duration match', () => {
    const matched = scoreCandidate(
      { ...candidates()[0]!, durationDays: 7 },
      baseContext({ tripDurationDays: 7 }),
      null,
    )
    const mismatched = scoreCandidate(
      { ...candidates()[0]!, durationDays: 14 },
      baseContext({ tripDurationDays: 7 }),
      null,
    )
    expect(matched.components.tripDuration).toBeGreaterThan(mismatched.components.tripDuration)
  })
})

describe('Phase AC PreferenceEngine', () => {
  beforeEach(() => {
    resetPreferenceEngine()
  })

  it('supports explicit and inferred preferences with normalization', () => {
    const engine = new InMemoryPreferenceEngine()
    engine.setExplicitPreferences('u1', {
      travelerType: 'family',
      interests: ['Food', 'Culture', 'food'],
      budgetStyle: 'budget',
      budgetAmount: 5000,
      preferDirectFlights: true,
      preferCentralHotels: true,
      travelStyle: 'cultural',
    })
    engine.setInferredPreferences('u1', {
      interestSignals: ['parks'],
      typicalSpend: 4800,
      acceptedRecommendationKinds: ['itinerary'],
    })

    const normalized = engine.normalizePreferences('u1')
    expect(normalized.travelerType).toBe('family')
    expect(normalized.interests).toEqual(expect.arrayContaining(['food', 'culture', 'parks']))
    expect(normalized.preferDirectFlights).toBe(true)
    expect(normalized.keys).toContain('budgetStyle:budget')

    const weights = engine.calculateWeights('u1')
    const sum = weights.price + weights.comfort + weights.time + weights.rating + weights.personalization
    expect(sum).toBeCloseTo(1, 3)
    expect(weights.price).toBeGreaterThan(defaultPriceWeight())
  })

  it('normalizes messy weights', () => {
    const normalized = normalizePreferenceWeights({
      price: 2,
      comfort: 2,
      time: 0,
      rating: 0,
      personalization: 0,
    })
    expect(normalized.price).toBeCloseTo(0.5, 3)
    expect(normalized.comfort).toBeCloseTo(0.5, 3)
  })

  it('feeds preference profile into recommendation engine', () => {
    const prefs = new InMemoryPreferenceEngine()
    const profile = prefs.setExplicitPreferences('u2', {
      travelerType: 'couple',
      interests: ['food', 'culture'],
      budgetAmount: 8000,
      budgetStyle: 'midrange',
      travelStyle: 'cultural',
      preferCentralHotels: true,
    })
    const engine = new RecommendationEngine(createRankingEngine(), profile)
    const result = engine.recommendV1({
      context: baseContext(),
      candidates: candidates(),
    })
    expect(result.primary?.candidateId).toBe('itin-culture')
  })
})

function defaultPriceWeight(): number {
  return calculatePreferenceWeights({}).price
}

describe('Phase AC RankingEngine', () => {
  it('applies weighted ranking', () => {
    const ranking = createRankingEngine()
    const ranked = ranking.rank({
      items: [
        { id: 'cheap', kind: 'flight', baseScore: 0.5, price: 1000, comfort: 0.3, timeEfficiency: 0.4, rating: 0.5 },
        { id: 'nice', kind: 'flight', baseScore: 0.8, price: 3000, comfort: 0.95, timeEfficiency: 0.9, rating: 0.9, personalizationFit: 0.9 },
      ],
      weights: {
        price: 0.05,
        comfort: 0.4,
        time: 0.3,
        rating: 0.15,
        personalization: 0.1,
      },
    })
    expect(ranked[0]?.id).toBe('nice')
  })

  it('breaks ties deterministically by confidence, kind, then id', () => {
    const items: RankedItem[] = [
      { id: 'b', kind: 'hotel', baseScore: 1, rankScore: 0.8, confidence: 0.5, explanation: [] },
      { id: 'a', kind: 'hotel', baseScore: 1, rankScore: 0.8, confidence: 0.5, explanation: [] },
      { id: 'c', kind: 'flight', baseScore: 1, rankScore: 0.8, confidence: 0.9, explanation: [] },
    ]
    const sorted = stableSort(items)
    expect(sorted.map((i) => i.id)).toEqual(['c', 'a', 'b'])

    const tied = breakTies(
      [
        { id: 'h1', kind: 'hotel', baseScore: 1, rankScore: 0.7, confidence: 0.7, explanation: [] },
        { id: 'f1', kind: 'flight', baseScore: 1, rankScore: 0.7, confidence: 0.7, explanation: [] },
      ],
      ['flight', 'hotel'],
    )
    expect(tied[0]?.id).toBe('f1')
  })

  it('produces stable output for identical inputs', () => {
    const ranking = createRankingEngine()
    const input = {
      items: [
        { id: 'x', kind: 'activity' as const, baseScore: 0.5, rating: 0.5 },
        { id: 'y', kind: 'activity' as const, baseScore: 0.5, rating: 0.5 },
      ],
    }
    expect(ranking.rank(input).map((r) => r.id)).toEqual(ranking.rank(input).map((r) => r.id))
  })
})

describe('Phase AC backward compatibility + safety posture', () => {
  it('keeps Phase AB recommend() facade working', () => {
    const engine = createRecommendationEngine(emptyPersonalizationProfile('u'))
    const result = engine.recommend({
      destination: 'Tokyo',
      candidates: [
        { id: 'h1', kind: 'hotel', title: 'Central', baseScore: 80, price: 400, comfort: 90, rating: 85 },
        { id: 'h2', kind: 'hotel', title: 'Airport', baseScore: 50, price: 200, comfort: 40, rating: 60 },
      ],
      maxResults: 2,
    })
    expect(result.primary?.id).toBeTruthy()
    expect(result.ranked.length).toBe(2)
  })

  it('does not enable live payments or live providers', () => {
    expect(getDefaultPaymentProviderType()).toBe('mock')
    expect(import.meta.env.VITE_PAYMENT_PROVIDER).toBe('mock')
    const flags = resolveProviderFeatureFlags({ liveIntegrationEnabled: false })
    expect(isLiveProviderFlagEnabled(flags, 'amadeus')).toBe(false)
  })
})
