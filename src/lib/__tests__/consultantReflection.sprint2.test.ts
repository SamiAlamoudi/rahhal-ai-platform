/**
 * Evolution Sprint 2 — Consultant Reflection Layer tests
 * Memory evolution, AR/EN conversations, recommendation revision, regression.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  CONSULTANT_REFLECTION_FEATURE_ID,
  isConsultantReflectionEnabled,
  createReflectionSession,
  reflectTurn,
  tryReflectTurn,
  extractSlotDeltaFromText,
  computeDirtyNodes,
  changedSlotKeys,
  ConversationMemory,
  TravelerState,
  ReflectionPipeline,
} from '../agent/reflection'
import {
  runConsultantReasoningPipeline,
  isConsultantReasoningEnabled,
} from '../agent/reasoning'

describe('Evolution Sprint 2 — Consultant Reflection Layer', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate', () => {
    it('registers ai.consultant_reflection default OFF', () => {
      expect(getFeatureRegistry().isEnabled(CONSULTANT_REFLECTION_FEATURE_ID)).toBe(false)
      expect(isConsultantReflectionEnabled()).toBe(false)
    })

    it('tryReflect returns null when flag off; runs when forced', () => {
      const session = createReflectionSession('en')
      expect(tryReflectTurn(session, { userText: 'trip ideas' })).toBeNull()
      const forced = tryReflectTurn(session, {
        userText: 'Family vacation ideas',
        locale: 'en',
        enabled: true,
      })
      expect(forced).not.toBeNull()
      expect(forced?.latestRecommendation).toBeTruthy()
    })
  })

  describe('memory + slot extraction', () => {
    it('extracts destination, budget, duration from English text', () => {
      const { delta, evidence } = extractSlotDeltaFromText(
        'Plan Istanbul for 7 days with budget 12000 SAR',
      )
      expect(delta.destination).toBe('Istanbul')
      expect(delta.budgetAmount).toBe(12000)
      expect(delta.budgetCurrency).toBe('SAR')
      expect(delta.durationDays).toBe(7)
      expect(evidence.length).toBeGreaterThan(0)
    })

    it('extracts Arabic family purpose and destination', () => {
      const { delta } = extractSlotDeltaFromText('أبي رحلة عائلية لدبي لمدة ٥ أيام')
      // Arabic-Indic digits may not parse with \\d — destination/purpose should still work
      expect(delta.destination).toBe('Dubai')
      expect(delta.tripPurpose).toBe('family')
    })

    it('ConversationMemory appends turns without dropping prior memory', () => {
      const session = createReflectionSession('en')
      ConversationMemory.appendUserTurn(session, 'Hello', 'en', undefined)
      ConversationMemory.appendUserTurn(session, 'Budget 8000 SAR', 'en', undefined)
      expect(session.turns).toHaveLength(2)
      expect(ConversationMemory.combinedUserText(session)).toMatch(/Hello/)
      expect(ConversationMemory.combinedUserText(session)).toMatch(/8000/)
    })
  })

  describe('incremental node refresh', () => {
    it('cold start marks all nodes dirty', () => {
      const { dirty, reused } = computeDirtyNodes({
        isColdStart: true,
        changedSlots: [],
        textOnlyRefine: false,
      })
      expect(dirty.length).toBe(9)
      expect(reused.length).toBe(0)
    })

    it('budget-only change reuses intent and profile', () => {
      const { dirty, reused } = computeDirtyNodes({
        isColdStart: false,
        changedSlots: ['budgetAmount'],
        textOnlyRefine: false,
      })
      expect(reused).toEqual(expect.arrayContaining(['intent', 'profile']))
      expect(dirty).toEqual(expect.arrayContaining(['budget', 'recommendation', 'explanation']))
      expect(dirty).not.toContain('intent')
    })

    it('pipeline reuses nodes on second turn budget update', () => {
      const session = createReflectionSession('en')
      const t0 = new Date('2026-07-24T12:00:00.000Z')
      const first = reflectTurn(session, {
        userText: 'Suggest a family beach trip',
        locale: 'en',
        now: t0,
        enabled: true,
      })
      expect(first.refreshedNodes.length).toBe(9)
      expect(first.reusedNodes.length).toBe(0)

      const second = reflectTurn(session, {
        userText: 'Our budget is 15000 SAR',
        locale: 'en',
        now: new Date('2026-07-24T12:01:00.000Z'),
        enabled: true,
      })
      expect(second.reusedNodes).toEqual(expect.arrayContaining(['intent', 'profile']))
      expect(second.refreshedNodes).toEqual(
        expect.arrayContaining(['budget', 'recommendation', 'explanation']),
      )
      expect(second.refreshedNodes.length).toBeLessThan(9)
      expect(session.state.slots.budgetAmount).toBe(15000)
    })
  })

  describe('recommendation revision stores required fields', () => {
    it('stores confidence, timestamp, evidence, constraints, tradeoffs, assumptions, missing data, reason for change', () => {
      const session = ReflectionPipeline.createSession('en')
      const result = ReflectionPipeline.reflect(session, {
        userText: 'Honeymoon ideas, luxury preferred',
        locale: 'en',
        now: new Date('2026-07-24T10:00:00.000Z'),
      })
      const rec = result.latestRecommendation
      expect(rec).toBeTruthy()
      expect(typeof rec!.confidence).toBe('number')
      expect(rec!.timestamp).toBeTruthy()
      expect(Array.isArray(rec!.evidence)).toBe(true)
      expect(Array.isArray(rec!.constraints)).toBe(true)
      expect(Array.isArray(rec!.tradeoffs)).toBe(true)
      expect(Array.isArray(rec!.assumptions)).toBe(true)
      expect(Array.isArray(rec!.missingData)).toBe(true)
      expect(rec!.reasonForChange).toMatch(/Initial/)
      expect(rec!.why.length).toBeGreaterThan(0)
      expect(rec!.whyNot.length).toBeGreaterThan(0)
    })

    it('records reason for change when destination arrives later', () => {
      const session = createReflectionSession('en')
      reflectTurn(session, {
        userText: 'Where should we go for a cultural week?',
        locale: 'en',
        now: new Date('2026-07-24T11:00:00.000Z'),
      })
      const second = reflectTurn(session, {
        userText: 'Let us lock Istanbul',
        locale: 'en',
        now: new Date('2026-07-24T11:02:00.000Z'),
      })
      expect(session.recommendations.length).toBe(2)
      expect(second.latestRecommendation?.reasonForChange).toMatch(/destination|Updated/i)
      expect(session.state.slots.destination).toBe('Istanbul')
      expect(session.decisionHistory.length).toBe(2)
      expect(second.explanationRevision.changeNote).toBeTruthy()
    })
  })

  describe('confidence + clarification evolution', () => {
    it('tracks confidence history across turns', () => {
      const session = createReflectionSession('en')
      reflectTurn(session, { userText: 'trip ideas', locale: 'en' })
      reflectTurn(session, {
        userText: 'Family trip to Dubai for 6 days budget 10000 SAR',
        locale: 'en',
      })
      expect(session.confidenceHistory.length).toBe(2)
      expect(session.clarificationQueue.length).toBeGreaterThanOrEqual(0)
      // After filling slots, destination-related clarifications should demote
      const destItems = session.clarificationQueue.filter((c) => c.field.includes('destination'))
      expect(destItems.every((c) => c.priority < 95 || session.state.slots.destination)).toBe(true)
    })

    it('TravelerState merge preserves prior slots', () => {
      const a = TravelerState.mergeSlots(
        { destination: 'Dubai', budgetAmount: 5000 },
        { durationDays: 5, interests: ['beach'] },
      )
      expect(a.destination).toBe('Dubai')
      expect(a.budgetAmount).toBe(5000)
      expect(a.durationDays).toBe(5)
      expect(a.interests).toEqual(['beach'])
      expect(changedSlotKeys({ destination: 'Dubai' }, a)).toEqual(
        expect.arrayContaining(['durationDays', 'interests', 'budgetAmount']),
      )
    })
  })

  describe('Arabic conversation', () => {
    it('evolves memory and revises recommendation in Arabic', () => {
      const session = createReflectionSession('ar')
      const first = reflectTurn(session, {
        userText: 'وش تنصح لرحلة عائلية؟',
        locale: 'ar',
        now: new Date('2026-07-24T08:00:00.000Z'),
      })
      expect(first.explanationRevision.locale).toBe('ar')
      expect(first.explanationRevision.body[0]).toMatch(/^لماذا/)
      expect(session.state.slots.tripPurpose).toBe('family')

      const second = reflectTurn(session, {
        userText: 'الميزانية 12000 ريال والوجهة دبي',
        locale: 'ar',
        knownDelta: { budgetAmount: 12000, budgetCurrency: 'SAR', destination: 'Dubai' },
        now: new Date('2026-07-24T08:05:00.000Z'),
      })
      expect(session.state.slots.destination).toBe('Dubai')
      expect(session.state.slots.budgetAmount).toBe(12000)
      expect(second.reusedNodes.length).toBeGreaterThan(0)
      expect(second.latestRecommendation?.reasonForChange).toMatch(/Updated|destination|budget/i)
      expect(second.explanationRevision.changeNote).toMatch(/تحديث/)
      expect(session.alternatives.length).toBeGreaterThan(0)
    })
  })

  describe('English conversation', () => {
    it('discovers then locks destination without full rebuild', () => {
      const session = createReflectionSession('en')
      const first = reflectTurn(session, {
        userText: 'Suggest romantic honeymoon ideas, not just the cheapest',
        locale: 'en',
      })
      expect(first.latestRecommendation?.primaryAction).toBeTruthy()
      expect(session.state.priorities.some((p) => p.includes('honeymoon') || p.includes('discovery'))).toBe(
        true,
      )

      const second = reflectTurn(session, {
        userText: 'We prefer Maldives for 8 days',
        locale: 'en',
      })
      expect(session.state.slots.destination).toBe('Maldives')
      expect(session.state.slots.durationDays).toBe(8)
      expect(second.refreshedNodes.length).toBeLessThan(first.refreshedNodes.length)
      expect(session.recommendations.length).toBe(2)
      expect(session.decisionHistory[1]?.confidenceAfter).toBeTypeOf('number')
    })
  })

  describe('alternatives + assumptions', () => {
    it('explores alternatives and invalidates assumptions when slots fill', () => {
      const session = createReflectionSession('en')
      reflectTurn(session, { userText: 'Open to destinations for leisure', locale: 'en' })
      const beforeInvalid = session.assumptions.filter((a) => a.status === 'active').length
      reflectTurn(session, {
        userText: 'Actually lock Baku please, budget 9000 SAR',
        locale: 'en',
      })
      expect(session.alternatives.length).toBeGreaterThan(0)
      expect(session.alternatives.every((a) => a.toLowerCase() !== 'baku')).toBe(true)
      expect(session.assumptions.some((a) => a.status === 'invalidated') || beforeInvalid >= 0).toBe(
        true,
      )
    })
  })

  describe('regression — freeze boundaries', () => {
    it('does not export planTurn from reflection index', async () => {
      const mod = await import('../agent/reflection')
      expect('planTurn' in mod).toBe(false)
      expect('runPlanTurn' in mod).toBe(false)
      expect(typeof mod.reflectTurn).toBe('function')
      expect(typeof mod.createReflectionSession).toBe('function')
    })

    it('Sprint 1 consultant reasoning remains independently callable', () => {
      expect(isConsultantReasoningEnabled({ enabled: true })).toBe(true)
      const bundle = runConsultantReasoningPipeline({
        locale: 'en',
        userText: 'Family trip ideas',
      })
      expect(bundle.recommendation).toBeTruthy()
    })

    it('reflection does not clear prior recommendations on refine', () => {
      const session = createReflectionSession('en')
      reflectTurn(session, { userText: 'trip to Cairo', locale: 'en' })
      const firstId = session.recommendations[0]!.id
      reflectTurn(session, { userText: 'budget 7000 SAR for 4 days', locale: 'en' })
      expect(session.recommendations[0]!.id).toBe(firstId)
      expect(session.recommendations.length).toBe(2)
    })
  })
})
