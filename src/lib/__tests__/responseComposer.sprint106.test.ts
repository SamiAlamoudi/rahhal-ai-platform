/**
 * Sprint 106 — AI Response Composer tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  SPRINT106_RESPONSE_COMPOSER_VERSION,
  RESPONSE_COMPOSER_FEATURE_ID,
  isResponseComposerEnabled,
  runResponseComposer,
  composeAiResponse,
  reasonAboutRecommendation,
  generateAlternatives,
  explainConfidence,
  buildTravelInsights,
  buildResponseWarnings,
  buildResponseSummary,
  mapLooseOfferToFlightFacts,
  type ResponseComposerFlightFacts,
  type ResponseComposerInput,
} from '../agent/responseComposer'

function offer(
  overrides: Partial<ResponseComposerFlightFacts> & { id: string },
): ResponseComposerFlightFacts {
  return {
    currency: 'SAR',
    airline: 'Saudia',
    origin: 'RUH',
    destination: 'DXB',
    ...overrides,
  }
}

const sampleFlights: ResponseComposerFlightFacts[] = [
  offer({
    id: 'f_balanced',
    title: 'SV RUH→DXB balanced',
    price: 1200,
    durationMinutes: 200,
    stops: 0,
    cabin: 'economy',
    refundable: true,
    baggageIncluded: true,
    departureAt: '2026-09-15T08:00:00',
    arrivalAt: '2026-09-15T11:20:00',
    arrivalHour: 11,
    score: 0.9,
  }),
  offer({
    id: 'f_cheap',
    title: 'XY cheap',
    airline: 'flynas',
    price: 800,
    durationMinutes: 360,
    stops: 1,
    layoverMinutes: 200,
    cabin: 'economy',
    refundable: false,
    baggageIncluded: false,
    arrivalHour: 23,
    score: 0.6,
  }),
  offer({
    id: 'f_fast',
    title: 'EK fast',
    airline: 'Emirates',
    price: 1500,
    durationMinutes: 180,
    stops: 0,
    cabin: 'economy',
    refundable: true,
    baggageIncluded: true,
    score: 0.85,
  }),
  offer({
    id: 'f_business',
    title: 'SV business',
    price: 4200,
    durationMinutes: 200,
    stops: 0,
    cabin: 'business',
    refundable: true,
    baggageIncluded: true,
    seatsRemaining: 2,
    score: 0.7,
  }),
]

function baseInput(
  overrides?: Partial<ResponseComposerInput>,
): ResponseComposerInput {
  return {
    conversationId: 'conv_106',
    trip: {
      origin: 'RUH',
      destination: 'DXB',
      departureDate: '2026-08-15',
      travelers: 2,
      currency: 'SAR',
      timeDifferenceHours: 1,
      visaNote: 'GCC citizens typically do not need a visa for UAE.',
    },
    flights: sampleFlights,
    decisionConfidence: 0.88,
    labeled: {
      bestOverallId: 'f_balanced',
      cheapestId: 'f_cheap',
      fastestId: 'f_fast',
      bestComfortId: 'f_business',
    },
    ...overrides,
  }
}

describe('Sprint 106 — AI Response Composer', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('exposes version and feature flag default OFF', () => {
    expect(SPRINT106_RESPONSE_COMPOSER_VERSION).toMatch(/response-composer/)
    expect(RESPONSE_COMPOSER_FEATURE_ID).toBe('ai.response_composer')
    expect(getFeatureRegistry().isEnabled('ai.response_composer')).toBe(false)
    expect(isResponseComposerEnabled()).toBe(false)
  })

  describe('feature flag', () => {
    it('OFF returns disabled result without recommendations', () => {
      const result = runResponseComposer(baseInput(), { enabled: false })
      expect(result.enabled).toBe(false)
      expect(result.recommendations).toEqual([])
      expect(result.metadata.source).toBe('disabled')
      expect(result.confidence.explanations[0]).toMatch(/OFF/)
    })

    it('ON composes full structured response', () => {
      getFeatureRegistry().setEnabled('ai.response_composer', true)
      const result = runResponseComposer(baseInput(), { enabled: true })
      expect(result.enabled).toBe(true)
      expect(result.summary.executiveSummary.length).toBeGreaterThan(0)
      expect(result.recommendations.length).toBeGreaterThan(0)
      expect(result.alternatives.length).toBeGreaterThan(0)
      expect(result.confidence.overall).toBeGreaterThan(0)
      expect(result.metadata.source).toBe('provider_offers')
    })
  })

  describe('summary generation', () => {
    it('builds executive summary from best recommendation', () => {
      const composed = composeAiResponse(baseInput())
      expect(composed.summary.headline).toMatch(/RUH/)
      expect(composed.summary.bestRecommendationLabel).toBeTruthy()
      expect(composed.summary.keyPoints.length).toBeGreaterThan(0)

      const empty = buildResponseSummary({
        trip: { origin: 'RUH', destination: 'DXB' },
        recommendations: [],
        offerCount: 0,
      })
      expect(empty.executiveSummary).toMatch(/No provider/i)
    })
  })

  describe('recommendation reasoning', () => {
    it('explains nonstop, savings, and balance from facts only', () => {
      const onlyNonstop = reasonAboutRecommendation({
        selected: offer({ id: 'a', price: 1000, durationMinutes: 180, stops: 0 }),
        pool: [
          offer({ id: 'a', price: 1000, durationMinutes: 180, stops: 0 }),
          offer({ id: 'b', price: 900, durationMinutes: 400, stops: 1 }),
        ],
        kind: 'best_overall',
      })
      expect(onlyNonstop.reasons.some((r) => /nonstop/i.test(r))).toBe(true)
      expect(onlyNonstop.reasons.some((r) => /balance/i.test(r))).toBe(true)

      const fastest = reasonAboutRecommendation({
        selected: offer({ id: 'fast', price: 1500, durationMinutes: 120, stops: 0 }),
        pool: [
          offer({ id: 'fast', price: 1500, durationMinutes: 120, stops: 0 }),
          offer({ id: 'slow', price: 800, durationMinutes: 360, stops: 1 }),
        ],
        kind: 'fastest',
      })
      expect(fastest.reason).toMatch(/saves|Shortest|hour/i)
    })

    it('mentions lowest baggage restrictions when factual', () => {
      const explained = reasonAboutRecommendation({
        selected: offer({ id: 'bags', baggageIncluded: true, price: 1100 }),
        pool: [
          offer({ id: 'bags', baggageIncluded: true, price: 1100 }),
          offer({ id: 'no', baggageIncluded: false, price: 900 }),
        ],
        kind: 'best_value',
      })
      expect(explained.reasons.some((r) => /baggage/i.test(r))).toBe(true)
    })
  })

  describe('alternative generation', () => {
    it('produces Best Overall, Cheapest, Fastest, Comfortable, Business, Flexible', () => {
      const { recommendations, alternatives } = generateAlternatives(sampleFlights, {
        labeled: {
          bestOverallId: 'f_balanced',
          cheapestId: 'f_cheap',
          fastestId: 'f_fast',
          bestComfortId: 'f_business',
        },
      })
      const kinds = alternatives.map((a) => a.kind)
      expect(kinds).toContain('best_overall')
      expect(kinds).toContain('cheapest')
      expect(kinds).toContain('fastest')
      expect(kinds).toContain('most_comfortable')
      expect(kinds).toContain('business')
      expect(kinds).toContain('flexible')
      expect(recommendations.find((r) => r.kind === 'cheapest')?.optionId).toBe('f_cheap')
      expect(recommendations.find((r) => r.kind === 'fastest')?.optionId).toBe('f_fast')
    })
  })

  describe('confidence explanation', () => {
    it('scores price, schedule, and recommendation confidence', () => {
      const conf = explainConfidence({
        flights: sampleFlights,
        decisionConfidence: 0.9,
      })
      expect(conf.priceConfidence).toBe(1)
      expect(conf.scheduleConfidence).toBeGreaterThan(0)
      expect(conf.recommendationConfidence).toBeGreaterThan(0)
      expect(conf.explanations.length).toBeGreaterThan(0)
      expect(['high', 'medium', 'low']).toContain(conf.level)
    })
  })

  describe('insights and warnings', () => {
    it('builds insights from trip + schedule facts', () => {
      const insights = buildTravelInsights({
        flights: sampleFlights,
        trip: baseInput().trip,
        best: sampleFlights[1]!,
      })
      expect(insights.some((i) => i.kind === 'visa_reminder')).toBe(true)
      expect(insights.some((i) => i.kind === 'time_difference')).toBe(true)
      expect(insights.some((i) => i.kind === 'night_arrival')).toBe(true)
      expect(insights.some((i) => i.kind === 'long_layover')).toBe(true)
      expect(insights.some((i) => i.kind === 'weather_reminder')).toBe(true)
      expect(insights.some((i) => i.kind === 'peak_travel')).toBe(true)
    })

    it('builds booking / fare / layover warnings from facts', () => {
      const warnings = buildResponseWarnings({
        flights: sampleFlights,
        validFlights: sampleFlights,
        best: sampleFlights[3]!,
      })
      expect(warnings.some((w) => w.code === 'LIMITED_SEATS')).toBe(true)

      const fare = buildResponseWarnings({
        flights: sampleFlights,
        validFlights: sampleFlights,
        best: sampleFlights[1]!,
      })
      expect(fare.some((w) => w.code === 'NON_REFUNDABLE')).toBe(true)
      expect(fare.some((w) => w.kind === 'night_arrival')).toBe(true)
    })
  })

  describe('null / empty / invalid offers', () => {
    it('handles null provider responses and empty offers', () => {
      const nullFlights = runResponseComposer(
        { conversationId: 'c1', flights: null },
        { enabled: true },
      )
      expect(nullFlights.enabled).toBe(true)
      expect(nullFlights.metadata.empty).toBe(true)
      expect(nullFlights.warnings.some((w) => w.code === 'EMPTY_OFFERS')).toBe(true)

      const empty = composeAiResponse({ flights: [] })
      expect(empty.recommendations).toEqual([])
      expect(empty.alternatives).toEqual([])
    })

    it('drops invalid offers and warns', () => {
      const mapped = mapLooseOfferToFlightFacts({}, 0)
      expect(mapped).toBeNull()

      const result = composeAiResponse({
        flights: [
          offer({ id: 'good', price: 1000, durationMinutes: 200, stops: 0 }),
          { id: '' } as ResponseComposerFlightFacts,
        ],
      })
      expect(result.metadata.validOfferCount).toBe(1)
      expect(result.warnings.some((w) => w.code === 'INVALID_OFFERS_DROPPED')).toBe(true)
    })
  })
})
