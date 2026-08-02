/**
 * Sprint 81 — Rahhal AI Brain Foundation (Phase 1) architecture tests.
 * Updated for Sprint 82 clarification order + reasoning step ids.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { RECOVERY_FROZEN_OFF_FLAGS, RECOVERY_TURN_OWNER } from '../recovery/freeze'
import {
  BRAIN_V1_FEATURE_ID,
  BRAIN_V1_VERSION,
  createClarificationPlanner,
  createEntityExtractor,
  createIntentDetector,
  createMemoryManager,
  createRecommendationEngine,
  createConversationHistory,
  createSessionState,
  isBrainV1Enabled,
  runBrainV1Turn,
  type BrainV1Offer,
} from '../brain/v1'

describe('Sprint 81 — Brain Foundation v1', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
  })

  describe('architecture / feature flag', () => {
    it('registers ai.brain.v1 OFF by default and frozen for product traffic', () => {
      expect(BRAIN_V1_FEATURE_ID).toBe('ai.brain.v1')
      expect(getFeatureRegistry().isEnabled(BRAIN_V1_FEATURE_ID)).toBe(false)
      expect(isBrainV1Enabled()).toBe(false)
      expect(RECOVERY_FROZEN_OFF_FLAGS).toContain('ai.brain.v1')
      expect(RECOVERY_TURN_OWNER).toBe('TravelBrain.processTurn')
      expect(BRAIN_V1_VERSION).toMatch(/brain-v2-reasoning|brain-v1/)
    })

    it('is a no-op when flag is OFF', () => {
      const result = runBrainV1Turn({ text: 'أريد السفر إلى المغرب' })
      expect(result.enabled).toBe(false)
      expect(result.responseAr).toBe('')
      expect(result.reasoning).toEqual([])
      expect(result.safetyNotes).toContain('ai.brain.v1 disabled')
    })

    it('does not collide with production ai.rahhal_brain default', () => {
      expect(getFeatureRegistry().isEnabled('ai.rahhal_brain')).toBe(true)
      expect(getFeatureRegistry().isEnabled('ai.brain.v1')).toBe(false)
    })
  })

  describe('intent detection', () => {
    const detector = createIntentDetector()

    it('detects required intent categories', () => {
      expect(detector.detect('I need a flight to Dubai').intent).toBe('flight_search')
      expect(detector.detect('ابحث لي عن فندق في باريس').intent).toBe('hotel_search')
      expect(detector.detect('package flight hotel Morocco').intent).toBe('package_search')
      expect(detector.detect('multi-city trip Tokyo then Osaka').intent).toBe('multi_city_trip')
      expect(detector.detect('business travel to London').intent).toBe('business_travel')
      expect(detector.detect('family vacation with kids').intent).toBe('family_vacation')
      expect(detector.detect('weekend trip from Friday').intent).toBe('weekend_trip')
      expect(detector.detect('do I need a visa for Japan').intent).toBe('visa_question')
      expect(detector.detect('budget planning for my trip').intent).toBe('budget_planning')
      expect(detector.detect('where should I travel').intent).toBe('travel_advice')
      expect(detector.detect('modify my booking please').intent).toBe('booking_modification')
      expect(detector.detect('cancel my booking').intent).toBe('cancellation')
      expect(detector.detect('compare flight prices').intent).toBe('price_comparison')
      expect(detector.detect('price prediction for summer').intent).toBe('price_prediction')
      expect(detector.detect('مرحبا').intent).toBe('general_conversation')
    })
  })

  describe('entity extraction', () => {
    const extractor = createEntityExtractor()

    it('extracts core travel entities', () => {
      const entities = extractor.extract(
        'من الرياض إلى المغرب 2026-09-15 adults 2 children 1 budget 8000 SAR business Saudia 4 stars beach',
      )
      expect(entities.origin).toBe('Riyadh')
      expect(entities.destination).toBe('Morocco')
      expect(entities.travelDates.start).toBe('2026-09-15')
      expect(entities.adults).toBe(2)
      expect(entities.children).toBe(1)
      expect(entities.budget).toBe(8000)
      expect(entities.currency).toBe('SAR')
      expect(entities.cabinClass).toBe('business')
      expect(entities.preferredAirline).toBe('Saudia')
      expect(entities.starLevel).toBe(4)
      expect(entities.activities).toContain('beach')
    })
  })

  describe('memory separation', () => {
    it('keeps session, conversation, and long-term memory distinct', () => {
      const session = createSessionState('s1')
      const history = createConversationHistory([{ role: 'user', text: 'hello' }])
      const memory = createMemoryManager(session, history, {
        favoriteAirlines: ['Saudia'],
        preferences: {
          cabinClass: 'business',
          maxStops: 1,
          preferredAirlines: ['Saudia'],
          hotelStarMin: 4,
          refundablePreferred: true,
        },
      })
      memory.rememberIntent('flight_search')
      memory.setPendingClarification('travel_dates')

      expect(memory.getSessionMemory().sessionId).toBe('s1')
      expect(memory.getConversationMemory().recentIntents).toEqual(['flight_search'])
      expect(memory.getConversationMemory().pendingClarification).toBe('travel_dates')
      expect(memory.getLongTermMemory().favoriteAirlines).toEqual(['Saudia'])
      expect(memory.getLongTermMemory().preferences.cabinClass).toBe('business')
      expect(memory.getPreferenceMemory().preferredAirlines).toContain('Saudia')
    })
  })

  describe('clarification strategy', () => {
    it('asks only the minimum next question', () => {
      const planner = createClarificationPlanner()
      const entities = createEntityExtractor().extract('أريد السفر إلى المغرب')
      const { clarifications, missing } = planner.plan('flight_search', entities)
      expect(missing.length).toBeGreaterThan(0)
      expect(clarifications).toHaveLength(1)
      expect(clarifications[0]?.field).toBe('travel_dates')
      expect(clarifications[0]?.questionEn.toLowerCase()).not.toMatch(/budget.*cabin.*airline/)
    })

    it('asks when for destination-only Morocco example', () => {
      const planner = createClarificationPlanner()
      const entities = createEntityExtractor().extract('I want to travel to Morocco')
      const { clarifications } = planner.plan('flight_search', entities)
      expect(clarifications).toHaveLength(1)
      expect(clarifications[0]?.field).toBe('travel_dates')
      expect(clarifications[0]?.questionEn).toMatch(/when/i)
    })
  })

  describe('reasoning + recommendation', () => {
    it('emits structured reasoning steps and ranks offers', () => {
      const offers: BrainV1Offer[] = [
        {
          id: 'f_expensive',
          kind: 'flight',
          title: 'SV expensive',
          price: 9000,
          currency: 'SAR',
          durationMinutes: 600,
          stops: 2,
          airline: 'Other',
          refundable: false,
        },
        {
          id: 'f_best',
          kind: 'flight',
          title: 'SV best',
          price: 2200,
          currency: 'SAR',
          durationMinutes: 360,
          stops: 0,
          airline: 'Saudia',
          refundable: true,
        },
      ]
      const ranked = createRecommendationEngine().rank(
        offers,
        createEntityExtractor().extract('budget 5000 SAR Saudia'),
        createMemoryManager(createSessionState(), createConversationHistory(), {
          favoriteAirlines: ['Saudia'],
          preferences: {
            cabinClass: null,
            maxStops: 0,
            preferredAirlines: ['Saudia'],
            hotelStarMin: null,
            refundablePreferred: true,
          },
        }).getLongTermMemory(),
      )
      expect(ranked[0]?.id).toBe('f_best')
      expect((ranked[0]?.score ?? 0) > (ranked[1]?.score ?? 0)).toBe(true)
      expect(ranked[0]?.scoreBreakdown?.overall).toBe(ranked[0]?.score)

      const result = runBrainV1Turn(
        {
          text: 'flight to Morocco from Riyadh 2026-09-15 adults 2 budget 5000 SAR',
          candidateOffers: offers,
        },
        { enabled: true },
      )
      expect(result.enabled).toBe(true)
      expect(result.reasoning.map((s) => s.id)).toEqual([
        'understand_request',
        'resolve_conversation_context',
        'load_memory',
        'destination_reasoning',
        'trip_style_reasoning',
        'detect_missing_information',
        'choose_tools',
        'collect_provider_results',
        'evaluate_results',
        'rank_offers',
        'explain_recommendation',
        'generate_natural_answer',
        'generate_booking_actions',
      ])
      expect(result.rankedOffers[0]?.id).toBe('f_best')
      expect(result.tools).toContain('flights')
      expect(result.safe).toBe(true)
      expect(result.bookingActions[0]?.type).toBe('prepare_booking')
    })
  })

  describe('pipeline when enabled', () => {
    it('returns clarification-only response for incomplete trip request', () => {
      const result = runBrainV1Turn(
        { text: 'I want to travel to Morocco.', locale: 'en' },
        { enabled: true },
      )
      expect(result.enabled).toBe(true)
      expect(result.intent.intent).toBe('flight_search')
      expect(result.entities.destination).toBe('Morocco')
      expect(result.clarifications).toHaveLength(1)
      expect(result.clarifications[0]?.field).toBe('travel_dates')
      expect(result.responseEn).toMatch(/when/i)
      expect(result.tools).toEqual(['none'])
    })
  })
})
