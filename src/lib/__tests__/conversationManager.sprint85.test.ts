/**
 * Sprint 85 — Conversation Manager & Response Generator tests.
 * Flag OFF by default; exercised with deps.enabled override only.
 * No UI / Voice / providers / booking.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  BRAIN_V1_FEATURE_ID,
  createConversationManager,
  createQuestionGenerator,
  runConversationManagerTurn,
} from '../brain/v1'

describe('Sprint 85 — Conversation Manager & Response Generator', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
  })

  describe('feature isolation', () => {
    it('keeps ai.brain.v1 OFF and no-ops when disabled', () => {
      expect(getFeatureRegistry().isEnabled(BRAIN_V1_FEATURE_ID)).toBe(false)
      const result = runConversationManagerTurn({
        text: 'I want to travel to Morocco.',
      })
      expect(result.enabled).toBe(false)
      expect(result.session).toBeNull()
      expect(result.response).toBeNull()
    })
  })

  describe('conversation lifecycle', () => {
    it('collects Morocco destination and waits for one dates question', () => {
      const result = runConversationManagerTurn(
        { text: 'I want to travel to Morocco.', locale: 'en' },
        { enabled: true },
      )
      expect(result.enabled).toBe(true)
      expect(result.session?.state).toBe('waiting_user')
      expect(result.knownSlots?.destination).toBe('Morocco')
      expect(result.session?.completedSlots).toContain('destination')
      expect(result.session?.pendingSlots).toContain('dates')
      expect(result.question?.slot).toBe('dates')
      expect(result.response?.en).toMatch(/When would you like to travel/i)
      expect(result.response?.ar.length).toBeGreaterThan(0)
    })
  })

  describe('question selection', () => {
    it('asks exactly one highest-priority missing question', () => {
      const q = createQuestionGenerator().next(['budget', 'dates', 'adults', 'origin'])
      expect(q?.slot).toBe('dates')
      const turn = runConversationManagerTurn(
        { text: 'I want to go to Morocco.', locale: 'en' },
        { enabled: true },
      )
      expect(turn.question).not.toBeNull()
      expect(turn.question?.slot).toBe('dates')
      expect(turn.response?.en.toLowerCase()).not.toMatch(/budget.*cabin|passengers.*hotel/)
    })
  })

  describe('resume + interrupt', () => {
    it('pauses and resumes without losing known slots', () => {
      const manager = createConversationManager()
      const first = manager.turn(
        { text: 'I want to travel to Morocco.', locale: 'en' },
        { enabled: true },
      )
      expect(first.knownSlots?.destination).toBe('Morocco')

      const paused = manager.turn(
        { text: 'pause', locale: 'en', priorSession: first.session, pause: true },
        { enabled: true },
      )
      expect(paused.session?.state).toBe('paused')
      expect(paused.response?.tone).toBe('pause')

      const resumed = manager.turn(
        {
          text: 'continue',
          locale: 'en',
          priorSession: paused.session,
          resume: true,
        },
        { enabled: true },
      )
      expect(resumed.session?.state).toMatch(/resumed|waiting_user|collecting/)
      expect(resumed.knownSlots?.destination).toBe('Morocco')
      expect(resumed.response?.en.toLowerCase()).toMatch(/welcome back|when|continuing/)
    })

    it('handles topic switch and keeps previous goal', () => {
      const manager = createConversationManager()
      const first = manager.turn(
        { text: 'I want to travel to Morocco.', locale: 'en' },
        { enabled: true },
      )
      const switched = manager.turn(
        {
          text: 'actually let us change topic',
          locale: 'en',
          priorSession: first.session,
        },
        { enabled: true },
      )
      expect(switched.session?.previousGoalLabel).toMatch(/Morocco/i)
      expect(switched.session?.state).toBe('topic_switch')
      expect(switched.response?.en.toLowerCase()).toMatch(/switching topics|previous goal/)
    })
  })

  describe('plan revision', () => {
    it('updates only affected parts when destination changes', () => {
      const manager = createConversationManager()
      const ready = manager.turn(
        {
          text: 'to Morocco from Riyadh 2026-10-01 adults 2 budget 5000',
          locale: 'en',
        },
        { enabled: true },
      )
      expect(ready.session?.pendingSlots ?? []).toEqual([])
      const planId = ready.session?.plan?.planId

      const revised = manager.turn(
        {
          text: 'actually change destination to Dubai',
          locale: 'en',
          priorSession: ready.session,
        },
        { enabled: true },
      )
      expect(revised.revisedSlots).toContain('destination')
      expect(revised.knownSlots?.destination).toBe('Dubai')
      expect(revised.knownSlots?.origin).toBe('Riyadh')
      expect(revised.knownSlots?.adults).toBe(2)
      expect(revised.session?.plan?.planId).toBe(planId)
      expect(revised.response?.tone).toMatch(/revise|summary|friendly|clarify/)
    })
  })

  describe('summary generation', () => {
    it('builds goal / known / remaining / recommendations summary', () => {
      const result = runConversationManagerTurn(
        {
          text: 'I want to travel to Morocco.',
          locale: 'en',
          recommendations: ['Consider a 4-night Marrakech stay'],
        },
        { enabled: true },
      )
      expect(result.summary?.currentGoal).toMatch(/Morocco/i)
      expect(result.summary?.knownInformation.some((k) => k.slot === 'destination')).toBe(true)
      expect(result.summary?.remainingQuestions).toContain('dates')
      expect(result.summary?.currentRecommendations[0]).toMatch(/Marrakech/)
      expect(result.summary?.textEn).toMatch(/Goal:|Known:|Remaining:/)
      expect(result.summary?.textAr.length).toBeGreaterThan(0)
    })
  })

  describe('response generation', () => {
    it('returns short friendly Arabic-first bilingual responses', () => {
      const result = runConversationManagerTurn(
        { text: 'أريد السفر إلى المغرب', locale: 'ar' },
        { enabled: true },
      )
      expect(result.response?.ar).toBeTruthy()
      expect(result.response?.en).toBeTruthy()
      expect(result.response?.ar.length).toBeLessThan(180)
      expect(result.response?.tone).toMatch(/clarify|friendly|resume|revise|summary/)
    })
  })

  describe('explainability', () => {
    it('explains why the question was asked and what is missing', () => {
      const result = runConversationManagerTurn(
        {
          text: 'I want to travel to Morocco.',
          locale: 'en',
          recommendations: ['Nonstop morning flight looks strong'],
        },
        { enabled: true },
      )
      expect(result.explanation?.whyQuestionEn).toMatch(/dates|schedule/i)
      expect(result.explanation?.missingEn).toMatch(/dates/)
      expect(result.explanation?.whyRecommendationEn).toMatch(/Nonstop|because/i)
      expect(result.question?.whyEn.length).toBeGreaterThan(10)
    })
  })

  describe('confidence', () => {
    it('tracks confidence and can request clarification when low', () => {
      const result = runConversationManagerTurn(
        { text: 'maybe Morocco? not sure', locale: 'en' },
        { enabled: true },
      )
      expect(result.confidence).not.toBeNull()
      expect(result.confidence!.overall).toBeGreaterThan(0)
      expect(result.confidence!.intent).toBeGreaterThanOrEqual(0)
      expect(result.confidence!.entities).toBeGreaterThanOrEqual(0)
      expect(result.confidence!.slots).toBeGreaterThanOrEqual(0)
      // Ambiguous phrasing should lower confidence / need clarify path while pending.
      expect(
        result.confidence!.lowConfidence
        || result.confidence!.needsClarification
        || result.question?.slot === 'dates',
      ).toBe(true)
    })
  })

  describe('clarification policy', () => {
    it('never repeats an already answered destination question', () => {
      const manager = createConversationManager()
      const first = manager.turn(
        { text: 'I want to travel to Morocco.', locale: 'en' },
        { enabled: true },
      )
      const second = manager.turn(
        {
          text: '2026-10-01',
          locale: 'en',
          priorSession: first.session,
        },
        { enabled: true },
      )
      expect(second.question?.slot).not.toBe('destination')
      expect(second.session?.answeredSlots).toContain('destination')
      expect(second.session?.answeredSlots).toContain('dates')
    })
  })
})
