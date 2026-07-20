/**
 * Phase AB — v1.1 AI enhancement foundation tests.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  getFeatureRegistry,
  resetFeatureRegistry,
  emptyPersonalizationProfile,
  InMemoryPreferenceEngine,
  resetPreferenceEngine,
  createRankingEngine,
  createRecommendationEngine,
  buildMultiDestinationOutline,
  generateAlternativeItineraries,
  scorePlanningConfidence,
  buildExplainableRecommendation,
  applyPreferenceWeighting,
  estimatePreferenceFit,
  InMemoryProductAnalytics,
  resetProductAnalytics,
  getProductAnalytics,
} from '../ai'
import { resolveProviderFeatureFlags, isLiveProviderFlagEnabled } from '../agent/aggregation'
import { getDefaultPaymentProviderType } from '../payment'

describe('Phase AB FeatureRegistry', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  it('supports experimental, beta, stable, and deprecated lifecycles', () => {
    const registry = getFeatureRegistry()
    const lifecycles = new Set(registry.list().map((f) => f.lifecycle))
    expect(lifecycles.has('experimental')).toBe(true)
    expect(lifecycles.has('beta')).toBe(true)
    expect(lifecycles.has('stable')).toBe(true)
    expect(lifecycles.has('deprecated')).toBe(true)
  })

  it('keeps live payments and live providers disabled by default', () => {
    const registry = getFeatureRegistry()
    expect(registry.isEnabled('payments.live')).toBe(false)
    expect(registry.isEnabled('providers.live_master')).toBe(false)
    expect(getDefaultPaymentProviderType()).toBe('mock')
    const flags = resolveProviderFeatureFlags({ liveIntegrationEnabled: false })
    expect(isLiveProviderFlagEnabled(flags, 'amadeus')).toBe(false)
  })

  it('enforces dependency checks for preference weighting', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('ai.personalization', false)
    expect(registry.isEnabled('ai.preference_weighting')).toBe(false)
    registry.setEnabled('ai.personalization', true)
    expect(registry.isEnabled('ai.preference_weighting')).toBe(true)
  })
})

describe('Phase AB personalization foundation', () => {
  beforeEach(() => {
    resetPreferenceEngine()
  })

  it('stores traveler/hotel/airline/budget/travel-style profiles', () => {
    const engine = new InMemoryPreferenceEngine()
    const profile = emptyPersonalizationProfile('user-ab')
    profile.traveler.travelerTypes = ['couple']
    profile.hotel.preferCentral = true
    profile.airline.preferDirect = true
    profile.budget.style = 'midrange'
    profile.travelStyle.style = 'cultural'
    profile.travelStyle.interests = ['food', 'museums']
    const saved = engine.upsertProfile(profile)
    expect(saved.traveler.travelerTypes).toContain('couple')
    expect(saved.hotel.preferCentral).toBe(true)
    expect(saved.airline.preferDirect).toBe(true)
    expect(saved.budget.style).toBe('midrange')
    expect(saved.travelStyle.style).toBe('cultural')
  })

  it('blocks personalization when privacy gate is off', () => {
    const engine = new InMemoryPreferenceEngine({ personalizationAllowed: false })
    const saved = engine.upsertProfile(emptyPersonalizationProfile('user-ab'))
    expect(engine.isPersonalizationAllowed()).toBe(false)
    expect(saved.travelStyle.interests).toEqual([])
  })
})

describe('Phase AB recommendation / ranking engines', () => {
  it('ranks candidates with preference weights', () => {
    const ranking = createRankingEngine()
    const ranked = ranking.rank({
      items: [
        { id: 'a', kind: 'flight', baseScore: 0.6, price: 2000, comfort: 0.5, timeEfficiency: 0.4, rating: 0.6 },
        { id: 'b', kind: 'flight', baseScore: 0.7, price: 2800, comfort: 0.9, timeEfficiency: 0.9, rating: 0.85, personalizationFit: 0.9 },
      ],
      weights: {
        price: 0.1,
        comfort: 0.3,
        time: 0.3,
        rating: 0.2,
        personalization: 0.1,
      },
    })
    expect(ranked[0]?.id).toBe('b')
    expect(ranked[0]?.confidence).toBeGreaterThan(0)
    expect(ranked[0]?.explanation.length).toBeGreaterThan(0)
  })

  it('produces explainable recommendations with alternatives', () => {
    const engine = createRecommendationEngine()
    const profile = emptyPersonalizationProfile('u1')
    profile.weights.comfort = 0.4
    profile.weights.price = 0.1
    const result = engine.recommend({
      destination: 'Tokyo',
      destinations: ['Tokyo', 'Osaka'],
      profile,
      candidates: [
        { id: 'h1', kind: 'hotel', title: 'Airport Inn', baseScore: 50, price: 200, comfort: 40, rating: 60 },
        { id: 'h2', kind: 'hotel', title: 'Central Stay', baseScore: 80, price: 450, comfort: 90, rating: 88 },
      ],
    })
    expect(result.primary?.title).toBe('Central Stay')
    expect(result.alternatives.length).toBeGreaterThan(0)
    expect(result.primary?.whySelected.length).toBeGreaterThan(0)
    expect(result.overallConfidence).toBeGreaterThan(0)
  })
})

describe('Phase AB AI planning improvements', () => {
  it('builds multi-destination outlines', () => {
    const outline = buildMultiDestinationOutline({
      destinations: ['Tokyo', 'Kyoto', 'Osaka'],
      durationDays: 8,
      interests: ['culture', 'food'],
    })
    expect(outline.destinations).toHaveLength(3)
    expect(outline.segments).toHaveLength(3)
    expect(outline.segments.reduce((n, s) => n + s.nights, 0)).toBe(outline.totalNights)
    expect(outline.confidence).toBeGreaterThan(0.5)
  })

  it('generates alternative itineraries with confidence', () => {
    const alts = generateAlternativeItineraries({
      destinations: ['Tokyo', 'Kyoto'],
      budgetStyle: 'budget',
    })
    expect(alts.length).toBeGreaterThanOrEqual(3)
    expect(alts.find((a) => a.style === 'budget')?.confidence).toBeGreaterThan(
      alts.find((a) => a.style === 'adventure')?.confidence ?? 0,
    )
  })

  it('scores planning confidence and explainable recommendations', () => {
    const confidence = scorePlanningConfidence({
      destinationCount: 2,
      hasBudget: true,
      hasDates: true,
      preferenceFit: 0.8,
    })
    expect(confidence.overall).toBeGreaterThan(0.6)

    const explained = buildExplainableRecommendation({
      subjectId: 'itin-1',
      subjectKind: 'itinerary',
      whySelected: ['Matches cultural interests'],
      rejectedTitles: ['Packed adventure'],
      confidence: 0.81,
      weightsApplied: true,
    })
    expect(explained.preferenceWeightsApplied).toBe(true)
    expect(explained.whyAlternativesRejected[0]).toMatch(/Packed adventure/)

    const weighted = applyPreferenceWeighting(
      { price: 0.5, comfort: 0.9, time: 0.8, rating: 0.7, personalization: 0.8 },
      { price: 0.1, comfort: 0.35, time: 0.25, rating: 0.15, personalization: 0.15 },
    )
    expect(weighted).toBeGreaterThan(0.7)

    const fit = estimatePreferenceFit(
      {
        ...emptyPersonalizationProfile('u'),
        travelStyle: {
          style: 'cultural',
          pace: 'balanced',
          interests: ['food', 'culture'],
          weatherPreference: 'mild',
          favoriteDestinations: [],
        },
      },
      ['food', 'shopping'],
    )
    expect(fit).toBeGreaterThan(0.5)
  })
})

describe('Phase AB analytics foundation', () => {
  beforeEach(() => {
    resetProductAnalytics()
  })

  it('tracks anonymous recommendation and funnel metrics', () => {
    const analytics = new InMemoryProductAnalytics({ analyticsAllowed: true, appVersion: '1.1.0-planning' })
    analytics.track('recommendation_shown', 'anon-1')
    analytics.track('recommendation_shown', 'anon-1')
    analytics.track('recommendation_accepted', 'anon-1')
    analytics.track('itinerary_started', 'anon-1')
    analytics.track('itinerary_completed', 'anon-1')
    analytics.track('booking_funnel_view', 'anon-1')
    analytics.track('booking_funnel_hold', 'anon-1')
    analytics.track('booking_funnel_payment', 'anon-1')
    analytics.track('booking_funnel_ticket', 'anon-1')
    analytics.track('booking_funnel_complete', 'anon-1')

    const snap = analytics.snapshot()
    expect(snap.recommendationAcceptanceRate).toBe(0.5)
    expect(snap.itineraryCompletionRate).toBe(1)
    expect(snap.bookingFunnel.conversionRate).toBe(1)
  })

  it('does not record events when analytics privacy gate is off', () => {
    const analytics = getProductAnalytics()
    analytics.setAllowed(false)
    expect(analytics.track('recommendation_shown', 'anon-2')).toBeNull()
    expect(analytics.snapshot().eventCount).toBe(0)
  })

  it('masks sensitive metadata keys', () => {
    const analytics = new InMemoryProductAnalytics({ analyticsAllowed: true })
    const event = analytics.track('recommendation_shown', 'anon-3', {
      token: 'secret-token',
      offerId: 'offer-1',
    })
    expect(event?.metadata.token).toBe('[redacted]')
    expect(event?.metadata.offerId).toBe('offer-1')
  })
})
