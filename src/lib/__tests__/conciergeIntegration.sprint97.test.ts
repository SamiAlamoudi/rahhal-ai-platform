/**
 * Sprint 97 — Concierge UI Integration tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  emptyRecommendationResponseDto,
  integrateConciergeIntoTurn,
  offersFromEngineSnapshots,
  toConversationResponseDto,
  toRecommendationResponseDto,
  toTripResponseDto,
  SPRINT97_CONCIERGE_INTEGRATION_VERSION,
} from '../agent/conciergeIntegration'
import { emptyMemory } from '../agent/types'

function memoryWithTrip(overrides?: {
  destination?: string | null
  budget?: number | null
  travelerType?: string | null
}) {
  const memory = emptyMemory()
  memory.requirements.destination = overrides?.destination ?? 'Dubai'
  memory.requirements.origin = 'Riyadh'
  memory.requirements.startDate = '2026-08-15'
  memory.requirements.endDate = '2026-08-20'
  memory.requirements.budgetAmount = overrides?.budget ?? 8000
  memory.requirements.budgetCurrency = 'SAR'
  memory.requirements.travelerType = (overrides?.travelerType as 'couple') ?? 'couple'
  memory.requirements.travelers = 2
  return memory
}

const flightOffer = {
  id: 'flt_1',
  airline: 'Saudia',
  origin: 'RUH',
  destination: 'DXB',
  price: 1200,
  currency: 'SAR',
  durationMinutes: 190,
  stops: 0,
  cabin: 'ECONOMY',
}

const hotelOffer = {
  id: 'htl_1',
  name: 'Marina Hotel',
  price: 2200,
  currency: 'SAR',
  stars: 4,
  rating: 4.4,
}

const packageSelected = {
  id: 'pkg_1',
  title: 'Dubai balanced escape',
  totalPrice: 3600,
  currency: 'SAR',
  confidence: 0.86,
  labels: ['best overall', 'value'],
  explanation: 'Balanced flight and hotel pairing.',
}

describe('Sprint 97 — Concierge UI Integration', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('exposes integration version', () => {
    expect(SPRINT97_CONCIERGE_INTEGRATION_VERSION).toMatch(/concierge-integration/)
  })

  describe('legacy compatibility / flag off', () => {
    it('returns empty recommendation DTO when concierge disabled', () => {
      getFeatureRegistry().setEnabled('ai.concierge_experience', false)
      const turn = integrateConciergeIntoTurn({
        memory: memoryWithTrip(),
        packageSelected,
        enabled: false,
      })
      expect(turn.enabled).toBe(false)
      expect(turn.result).toBeNull()
      expect(turn.meta).toBeNull()
      expect(turn.recommendationFacts).toEqual([])
      expect(turn.recommendation.conciergeEnabled).toBe(false)
      expect(turn.recommendation.timeline).toBeNull()
      expect(turn.recommendation.alternatives).toEqual([])

      const conversation = turn.toConversationResponse('Legacy reply unchanged.')
      expect(conversation.reply).toBe('Legacy reply unchanged.')
      expect(conversation.recommendation.conciergeEnabled).toBe(false)
      expect(conversation.conciergeMeta).toBeNull()
    })

    it('emptyRecommendationResponseDto is stable legacy shape', () => {
      const empty = emptyRecommendationResponseDto()
      expect(empty).toEqual({
        conciergeEnabled: false,
        version: null,
        explanation: null,
        timeline: null,
        confidence: null,
        summary: null,
        alternatives: [],
        comparisonCards: [],
        suggestions: [],
      })
    })
  })

  describe('concierge enabled', () => {
    it('attaches timeline, confidence, summary, alternatives, cards, suggestions', () => {
      const turn = integrateConciergeIntoTurn({
        conversationId: 'cx_97',
        memory: memoryWithTrip(),
        flightOffers: [flightOffer],
        hotelOffers: [hotelOffer],
        packageSelected,
        decision: {
          explanation: 'Best overall fit',
          confidence: 0.84,
          bestOverallId: 'pkg_1',
          bestBudgetId: 'pkg_b',
          fastestId: 'pkg_f',
          bestComfortId: 'pkg_c',
        },
        priceTimingNote: 'Prices look stable.',
        priceConfidence: 0.8,
        engineConfidence: 0.84,
      })

      expect(turn.enabled).toBe(true)
      expect(turn.recommendation.conciergeEnabled).toBe(true)
      expect(turn.recommendation.timeline?.stages.map((s) => s.id)).toEqual([
        'searching',
        'comparing',
        'ranking',
        'optimizing',
        'final_recommendation',
      ])
      expect(turn.recommendation.confidence?.level).toMatch(/high|medium|low/)
      expect(turn.recommendation.summary?.text).toMatch(/recommend/i)
      expect(turn.recommendation.alternatives.length).toBe(6)
      expect(turn.recommendation.comparisonCards.length).toBeGreaterThan(0)
      expect(turn.recommendation.suggestions.length).toBeGreaterThanOrEqual(6)
      expect(turn.recommendationFacts.length).toBeGreaterThan(0)
      expect(turn.meta?.conversationId).toBeTruthy()

      const conversation = turn.toConversationResponse('Here is your plan.')
      expect(conversation.reply).toBe('Here is your plan.')
      expect(conversation.recommendation.timeline).toBeTruthy()
      expect(conversation.conciergeMeta?.confidenceLevel).toBeTruthy()
    })
  })

  describe('null / empty data', () => {
    it('handles null offers without throwing', () => {
      const turn = integrateConciergeIntoTurn({
        memory: memoryWithTrip({ destination: null, budget: null }),
        flightOffers: null,
        hotelOffers: null,
        packageSelected: null,
        packageRanked: null,
        decision: null,
      })
      expect(turn.enabled).toBe(true)
      expect(turn.recommendation.conciergeEnabled).toBe(true)
      expect(turn.recommendation.alternatives.length).toBe(6)
      expect(turn.recommendation.suggestions.length).toBeGreaterThan(0)
    })

    it('serializers tolerate null result', () => {
      const rec = toRecommendationResponseDto(null, { enabled: true })
      expect(rec.conciergeEnabled).toBe(false)
      const conversation = toConversationResponseDto({
        reply: 'ok',
        result: null,
        enabled: true,
      })
      expect(conversation.recommendation.timeline).toBeNull()
      const trip = toTripResponseDto({
        tripId: 't1',
        destination: 'Dubai',
        result: null,
        enabled: false,
      })
      expect(trip.recommendation.conciergeEnabled).toBe(false)
      expect(trip.destination).toBe('Dubai')
    })
  })

  describe('low confidence', () => {
    it('exposes uncertainty explanation when confidence is low', () => {
      const turn = integrateConciergeIntoTurn({
        memory: memoryWithTrip({ destination: null }),
        engineConfidence: 0.1,
        flightOffers: [],
        hotelOffers: [],
      })
      expect(turn.recommendation.confidence?.level).toBe('low')
      expect(turn.recommendation.confidence?.uncertaintyExplanation).toMatch(/low/i)
    })
  })

  describe('package / hotel / flight recommendations', () => {
    it('maps package recommendations into offers adapter', () => {
      const offers = offersFromEngineSnapshots({
        packageSelected,
        packageRanked: [
          { ...packageSelected, id: 'pkg_2', labels: ['luxury'], title: 'Luxury Dubai' },
        ],
      })
      expect(offers.packages?.length).toBe(2)
      expect(offers.packages?.[0]?.title).toMatch(/balanced/i)
    })

    it('maps hotel recommendations', () => {
      const offers = offersFromEngineSnapshots({ hotelOffers: [hotelOffer] })
      expect(offers.hotels?.[0]?.name).toBe('Marina Hotel')
      expect(offers.hotels?.[0]?.stars).toBe(4)

      const turn = integrateConciergeIntoTurn({
        memory: memoryWithTrip(),
        hotelOffers: [hotelOffer],
      })
      expect(turn.recommendation.explanation).toMatch(/hotel|Dubai|recommend/i)
    })

    it('maps flight recommendations', () => {
      const offers = offersFromEngineSnapshots({ flightOffers: [flightOffer] })
      expect(offers.flights?.[0]?.airline).toBe('Saudia')
      expect(offers.flights?.[0]?.stops).toBe(0)

      const turn = integrateConciergeIntoTurn({
        memory: memoryWithTrip(),
        flightOffers: [flightOffer],
        decision: {
          explanation: 'Direct Saudia flight preferred',
          confidence: 0.9,
          bestOverallId: 'flt_1',
          fastestId: 'flt_1',
        },
      })
      expect(turn.recommendation.summary?.text).toMatch(/Dubai|recommend/i)
      expect(turn.recommendation.alternatives.some((a) => a.kind === 'fastest')).toBe(true)
    })
  })

  describe('trip response adapter', () => {
    it('builds TripResponseDto with recommendation payload', () => {
      const turn = integrateConciergeIntoTurn({
        memory: memoryWithTrip(),
        packageSelected,
      })
      const trip = turn.toTripResponse()
      expect(trip.destination).toBe('Dubai')
      expect(trip.origin).toBe('Riyadh')
      expect(trip.recommendation.comparisonCards.length).toBeGreaterThan(0)
      expect(trip.integrationVersion).toMatch(/concierge-integration/)
    })
  })
})
