/**
 * Sprint 111 — AI Concierge Experience (Decision Conversation Layer) tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import { runResponseComposer } from '../agent/responseComposer'
import {
  SPRINT111_CONCIERGE_VERSION,
  CONCIERGE_FEATURE_ID,
  isConciergeEnabled,
  runConcierge,
  createConciergeRunner,
  explainConversation,
  analyzeTradeoffs,
  simulateScenarios,
  analyzeSavings,
  narrateRecommendation,
  buildConversationMetadata,
  optionsFromResponseComposer,
  type ConciergeInput,
  type ConciergeRecommendationOption,
} from '../agent/concierge'

function opt(
  overrides: Partial<ConciergeRecommendationOption> & { id: string },
): ConciergeRecommendationOption {
  return {
    title: overrides.title ?? overrides.id,
    price: 1200,
    currency: 'SAR',
    durationMinutes: 200,
    stops: 0,
    cabin: 'economy',
    airline: 'Saudia',
    hotelName: 'Marina Hotel',
    hotelStars: 4,
    confidence: 0.85,
    score: 0.9,
    kind: 'best_overall',
    reason: 'Best balance of price and duration',
    labels: ['best_overall'],
    ...overrides,
  }
}

const sampleOptions: ConciergeRecommendationOption[] = [
  opt({
    id: 'sel',
    title: 'Balanced trip',
    price: 2150,
    durationMinutes: 200,
    stops: 0,
    kind: 'best_overall',
    confidence: 0.9,
  }),
  opt({
    id: 'cheap',
    title: 'Budget trip',
    price: 1400,
    durationMinutes: 360,
    stops: 1,
    hotelName: 'Budget Inn',
    hotelStars: 2,
    kind: 'cheapest',
    reason: 'Lowest price',
    labels: ['budget'],
    confidence: 0.6,
  }),
  opt({
    id: 'premium',
    title: 'Premium trip',
    price: 5200,
    durationMinutes: 190,
    stops: 0,
    cabin: 'business',
    hotelName: 'Palace Luxury',
    hotelStars: 5,
    kind: 'premium',
    reason: 'Maximum comfort',
    labels: ['luxury', 'business'],
    confidence: 0.8,
  }),
]

function baseInput(overrides?: Partial<ConciergeInput>): ConciergeInput {
  return {
    conversationId: 'conv_111',
    selectedId: 'sel',
    recommendations: sampleOptions,
    decisionConfidence: 0.88,
    decisionExplanation: 'Decision Engine selected the best overall candidate.',
    budget: 5000,
    currency: 'SAR',
    travelerType: 'leisure',
    destination: 'DXB',
    ...overrides,
  }
}

describe('Sprint 111 — AI Concierge (Decision Conversation Layer)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('exposes version and feature flag id', () => {
    expect(SPRINT111_CONCIERGE_VERSION).toMatch(/decision-concierge/)
    expect(CONCIERGE_FEATURE_ID).toBe('ai.concierge_experience')
    expect(getFeatureRegistry().isEnabled('ai.concierge_experience')).toBe(true)
  })

  describe('feature flag OFF/ON', () => {
    it('OFF returns disabled result without enhancement', () => {
      const result = runConcierge(baseInput(), { enabled: false })
      expect(result.enabled).toBe(false)
      expect(result.ok).toBe(false)
      expect(result.empty).toBe(true)
      expect(result.explanation).toBeNull()
      expect(result.narrative).toBeNull()
      expect(result.logs).toContain('concierge_disabled')
    })

    it('OFF via registry disables the runner', () => {
      getFeatureRegistry().setEnabled('ai.concierge_experience', false)
      expect(isConciergeEnabled()).toBe(false)
      const result = runConcierge(baseInput())
      expect(result.enabled).toBe(false)
    })

    it('ON produces full concierge enhancement', () => {
      const result = runConcierge(baseInput(), { enabled: true })
      expect(result.enabled).toBe(true)
      expect(result.ok).toBe(true)
      expect(result.empty).toBe(false)
      expect(result.selected?.id).toBe('sel')
      expect(result.explanation).not.toBeNull()
      expect(result.narrative?.primary.length).toBeGreaterThan(20)
      expect(result.metadata.confidence).toBeGreaterThan(0)
    })
  })

  describe('explanation generation', () => {
    it('explains why selected with strengths, weaknesses, bestFor', () => {
      const explanation = explainConversation({
        selected: sampleOptions[0]!,
        alternatives: sampleOptions,
        decisionExplanation: 'Engine pick',
        decisionConfidence: 0.9,
        travelerType: 'business',
      })
      expect(explanation.whySelected).toMatch(/selected/i)
      expect(explanation.strengths.length).toBeGreaterThan(0)
      expect(explanation.bestFor.toLowerCase()).toMatch(/business|balance|travel/)
      expect(explanation.reasoningSummary.length).toBeGreaterThan(10)
    })
  })

  describe('tradeoffs', () => {
    it('returns structured tradeoffs vs alternatives', () => {
      const tradeoffs = analyzeTradeoffs({
        selected: sampleOptions[0]!,
        alternatives: sampleOptions,
      })
      expect(tradeoffs.length).toBeGreaterThan(0)
      expect(tradeoffs[0]).toMatchObject({
        kind: expect.any(String),
        label: expect.any(String),
        againstOptionId: expect.any(String),
        summary: expect.any(String),
      })
      const vsCheap = tradeoffs.find((t) => t.againstOptionId === 'cheap')
      expect(vsCheap?.priceDelta).not.toBeNull()
    })
  })

  describe('scenario simulation', () => {
    it('simulates what-if scenarios without inventing offers', () => {
      const scenarios = simulateScenarios({
        selected: sampleOptions[0]!,
        recommendations: sampleOptions,
        budget: 5000,
      })
      const kinds = scenarios.map((s) => s.kind)
      expect(kinds).toContain('reduce_budget')
      expect(kinds).toContain('direct_flight_only')
      expect(kinds).toContain('upgrade_hotel')
      expect(kinds).toContain('travel_one_day_earlier')

      const earlier = scenarios.find((s) => s.kind === 'travel_one_day_earlier')!
      expect(earlier.applicable).toBe(false)
      expect(earlier.notes.join(' ')).toMatch(/did not call providers/i)

      const direct = scenarios.find((s) => s.kind === 'direct_flight_only')!
      expect(direct.applicable).toBe(true)
      expect(direct.matchingOptionIds.length).toBeGreaterThan(0)

      const reduce = scenarios.find((s) => s.kind === 'reduce_budget')!
      expect(reduce.estimatedPrice).toBe(1400)
    })
  })

  describe('savings analysis', () => {
    it('computes savings from known prices only', () => {
      const savings = analyzeSavings({
        selected: sampleOptions[0]!,
        recommendations: sampleOptions,
        budget: 5000,
      })
      expect(savings.selectedPrice).toBe(2150)
      expect(savings.cheapestPrice).toBe(1400)
      expect(savings.potentialSavingsVsSelected).toBe(750)
      expect(savings.potentialSavingsVsBudget).toBe(2850)
      expect(savings.priceDifferenceToPremium).toBe(3050)
      expect(savings.summary.length).toBeGreaterThan(5)
    })
  })

  describe('metadata generation', () => {
    it('builds conversation metadata', () => {
      const result = runConcierge(baseInput(), { enabled: true })
      expect(result.metadata).toMatchObject({
        confidence: expect.any(Number),
        reasoningSummary: expect.any(String),
        bestFor: expect.any(String),
        costSummary: expect.any(String),
        qualitySummary: expect.any(String),
      })
      expect(result.metadata.highlights.length).toBeGreaterThan(0)
      expect(Array.isArray(result.metadata.tradeoffs)).toBe(true)
      expect(Array.isArray(result.metadata.warnings)).toBe(true)
    })

    it('narrates concise natural language', () => {
      const result = runConcierge(baseInput(), { enabled: true })
      expect(result.narrative?.primary).toMatch(/selected/i)
      expect(result.responseComposerAttachment.narrativeLines.length).toBeGreaterThan(0)
    })
  })

  describe('empty / single / multiple recommendations', () => {
    it('handles empty recommendations', () => {
      const result = runConcierge(baseInput({ recommendations: [] }), {
        enabled: true,
      })
      expect(result.ok).toBe(false)
      expect(result.empty).toBe(true)
      expect(result.metadata.warnings.some((w) => /empty/i.test(w))).toBe(true)
    })

    it('handles single recommendation', () => {
      const result = runConcierge(
        baseInput({
          recommendations: [sampleOptions[0]!],
          selectedId: 'sel',
        }),
        { enabled: true },
      )
      expect(result.ok).toBe(true)
      expect(result.selected?.id).toBe('sel')
      expect(result.tradeoffs).toEqual([])
    })

    it('handles multiple recommendations', () => {
      const result = runConcierge(baseInput(), { enabled: true })
      expect(result.ok).toBe(true)
      expect(result.tradeoffs.length).toBeGreaterThan(0)
      expect(result.scenarios.length).toBe(7)
    })
  })

  describe('invalid data', () => {
    it('skips recommendations with missing ids and records validation errors', () => {
      const result = runConcierge(
        baseInput({
          recommendations: [
            sampleOptions[0]!,
            // @ts-expect-error intentional invalid fixture
            { id: '', title: 'bad', price: 100, currency: 'SAR', labels: [] },
            // @ts-expect-error intentional invalid fixture
            { id: 'bad_price', title: 'bad', price: Number.NaN, currency: 'SAR', labels: [] },
          ],
        }),
        { enabled: true },
      )
      expect(result.ok).toBe(true)
      expect(result.validationErrors.length).toBeGreaterThan(0)
      expect(result.selected?.id).toBe('sel')
    })

    it('runner retains structured logs', () => {
      const runner = createConciergeRunner({ enabled: true })
      runner.run(baseInput({ recommendations: [] }))
      expect(runner.getStructuredLogs().some((l) => l.message.includes('empty'))).toBe(
        true,
      )
    })
  })

  describe('Response Composer consumption (no RC changes)', () => {
    it('maps Response Composer output into concierge options', () => {
      const composed = runResponseComposer(
        {
          conversationId: 'conv_rc',
          flights: [
            {
              id: 'f1',
              title: 'SV balanced',
              price: 1200,
              currency: 'SAR',
              durationMinutes: 200,
              stops: 0,
              airline: 'Saudia',
              cabin: 'economy',
            },
            {
              id: 'f2',
              title: 'XY cheap',
              price: 800,
              currency: 'SAR',
              durationMinutes: 360,
              stops: 1,
              airline: 'flynas',
            },
          ],
          decisionConfidence: 0.8,
          labeled: { bestOverallId: 'f1', cheapestId: 'f2' },
        },
        { enabled: true },
      )
      const mapped = optionsFromResponseComposer(composed)
      expect(mapped.length).toBeGreaterThan(0)

      const result = runConcierge(
        {
          conversationId: 'conv_rc',
          responseComposer: composed,
          recommendations: mapped,
          decisionConfidence: composed.confidence.overall,
          budget: 4000,
        },
        { enabled: true },
      )
      expect(result.ok).toBe(true)
      expect(result.responseComposerAttachment.narrativeLines.length).toBeGreaterThan(0)
    })
  })

  describe('unit helpers', () => {
    it('buildConversationMetadata and narrateRecommendation work in isolation', () => {
      const explanation = explainConversation({
        selected: sampleOptions[0]!,
        alternatives: sampleOptions,
      })
      const tradeoffs = analyzeTradeoffs({
        selected: sampleOptions[0]!,
        alternatives: sampleOptions,
      })
      const savings = analyzeSavings({
        selected: sampleOptions[0]!,
        recommendations: sampleOptions,
        budget: 5000,
      })
      const meta = buildConversationMetadata({
        selected: sampleOptions[0]!,
        explanation,
        tradeoffs,
        savings,
        recommendations: sampleOptions,
      })
      expect(meta.costSummary.length).toBeGreaterThan(0)
      const narrative = narrateRecommendation({
        selected: sampleOptions[0]!,
        explanation,
        tradeoffs,
        savings,
        alternatives: sampleOptions.slice(1),
      })
      expect(narrative.primary.length).toBeGreaterThan(10)
    })
  })
})
