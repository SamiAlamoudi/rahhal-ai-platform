/**
 * Sprint 87 — Live Brain Experience (Preview Only) tests.
 * Conversation quality: value-first, memory, incremental planning, clarification budget, fallback.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import {
  BRAIN_V1_PREVIEW_FEATURE_ID,
  createConversationManager,
  createTravelReasoner,
  emptyPlannerState,
  getDestinationInsight,
  indicativeBudgetForSlots,
  inferTripStyle,
  routeBrainPreviewTurn,
  runConversationManagerTurn,
} from '../brain/v1'
import { emptyTravelPlanSlots } from '../brain/v1/planning/types'
import { emptyMemory } from '../agent/types'
import { getFeatureRegistry } from '../ai'
import { RECOVERY_TURN_OWNER } from '../recovery/freeze'

function enablePreviewForTests() {
  return {
    enabled: true as const,
    bypassDeployGateForTests: true as const,
  }
}

describe('Sprint 87 — Live Brain Experience', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
  })

  describe('production isolation', () => {
    it('keeps preview OFF by default and does not touch production turn owner', () => {
      expect(getFeatureRegistry().isEnabled(BRAIN_V1_PREVIEW_FEATURE_ID)).toBe(false)
      expect(RECOVERY_TURN_OWNER).toBe('TravelBrain.processTurn')
      const decision = routeBrainPreviewTurn({
        userText: 'Morocco',
        locale: 'en',
        conversationId: 'c1',
        messages: [],
        memory: emptyMemory('ar'),
      })
      expect(decision.path).toBe('current')
    })
  })

  describe('Scenario 1 — Morocco value first', () => {
    it('recommends cities, season, budget, duration, itinerary before one question', () => {
      const result = runConversationManagerTurn(
        { text: 'I want to travel to Morocco.', locale: 'en' },
        { enabled: true },
      )
      expect(result.response?.providedValue).toBe(true)
      expect(result.response?.questionCount).toBeLessThanOrEqual(1)
      const en = result.response?.en ?? ''
      expect(en.toLowerCase()).toMatch(/marrakech/)
      expect(en.toLowerCase()).toMatch(/agadir|casablanca/)
      expect(en.toLowerCase()).toMatch(/spring|autumn|season|mar–may|sep–nov/)
      expect(en.toLowerCase()).toMatch(/sar|budget|indicative|preliminary/)
      expect(en.toLowerCase()).toMatch(/day/)
      expect(en.trim().endsWith('?')).toBe(true)
      expect(/^when would you like to travel\??$/i.test(en.trim())).toBe(false)
      expect(result.value.some((v) => v.kind === 'estimate')).toBe(true)
      expect(result.value.some((v) => v.kind === 'itinerary_direction')).toBe(true)
    })
  })

  describe('Scenario 2 — Japan', () => {
    it('delivers Japan-specific reasoning with one-question policy', () => {
      const result = runConversationManagerTurn(
        { text: 'Japan', locale: 'en' },
        { enabled: true },
      )
      expect(result.knownSlots?.destination).toBe('Japan')
      expect(result.response?.providedValue).toBe(true)
      expect(result.response?.en.toLowerCase()).toMatch(/tokyo|kyoto|japan/)
      expect(result.response?.questionCount).toBeLessThanOrEqual(1)
      expect(getDestinationInsight('Japan')?.destinationKey).toBe('japan')
    })
  })

  describe('Scenario 3 — Business trip London', () => {
    it('infers business style and keeps memory tags', () => {
      const result = runConversationManagerTurn(
        { text: 'Business trip London', locale: 'en' },
        { enabled: true },
      )
      expect(result.knownSlots?.destination).toBe('London')
      expect(result.knownSlots?.specialRequests).toMatch(/tripStyle=business/)
      expect(result.response?.providedValue).toBe(true)
      expect(result.response?.en.toLowerCase()).toMatch(/meeting|business|london/)
      expect(result.response?.questionCount).toBeLessThanOrEqual(1)
      expect(inferTripStyle({ specialRequests: result.knownSlots?.specialRequests })).toBe('business')
    })
  })

  describe('Scenario 4 — Weekend Dubai', () => {
    it('shapes a short weekend plan without a questionnaire', () => {
      const result = runConversationManagerTurn(
        { text: 'Weekend Dubai', locale: 'en' },
        { enabled: true },
      )
      expect(result.knownSlots?.destination).toBe('Dubai')
      expect(result.knownSlots?.specialRequests).toMatch(/tripStyle=weekend/)
      expect(result.response?.providedValue).toBe(true)
      expect(result.response?.en.toLowerCase()).toMatch(/dubai|weekend|2–3|2-3|short/)
      expect(result.response?.questionCount).toBeLessThanOrEqual(1)
    })
  })

  describe('Scenario 5 — Family Switzerland', () => {
    it('applies family reasoning and memory', () => {
      const result = runConversationManagerTurn(
        { text: 'Family Switzerland', locale: 'en' },
        { enabled: true },
      )
      expect(result.knownSlots?.destination).toBe('Switzerland')
      expect(result.knownSlots?.specialRequests).toMatch(/tripStyle=family/)
      expect(result.response?.providedValue).toBe(true)
      expect(result.response?.en.toLowerCase()).toMatch(/family|switzerland|zurich|interlaken|lake/)
      expect(result.response?.questionCount).toBeLessThanOrEqual(1)
    })
  })

  describe('incremental planning', () => {
    it('Morocco → Agadir updates only destination focus', () => {
      const manager = createConversationManager()
      const first = manager.turn(
        { text: 'I want to travel to Morocco.', locale: 'en' },
        { enabled: true },
      )
      const planId = first.session?.plan?.planId
      const second = manager.turn(
        {
          text: 'Actually make it Agadir',
          locale: 'en',
          priorSession: first.session,
        },
        { enabled: true },
      )
      expect(second.knownSlots?.destination).toBe('Agadir')
      expect(second.session?.plan?.planId).toBe(planId)
      expect(second.revisedSlots).toEqual(expect.arrayContaining(['destination']))
      expect(second.revisedSlots).not.toEqual(
        expect.arrayContaining(['origin', 'budget', 'adults']),
      )
      expect(second.response?.tone).toBe('revise')
      expect(second.response?.en.toLowerCase()).toMatch(/agadir|affected/)
      expect(second.response?.questionCount).toBeLessThanOrEqual(1)
      // Does not re-ask destination.
      expect(second.question?.slot).not.toBe('destination')
    })
  })

  describe('conversation memory fields', () => {
    it('merges only affected memory fields across turns', () => {
      const manager = createConversationManager()
      const t1 = manager.turn(
        { text: 'Morocco', locale: 'en' },
        { enabled: true },
      )
      const t2 = manager.turn(
        {
          text: 'from Riyadh, 4-star hotel, halal food, train transport, budget 8000 SAR',
          locale: 'en',
          priorSession: t1.session,
        },
        { enabled: true },
      )
      expect(t2.knownSlots?.destination).toBe('Morocco')
      expect(t2.knownSlots?.origin).toBe('Riyadh')
      expect(t2.knownSlots?.hotelPreference).toMatch(/4-star/)
      expect(t2.knownSlots?.budget).toBe(8000)
      expect(t2.knownSlots?.transportation).toBe('train')
      expect(t2.knownSlots?.specialRequests).toMatch(/food=halal/)
      expect(t2.knownSlots?.specialRequests).toMatch(/transport=train|hotelLevel=4-star/)

      const t3 = manager.turn(
        {
          text: 'visa please',
          locale: 'en',
          priorSession: t2.session,
        },
        { enabled: true },
      )
      expect(t3.knownSlots?.destination).toBe('Morocco')
      expect(t3.knownSlots?.origin).toBe('Riyadh')
      expect(t3.knownSlots?.budget).toBe(8000)
      expect(t3.knownSlots?.visa).toBe('Morocco')
      expect(t3.knownSlots?.specialRequests).toMatch(/visaInterest=true/)
    })
  })

  describe('clarification budget', () => {
    it('never exceeds one question even with many gaps', () => {
      const result = runConversationManagerTurn(
        { text: 'Japan', locale: 'en' },
        { enabled: true },
      )
      expect(result.response?.questionCount).toBeLessThanOrEqual(1)
      expect((result.response?.en.match(/\?/g) ?? []).length).toBeLessThanOrEqual(1)
    })
  })

  describe('travel reasoner connection', () => {
    it('emits destination and trip-style reasoning without hardcoded user replies', () => {
      const reasoner = createTravelReasoner()
      const slots = {
        ...emptyTravelPlanSlots(),
        destination: 'Dubai',
        specialRequests: 'tripStyle=weekend|duration=3',
      }
      const steps = reasoner.reason({
        intent: 'weekend_trip',
        entities: {
          destination: 'Dubai',
          origin: null,
          travelDates: { start: null, end: null },
          flexibleDates: true,
          travelerCount: null,
          adults: null,
          children: null,
          infants: null,
          budget: null,
          cabinClass: null,
          preferredAirline: null,
          hotelRating: null,
          starLevel: null,
          mealPreference: null,
          activities: [],
          transportation: null,
          language: null,
          currency: null,
          nationality: null,
          visaDestination: null,
        },
        missing: ['origin'],
        tools: ['none'],
        collected: [],
        ranked: [],
        explanation: null,
        planner: emptyPlannerState(),
        preferenceMemory: {
          cabinClass: null,
          maxStops: null,
          preferredAirlines: [],
          hotelStarMin: null,
          refundablePreferred: false,
          currency: null,
          typicalBudget: null,
        },
        bookingActionCount: 0,
        planSlots: slots,
      })
      expect(steps.some((s) => s.id === 'destination_reasoning' && /dubai/i.test(s.detail))).toBe(true)
      expect(steps.some((s) => s.id === 'trip_style_reasoning' && /weekend/.test(s.detail))).toBe(true)
      const budget = indicativeBudgetForSlots(slots)
      expect(budget?.currency).toBe('SAR')
      expect(budget?.noteEn).toMatch(/not a live quote/i)
    })
  })

  describe('preview router fallback', () => {
    it('falls back silently when Brain throws', () => {
      const decision = routeBrainPreviewTurn({
        userText: 'Morocco',
        locale: 'en',
        conversationId: 'c1',
        messages: [],
        memory: emptyMemory('ar'),
        ...enablePreviewForTests(),
        runBrain: () => {
          throw new Error('boom')
        },
      })
      expect(decision.path).toBe('fallback')
      if (decision.path === 'fallback') {
        expect(decision.reason).toMatch(/exception/)
      }
    })

    it('routes successful Morocco turn through Brain when preview enabled', () => {
      const decision = routeBrainPreviewTurn({
        userText: 'I want to travel to Morocco.',
        locale: 'en',
        conversationId: 'c1',
        messages: [],
        memory: emptyMemory('en'),
        ...enablePreviewForTests(),
      })
      expect(decision.path).toBe('brain')
      if (decision.path === 'brain') {
        expect(decision.result.reply.toLowerCase()).toMatch(/marrakech|morocco/)
        expect(decision.result.meta.brainV1Preview?.providedValue).toBe(true)
        expect(decision.result.meta.brainV1Preview?.questionCount).toBeLessThanOrEqual(1)
        expect(decision.result.memory.requirements.destination).toBe('Morocco')
      }
    })
  })

  describe('never ask known information', () => {
    it('does not re-ask origin after it is known', () => {
      const manager = createConversationManager()
      const first = manager.turn(
        { text: 'Morocco from Riyadh', locale: 'en' },
        { enabled: true },
      )
      expect(first.knownSlots?.origin).toBe('Riyadh')
      const second = manager.turn(
        {
          text: 'Actually make it Agadir',
          locale: 'en',
          priorSession: first.session,
        },
        { enabled: true },
      )
      expect(second.knownSlots?.destination).toBe('Agadir')
      expect(second.knownSlots?.origin).toBe('Riyadh')
      expect(second.question?.slot).not.toBe('origin')
    })
  })
})
