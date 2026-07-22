/**
 * Sprint 96 — AI Concierge Experience tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  buildComparisonCards,
  buildConfidenceIndicator,
  buildConciergeAlternatives,
  buildConciergeExplanation,
  buildConciergeSuggestions,
  buildConversationSummary,
  composeConciergeExperience,
  runRecommendationTimeline,
  SPRINT96_AI_CONCIERGE_VERSION,
} from '../../core'
import {
  isConciergeExperienceEnabled,
  runConciergeExperience,
  CONCIERGE_EXPERIENCE_FEATURE_ID,
} from '../agent/conciergeExperience'
import { emptyMemory } from '../agent/types'

const sampleTrip = {
  destination: 'Dubai',
  origin: 'Riyadh',
  startDate: '2026-08-15',
  endDate: '2026-08-20',
  durationDays: 5,
  travelers: 2,
  travelerType: 'couple',
  budgetAmount: 8000,
  currency: 'SAR',
  interests: ['shopping', 'food'],
  mission: 'Visit Dubai',
}

const sampleOffers = {
  flights: [{
    id: 'flt_1',
    airline: 'Saudia',
    origin: 'RUH',
    destination: 'DXB',
    price: 1200,
    currency: 'SAR',
    durationMinutes: 190,
    stops: 0,
    cabin: 'ECONOMY',
  }],
  hotels: [{
    id: 'htl_1',
    name: 'Marina Hotel',
    price: 2200,
    currency: 'SAR',
    stars: 4,
    rating: 4.4,
  }],
  packages: [{
    id: 'pkg_1',
    title: 'Dubai balanced escape',
    totalPrice: 3600,
    currency: 'SAR',
    confidence: 0.86,
    labels: ['best overall', 'value'],
    explanation: 'Balanced flight and hotel pairing.',
  }],
  decision: {
    explanation: 'Best overall fit on price and comfort.',
    confidence: 0.84,
    bestOverallId: 'pkg_1',
    bestBudgetId: 'pkg_budget',
    fastestId: 'pkg_fast',
    bestComfortId: 'pkg_comfort',
  },
  priceTimingNote: 'Prices look stable for these dates.',
  priceConfidence: 0.8,
}

describe('Sprint 96 — AI Concierge Experience', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('registers ai.concierge_experience enabled by default', () => {
    expect(getFeatureRegistry().isEnabled('ai.concierge_experience')).toBe(true)
    expect(isConciergeExperienceEnabled()).toBe(true)
    expect(CONCIERGE_EXPERIENCE_FEATURE_ID).toBe('ai.concierge_experience')
    expect(SPRINT96_AI_CONCIERGE_VERSION).toMatch(/ai-concierge/)
  })

  describe('recommendation timeline', () => {
    it('runs Searching → Comparing → Ranking → Optimizing → Final', () => {
      const timeline = runRecommendationTimeline({
        destination: 'Dubai',
        offerCount: 3,
      })
      expect(timeline.stages.map((s) => s.id)).toEqual([
        'searching',
        'comparing',
        'ranking',
        'optimizing',
        'final_recommendation',
      ])
      expect(timeline.stages.every((s) => s.status === 'completed')).toBe(true)
      expect(timeline.progressPercent).toBe(100)
      expect(timeline.stages[0]?.label.toLowerCase()).toContain('search')
      expect(timeline.stages[0]?.message.toLowerCase()).toContain('found')
    })
  })

  describe('explanation engine', () => {
    it('explains destination, flights, hotel, package, and timing', () => {
      const explanation = buildConciergeExplanation({
        trip: sampleTrip,
        offers: sampleOffers,
      })
      expect(explanation.whyDestination).toMatch(/Dubai/)
      expect(explanation.whyFlights).toMatch(/Saudia|flight/i)
      expect(explanation.whyHotel).toMatch(/Marina|hotel/i)
      expect(explanation.whyPackage.length).toBeGreaterThan(20)
      expect(explanation.whyTiming).toMatch(/Timing|dates|2026/)
      expect(explanation.summary).toMatch(/recommend/i)
    })
  })

  describe('alternatives', () => {
    it('produces Best Price / Comfort / Fastest / Value / Luxury / Family', () => {
      const alts = buildConciergeAlternatives({
        trip: sampleTrip,
        offers: sampleOffers,
      })
      const kinds = alts.map((a) => a.kind)
      expect(kinds).toContain('best_price')
      expect(kinds).toContain('best_comfort')
      expect(kinds).toContain('fastest')
      expect(kinds).toContain('best_value')
      expect(kinds).toContain('luxury')
      expect(kinds).toContain('family_friendly')
      expect(alts.every((a) => a.explanation.length > 10)).toBe(true)
    })
  })

  describe('confidence indicator', () => {
    it('maps high / medium / low with uncertainty text when not high', () => {
      const high = buildConfidenceIndicator({
        engineConfidence: 0.9,
        hasDestination: true,
        hasFlights: true,
        hasHotels: true,
        hasPackage: true,
        hasDecision: true,
        alternativeCount: 6,
      })
      expect(high.level).toBe('high')
      expect(high.uncertaintyExplanation).toBeNull()

      const low = buildConfidenceIndicator({
        engineConfidence: 0.2,
        hasDestination: false,
        hasFlights: false,
        hasHotels: false,
      })
      expect(low.level).toBe('low')
      expect(low.uncertaintyExplanation).toMatch(/low/i)
    })
  })

  describe('conversation summary', () => {
    it('produces Option A style summary text', () => {
      const explanation = buildConciergeExplanation({ trip: sampleTrip, offers: sampleOffers })
      const confidence = buildConfidenceIndicator({
        engineConfidence: 0.8,
        hasDestination: true,
        hasFlights: true,
        hasHotels: true,
        hasPackage: true,
        hasDecision: true,
      })
      const alts = buildConciergeAlternatives({ trip: sampleTrip, offers: sampleOffers })
      const summary = buildConversationSummary({
        trip: sampleTrip,
        explanation,
        confidence,
        recommended: alts.find((a) => a.kind === 'best_value') ?? alts[0],
      })
      expect(summary.text).toMatch(/Based on your budget/i)
      expect(summary.recommendedOptionLabel).toBeTruthy()
      expect(summary.keyReasons.length).toBeGreaterThan(0)
      expect(summary.nextStep).toBeTruthy()
    })
  })

  describe('comparison cards', () => {
    it('includes price, duration, stops, hotel quality, value, reason', () => {
      const alts = buildConciergeAlternatives({ trip: sampleTrip, offers: sampleOffers })
      const cards = buildComparisonCards({
        trip: sampleTrip,
        offers: sampleOffers,
        alternatives: alts,
      })
      expect(cards.length).toBeGreaterThan(0)
      const recommended = cards.find((c) => c.isRecommended)
      expect(recommended).toBeTruthy()
      expect(recommended?.recommendationReason.length).toBeGreaterThan(10)
      expect(cards[0]?.currency).toBe('SAR')
      expect(typeof cards[0]?.overallValue).toBe('number')
    })
  })

  describe('concierge suggestions', () => {
    it('suggests insurance, transfer, visa, weather, packing, transport', () => {
      const suggestions = buildConciergeSuggestions({ trip: sampleTrip })
      const kinds = suggestions.map((s) => s.kind)
      expect(kinds).toEqual(expect.arrayContaining([
        'travel_insurance',
        'airport_transfer',
        'visa_reminder',
        'weather',
        'packing_tips',
        'local_transportation',
      ]))
    })
  })

  describe('composer + agent bridge', () => {
    it('composes a full concierge experience result', () => {
      const result = composeConciergeExperience({
        conversationId: 'cx_test',
        trip: sampleTrip,
        offers: sampleOffers,
        engineConfidence: 0.82,
      })
      expect(result.version).toMatch(/ai-concierge/)
      expect(result.timeline.progressPercent).toBe(100)
      expect(result.explanation.summary).toBeTruthy()
      expect(result.alternatives.length).toBe(6)
      expect(result.comparisonCards.length).toBe(6)
      expect(result.suggestions.length).toBeGreaterThanOrEqual(6)
      expect(result.conversationSummary.text).toMatch(/recommend/i)
      expect(result.confidence.level).toMatch(/high|medium|low/)
    })

    it('agent bridge respects feature flag', () => {
      const memory = emptyMemory()
      memory.requirements.destination = 'Dubai'
      memory.requirements.origin = 'Riyadh'
      memory.requirements.budgetAmount = 8000
      memory.requirements.budgetCurrency = 'SAR'

      const on = runConciergeExperience({
        memory,
        offers: sampleOffers,
      })
      expect(on.enabled).toBe(true)
      expect(on.meta?.conversationId).toBeTruthy()
      expect(on.recommendationFacts.length).toBeGreaterThan(3)

      getFeatureRegistry().setEnabled('ai.concierge_experience', false)
      const off = runConciergeExperience({ memory, offers: sampleOffers })
      expect(off.enabled).toBe(false)
      expect(off.result).toBeNull()
    })
  })
})
