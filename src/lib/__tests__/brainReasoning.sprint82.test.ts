/**
 * Sprint 82 — Rahhal Brain V2 Reasoning Engine tests.
 * Flag remains OFF; pipeline exercised with deps.enabled override only.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  BRAIN_V1_FEATURE_ID,
  createClarificationPlanner,
  createConversationPlanner,
  createEntityExtractor,
  createExplainabilityEngine,
  createMemoryManager,
  createRecommendationEngine,
  createConversationHistory,
  createSessionState,
  createToolDecisionEngine,
  createToolRegistry,
  runBrainV1Turn,
  type BrainV1Offer,
} from '../brain/v1'

const COMPLETE_FLIGHT =
  'flight to Morocco from Riyadh 2026-09-15 adults 2 budget 5000 SAR Saudia'

function sampleFlights(): BrainV1Offer[] {
  return [
    {
      id: 'cheap_long',
      kind: 'flight',
      title: 'Budget connection',
      price: 2000,
      currency: 'SAR',
      durationMinutes: 720,
      stops: 2,
      airline: 'OtherAir',
      refundable: false,
      qualityScore: 40,
    },
    {
      id: 'balanced',
      kind: 'flight',
      title: 'Saudia direct',
      price: 2020,
      currency: 'SAR',
      durationMinutes: 420,
      stops: 0,
      airline: 'Saudia',
      refundable: true,
      qualityScore: 85,
    },
  ]
}

describe('Sprint 82 — Brain V2 Reasoning', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
  })

  describe('feature isolation', () => {
    it('keeps ai.brain.v1 OFF and production-isolated', () => {
      expect(getFeatureRegistry().isEnabled(BRAIN_V1_FEATURE_ID)).toBe(false)
      const off = runBrainV1Turn({ text: COMPLETE_FLIGHT, candidateOffers: sampleFlights() })
      expect(off.enabled).toBe(false)
      expect(off.planner.currentGoal).toBe('idle')
    })
  })

  describe('multi-step reasoning', () => {
    it('executes the full internal reasoning chain', () => {
      const result = runBrainV1Turn(
        { text: COMPLETE_FLIGHT, candidateOffers: sampleFlights() },
        { enabled: true },
      )
      expect(result.reasoning.map((s) => s.id)).toEqual([
        'understand_request',
        'resolve_conversation_context',
        'load_memory',
        'detect_missing_information',
        'choose_tools',
        'collect_provider_results',
        'evaluate_results',
        'rank_offers',
        'explain_recommendation',
        'generate_natural_answer',
        'generate_booking_actions',
      ])
      expect(result.reasoning.every((s) => s.ok)).toBe(true)
      expect(result.collectedOffers.length).toBe(2)
      expect(result.bookingActions[0]?.type).toBe('prepare_booking')
    })
  })

  describe('conversation planner', () => {
    it('tracks goal, completed/remaining steps, and next action', () => {
      const planner = createConversationPlanner()
      const { plan, state } = planner.plan({
        intent: 'flight_search',
        missing: [],
        clarifications: [],
        tools: ['flights'],
        hasOffers: true,
      })
      expect(plan.kind).toBe('search')
      expect(state.currentGoal).toMatch(/flight/i)
      expect(state.completedSteps).toContain('rank_recommendations')
      expect(state.remainingSteps.length).toBeGreaterThanOrEqual(0)
      expect(state.nextAction.kind).toBe('recommend')
      expect(state.steps.length).toBe(10)
    })

    it('resumes after interruption', () => {
      const planner = createConversationPlanner()
      const first = planner.plan({
        intent: 'flight_search',
        missing: ['travel_dates'],
        clarifications: [{
          field: 'travel_dates',
          questionAr: 'متى؟',
          questionEn: 'When?',
          required: true,
        }],
        tools: ['none'],
      })
      const interrupted = planner.markInterrupted(first.state)
      expect(interrupted.interrupted).toBe(true)

      const resumed = planner.plan({
        intent: 'flight_search',
        missing: [],
        clarifications: [],
        tools: ['flights'],
        priorPlanner: interrupted,
        hasOffers: true,
      })
      expect(resumed.state.resumed).toBe(true)
      expect(resumed.state.continuationSummary).toMatch(/Resumed/i)
      expect(resumed.plan.kind).toBe('resume')
    })
  })

  describe('tool registry decision engine', () => {
    it('selects tools from registry without hardcoded switch-only mapping', () => {
      const registry = createToolRegistry()
      expect(registry.list().map((t) => t.id)).toEqual(
        expect.arrayContaining([
          'flights',
          'hotels',
          'packages',
          'maps',
          'weather',
          'visa',
          'payments',
          'knowledge',
          'external_api',
        ]),
      )

      const engine = createToolDecisionEngine(registry)
      expect(engine.select('flight_search', ['travel_dates'])).toEqual(['none'])
      expect(engine.select('flight_search', [])).toContain('flights')
      expect(engine.select('visa_question', [])).toContain('visa')
      expect(engine.select('travel_advice', [])).toContain('knowledge')
      expect(engine.select('budget_planning', [])).toEqual(
        expect.arrayContaining(['budget', 'knowledge']),
      )
    })

    it('supports registering a future external API tool', () => {
      const registry = createToolRegistry()
      registry.register({
        id: 'external_api',
        label: 'Partner API',
        description: 'Future partner',
        intents: ['price_prediction'],
        requiresCompleteTrip: false,
        external: true,
      })
      const engine = createToolDecisionEngine(registry)
      expect(engine.select('price_prediction', [])).toContain('external_api')
    })
  })

  describe('weighted recommendation ranking', () => {
    it('ranks with weighted score breakdown and overall score', () => {
      const ranked = createRecommendationEngine().rank(
        sampleFlights(),
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
          previousSelections: ['balanced'],
        }).getLongTermMemory(),
      )
      expect(ranked[0]?.id).toBe('balanced')
      expect(ranked[0]?.scoreBreakdown).toMatchObject({
        price: expect.any(Number),
        stops: expect.any(Number),
        travelTime: expect.any(Number),
        refundability: expect.any(Number),
        airlineQuality: expect.any(Number),
        hotelQuality: expect.any(Number),
        travelerPreferences: expect.any(Number),
        historicalChoices: expect.any(Number),
        overall: expect.any(Number),
      })
      expect(ranked[0]?.score).toBe(ranked[0]?.scoreBreakdown?.overall)
      expect((ranked[0]?.score ?? 0) > (ranked[1]?.score ?? 0)).toBe(true)
    })
  })

  describe('clarification engine', () => {
    it('asks only one question for Morocco destination-only', () => {
      const planner = createClarificationPlanner()
      const entities = createEntityExtractor().extract('I want to go to Morocco.')
      const { clarifications, missing } = planner.plan('flight_search', entities)
      expect(clarifications).toHaveLength(1)
      expect(clarifications[0]?.field).toBe('travel_dates')
      expect(clarifications[0]?.questionEn).toBe('When would you like to travel?')
      // Origin/travelers are deferred until dates are known (minimum path).
      expect(missing).toEqual(['travel_dates'])

      const turn = runBrainV1Turn(
        { text: 'I want to go to Morocco.', locale: 'en' },
        { enabled: true },
      )
      expect(turn.responseEn).toBe('When would you like to travel?')
      expect(turn.responseEn.toLowerCase()).not.toMatch(/budget|passengers|hotel|cabin/)
    })
  })

  describe('explainability', () => {
    it('explains why the top flight was chosen vs the alternative', () => {
      const explanation = createExplainabilityEngine().explain(
        createRecommendationEngine().rank(sampleFlights(), createEntityExtractor().extract('Saudia')),
      )
      expect(explanation).not.toBeNull()
      expect(explanation!.en.toLowerCase()).toMatch(/chose|because/)
      expect(explanation!.en).toMatch(/20 SAR|saves|hour/i)

      const turn = runBrainV1Turn(
        { text: COMPLETE_FLIGHT, candidateOffers: sampleFlights(), locale: 'en' },
        { enabled: true },
      )
      expect(turn.explanation?.en).toMatch(/chose|because/i)
      expect(turn.responseEn).toMatch(/chose|because|recommend/i)
    })
  })

  describe('memory usage', () => {
    it('exposes session, conversation, preference, and long-term interfaces', () => {
      const turn = runBrainV1Turn(
        {
          text: COMPLETE_FLIGHT,
          candidateOffers: sampleFlights(),
          longTerm: {
            favoriteAirlines: ['Saudia'],
            preferences: {
              cabinClass: 'economy',
              maxStops: 0,
              preferredAirlines: ['Saudia'],
              hotelStarMin: 4,
              refundablePreferred: true,
            },
            budgetPreferences: { typicalAmount: 4000, currency: 'SAR' },
          },
        },
        { enabled: true },
      )
      expect(turn.session.sessionId).toBeTruthy()
      expect(turn.conversation.recentIntents).toContain('flight_search')
      expect(turn.preferenceMemory.preferredAirlines).toContain('Saudia')
      expect(turn.preferenceMemory.typicalBudget).toBe(4000)
      expect(turn.reasoning.find((s) => s.id === 'load_memory')?.detail).toMatch(/preferredAirline|typicalBudget|cabin/)
    })
  })

  describe('recovery', () => {
    it('resumes an interrupted conversation using prior session state', () => {
      const first = runBrainV1Turn(
        { text: 'I want to go to Morocco.', locale: 'en', sessionId: 'recover-1' },
        { enabled: true },
      )
      expect(first.clarifications[0]?.field).toBe('travel_dates')

      const interruptedSession = {
        ...first.session,
        plannerState: createConversationPlanner().markInterrupted(first.planner),
        interruptedAt: new Date().toISOString(),
      }

      const second = runBrainV1Turn(
        {
          text: '2026-10-01 from Riyadh adults 2',
          locale: 'en',
          sessionId: 'recover-1',
          priorSession: interruptedSession,
          history: [
            { role: 'user', text: 'I want to go to Morocco.' },
            { role: 'assistant', text: first.responseEn },
          ],
          candidateOffers: sampleFlights(),
        },
        { enabled: true },
      )

      expect(second.planner.resumed).toBe(true)
      expect(second.entities.destination).toBe('Morocco')
      expect(second.entities.travelDates.start).toBe('2026-10-01')
      expect(second.entities.origin).toBe('Riyadh')
      expect(second.responseEn.toLowerCase()).toMatch(/continuing|recommend|chose/)
      expect(second.rankedOffers[0]?.id).toBeTruthy()
    })
  })
})
