/**
 * Sprint 85 — Conversation Manager (Value Before Questions) tests.
 * Flag OFF by default; exercised with deps.enabled override only.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { RECOVERY_TURN_OWNER } from '../recovery/freeze'
import {
  BRAIN_V1_FEATURE_ID,
  createConversationManager,
  createAssumptionEngine,
  normalizeToolMissingFields,
  pickSingleToolField,
  runConversationManagerTurn,
  runBrainV1Turn,
} from '../brain/v1'
import { emptyTravelPlanSlots } from '../brain/v1/planning/types'

describe('Sprint 85 — Value Before Questions', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
  })

  describe('feature / production isolation', () => {
    it('keeps ai.brain.v1 OFF and conversation is a no-op when disabled', () => {
      expect(getFeatureRegistry().isEnabled(BRAIN_V1_FEATURE_ID)).toBe(false)
      const result = runConversationManagerTurn({
        text: 'I want to travel to Morocco.',
      })
      expect(result.enabled).toBe(false)
      expect(result.session).toBeNull()
      expect(result.response).toBeNull()
      expect(runBrainV1Turn({ text: 'hi' }).enabled).toBe(false)
      expect(RECOVERY_TURN_OWNER).toBe('TravelBrain.processTurn')
    })
  })

  describe('Morocco — value before question', () => {
    it('returns immediate travel value before asking a high-impact question', () => {
      const result = runConversationManagerTurn(
        { text: 'I want to travel to Morocco.', locale: 'en' },
        { enabled: true },
      )
      expect(result.enabled).toBe(true)
      expect(result.response?.providedValue).toBe(true)
      expect(result.value.length).toBeGreaterThan(0)
      expect(result.response?.en.toLowerCase()).toMatch(/marrakech|agadir|casablanca|morocco/)
      expect(result.response?.questionCount).toBeLessThanOrEqual(1)
      // Must NOT be question-only (old form-like behavior).
      const onlyQuestion = /^when would you like to travel\??$/i.test(
        (result.response?.en ?? '').trim(),
      )
      expect(onlyQuestion).toBe(false)
      expect(result.response?.en.trim().endsWith('?')).toBe(true)
      expect(result.question?.slot).toBe('origin')
      expect(result.assumptions.some((a) => a.field === 'flexibleDates')).toBe(true)
      expect(result.assumptions.some((a) => a.field === 'budgetMode')).toBe(true)
    })

    it('Arabic-first Morocco reply is concise and natural (not robotic form language)', () => {
      const result = runConversationManagerTurn(
        { text: 'أريد السفر إلى المغرب', locale: 'ar' },
        { enabled: true },
      )
      expect(result.response?.providedValue).toBe(true)
      expect(result.response?.ar).toMatch(/مراكش|أكادير|الدار|تصور أولي|سأفترض/)
      expect(result.response?.ar).not.toMatch(/يرجى إدخال|الرجاء تعبئة|البيانات المطلوبة/)
      expect(result.response!.ar.length).toBeLessThan(700)
    })
  })

  describe('question budget', () => {
    it('asks at most one question per normal turn', () => {
      const result = runConversationManagerTurn(
        { text: 'I want to travel to Morocco.', locale: 'en' },
        { enabled: true },
      )
      expect(result.response?.questionCount).toBeLessThanOrEqual(1)
      expect((result.response?.en.match(/\?/g) ?? []).length).toBeLessThanOrEqual(1)
    })

    it('returns zero questions when enough information exists', () => {
      const result = runConversationManagerTurn(
        {
          text: 'flight to Morocco from Riyadh 2026-10-01 adults 2 budget 5000',
          locale: 'en',
        },
        { enabled: true },
      )
      expect(result.response?.questionCount).toBe(0)
      expect(result.question).toBeNull()
      expect(result.response?.providedValue).toBe(true)
    })
  })

  describe('no repeats / optional does not block', () => {
    it('does not re-ask a known departure city on resume', () => {
      const manager = createConversationManager()
      const first = manager.turn(
        { text: 'I want to travel to Morocco from Riyadh', locale: 'en' },
        { enabled: true },
      )
      expect(first.knownSlots?.origin).toBe('Riyadh')
      const resumed = manager.turn(
        {
          text: 'continue',
          locale: 'en',
          priorSession: first.session,
          resume: true,
        },
        { enabled: true },
      )
      expect(resumed.question?.slot).not.toBe('origin')
      expect(resumed.knownSlots?.destination).toBe('Morocco')
    })

    it('optional hotel preference does not block preliminary recommendations', () => {
      const result = runConversationManagerTurn(
        { text: 'I want to travel to Morocco.', locale: 'en' },
        { enabled: true },
      )
      expect(result.response?.providedValue).toBe(true)
      expect(result.question?.slot).not.toBe('hotelPreference')
      expect(result.question?.slot).not.toBe('activities')
      expect(result.question?.slot).not.toBe('cabin')
    })
  })

  describe('assumptions', () => {
    it('stores safe assumptions as assumptions, not confirmed facts', () => {
      const result = runConversationManagerTurn(
        { text: 'I want to travel to Morocco.', locale: 'en' },
        { enabled: true },
      )
      const adults = result.assumptions.find((a) => a.field === 'adults')
      expect(adults?.assumedValue).toBe(1)
      expect(adults?.reversible).toBe(true)
      expect(adults?.requiresConfirmationBeforeBooking).toBe(true)
      // Confirmed slots on plan must not treat assumed adults as answered.
      expect(result.session?.answeredSlots).not.toContain('adults')
      expect(result.knownSlots?.adults).toBeNull()
    })

    it('user correction replaces an assumption and preserves unrelated state', () => {
      const manager = createConversationManager()
      const first = manager.turn(
        { text: 'I want to travel to Morocco.', locale: 'en' },
        { enabled: true },
      )
      const planId = first.session?.plan?.planId
      const second = manager.turn(
        {
          text: 'We are two adults and one child.',
          locale: 'en',
          priorSession: first.session,
        },
        { enabled: true },
      )
      expect(second.knownSlots?.destination).toBe('Morocco')
      expect(second.knownSlots?.adults).toBe(2)
      expect(second.knownSlots?.children).toBe(1)
      expect(second.assumptions.find((a) => a.field === 'adults')).toBeUndefined()
      expect(second.session?.plan?.planId).toBe(planId)
      expect(second.revisedSlots).toEqual(expect.arrayContaining(['adults', 'children']))
    })
  })

  describe('blocking booking field', () => {
    it('triggers exactly one blocking question for a mandatory booking field', () => {
      const result = runConversationManagerTurn(
        {
          text: 'book this option',
          locale: 'en',
          stage: 'booking',
          priorSession: runConversationManagerTurn(
            {
              text: 'to Morocco from Riyadh 2026-10-01 adults 2',
              locale: 'en',
            },
            { enabled: true },
          ).session,
          blockingFields: [{
            field: 'passport',
            reason: 'Required before ticket issuance',
            questionAr: 'ما الاسم الكامل كما في جواز السفر؟',
            questionEn: 'What is the traveler full name as on the passport?',
          }],
        },
        { enabled: true },
      )
      expect(result.question?.tier).toBe('blocking')
      expect(result.question?.slot).toBe('passport')
      expect(result.response?.questionCount).toBe(1)
    })
  })

  describe('confidence', () => {
    it('low confidence still produces bounded value plus at most one question', () => {
      const result = runConversationManagerTurn(
        { text: 'maybe Morocco? not sure', locale: 'en' },
        { enabled: true },
      )
      expect(result.confidence?.band).toMatch(/medium|low_safe|high/)
      expect(result.response?.providedValue).toBe(true)
      expect(result.response?.questionCount).toBeLessThanOrEqual(1)
    })
  })

  describe('tool missing fields', () => {
    it('does not turn tool missing fields into a questionnaire', () => {
      const fields = normalizeToolMissingFields([
        'origin',
        'hotelPreference',
        'activities',
        'cabin',
        'dates',
      ])
      expect(pickSingleToolField(fields)?.field).toBe('origin')
      const result = runConversationManagerTurn(
        {
          text: 'I want to travel to Morocco.',
          locale: 'en',
          toolMissingFields: fields,
        },
        { enabled: true },
      )
      expect(result.response?.questionCount).toBeLessThanOrEqual(1)
      expect(result.question?.slot).not.toBe('hotelPreference')
      expect(result.question?.slot).not.toBe('activities')
    })
  })

  describe('no live fabrication', () => {
    it('labels value as preliminary and does not invent live prices', () => {
      const result = runConversationManagerTurn(
        { text: 'I want to travel to Morocco.', locale: 'en' },
        { enabled: true },
      )
      expect(result.value.every((v) => v.preliminary === true)).toBe(true)
      expect(result.response?.en.toLowerCase()).toMatch(/preliminary|indicative|assuming|mid-range|flexible/)
      expect(result.response?.en).not.toMatch(/\$\d{3,}|\d{4}\s*SAR available now/i)
    })
  })

  describe('assumption engine unit', () => {
    it('never invents sensitive visa/payment assumptions', () => {
      const assumptions = createAssumptionEngine().infer({
        slots: { ...emptyTravelPlanSlots(), destination: 'Morocco' },
        answered: ['destination'],
      })
      expect(assumptions.some((a) => a.field === 'visa')).toBe(false)
      expect(assumptions.some((a) => a.field === 'payment')).toBe(false)
      expect(assumptions.some((a) => a.field === 'passport')).toBe(false)
    })
  })
})
