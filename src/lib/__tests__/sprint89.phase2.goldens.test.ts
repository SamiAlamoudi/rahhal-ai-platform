/**
 * Sprint 89 Phase 2 T11 — Goldens G06–G10 (ar + en).
 *
 * Behavioral lock over understandTurn → planReasonTurn only.
 * No BrainRouter runtime wire, CM, Search, Gateway, LLM, or flag changes.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyMemory } from '../agent/types'
import { resetFeatureRegistry } from '../ai'
import {
  createUnderstandingMemoryManager,
  understandTurn,
} from '../brain/v1'
import {
  assertPlanReasonTurnInvariants,
  planReasonTurn,
  promoteAssumptionToConfirmed,
  type PlanReasonTurnInput,
  type PlanReasonTurnResult,
} from '../brain/v1/planning/phase2'

function baseInput(
  understanding: ReturnType<typeof understandTurn>,
  overrides: Partial<PlanReasonTurnInput> = {},
): PlanReasonTurnInput {
  return {
    understanding,
    memory: emptyMemory(understanding.state.locale),
    conversationState: understanding.state,
    locale: understanding.state.locale,
    abort: understanding.intent.primaryIntent === 'abort',
    priorClarificationAttempts: [],
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  }
}

function runPlan(
  text: string,
  locale: 'ar' | 'en',
  conversationId: string,
  overrides: Partial<PlanReasonTurnInput> = {},
  prior?: ReturnType<typeof understandTurn>,
): { understanding: ReturnType<typeof understandTurn>; result: PlanReasonTurnResult } {
  const understanding = understandTurn({
    text,
    locale,
    conversationId,
    ...(prior
      ? {
          priorState: prior.state,
          priorEntities: prior.entities.entities,
          memoryHints: {
            destination: prior.state.knownSlots.destination,
            origin: prior.state.knownSlots.origin,
            recentTexts: [text],
          },
        }
      : {}),
  })
  const result = planReasonTurn(
    baseInput(understanding, {
      locale,
      goalHint: overrides.goalHint ?? 'domain_flight',
      ...overrides,
    }),
  )
  return { understanding, result }
}

function assertNoExecution(result: PlanReasonTurnResult): void {
  expect(assertPlanReasonTurnInvariants(result)).toBe(true)
  expect(result.toolDecision.executeSearch).toBe(false)
  expect(result.toolDecision.invokeGateway).toBe(false)
  expect(result.capabilities.executeSearch).toBe(false)
  expect(result.capabilities.invokeGateway).toBe(false)
  expect(result.capabilities.invokeBrainRouter).toBe(false)
  expect(result.capabilities.invokeConversationManager).toBe(false)
  expect(result.capabilities.invokeLlm).toBe(false)
  expect(result.summary.searchEligible).toBe(
    result.summary.toolDecision === 'SEARCH_HANDOFF',
  )
}

describe('Sprint 89 Phase 2 T11 — Goldens G06–G10', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
    vi.restoreAllMocks()
  })

  describe('G06 — Clarify-before-search (Morocco-only insufficient)', () => {
    it('en: Morocco-only → clarify; never SEARCH_HANDOFF; no execute', () => {
      const { understanding, result } = runPlan(
        'I want to travel to Morocco',
        'en',
        'g06-en',
      )
      expect(understanding.state.knownSlots.destination).toBe('Morocco')
      expect(result.missing.confirmedFields).toContain('destination')
      expect(result.missing.blocking.length).toBeGreaterThan(0)
      expect(result.missing.sufficientForSearch).toBe(false)
      expect(result.summary.toolDecision).not.toBe('SEARCH_HANDOFF')
      expect(result.summary.searchEligible).toBe(false)
      expect(result.summary.toolDecision === 'CLARIFY' || result.clarification.shouldAsk).toBe(
        true,
      )
      if (result.clarification.shouldAsk) {
        expect(result.clarification.questionCandidate).not.toBeNull()
        expect(result.clarification.mergedFields).not.toContain('destination')
        expect(result.clarification.mergedFields).not.toContain('passport')
      }
      assertNoExecution(result)
    })

    it('ar: Morocco-only → clarify; never SEARCH_HANDOFF; no execute', () => {
      const { understanding, result } = runPlan(
        'أريد السفر إلى المغرب',
        'ar',
        'g06-ar',
        { locale: 'ar' },
      )
      expect(understanding.state.knownSlots.destination).toBeTruthy()
      expect(result.missing.confirmedFields).toContain('destination')
      expect(result.missing.blocking.length).toBeGreaterThan(0)
      expect(result.summary.toolDecision).not.toBe('SEARCH_HANDOFF')
      expect(result.summary.searchEligible).toBe(false)
      expect(result.summary.locale).toBe('ar')
      assertNoExecution(result)
    })
  })

  describe('G07 — ¬SEARCH_HANDOFF when blocking remains', () => {
    it('en: blocking origin/dates path never emits SEARCH_HANDOFF', () => {
      const { result } = runPlan(
        'Trip to Dubai next month',
        'en',
        'g07-en',
      )
      // Post-assumption: dates may be deferrable via flexibleDates; origin still blocks flight.
      expect(result.missing.blocking.length).toBeGreaterThan(0)
      expect(result.summary.toolDecision).not.toBe('SEARCH_HANDOFF')
      expect(result.toolDecision.searchEligible).toBe(false)
      expect(result.decisionContract.decision.toolDecision).not.toBe('SEARCH_HANDOFF')
      expect(result.decisionContract.decision.searchHandoff.executeSearch).toBe(false)
      expect(
        result.decisionContract.decision.searchHandoff.status === 'blocked_clarification_pending'
          || result.decisionContract.decision.searchHandoff.status
            === 'blocked_insufficient_information',
      ).toBe(true)
      assertNoExecution(result)
    })

    it('ar: blocking path never emits SEARCH_HANDOFF', () => {
      const { result } = runPlan(
        'أبغى أروح دبي الشهر الجاي',
        'ar',
        'g07-ar',
        { locale: 'ar' },
      )
      expect(result.missing.blocking.length).toBeGreaterThan(0)
      expect(result.summary.toolDecision).not.toBe('SEARCH_HANDOFF')
      expect(result.summary.searchEligible).toBe(false)
      assertNoExecution(result)
    })
  })

  describe('G08 — Assumption not promoted', () => {
    it('en: proposed assumptions stay source assumed; promotion API forbidden', () => {
      const { result } = runPlan(
        'Advise me on a trip to Paris',
        'en',
        'g08-en',
        { goalHint: 'advise' },
      )
      expect(result.assumptions.proposed.length).toBeGreaterThan(0)
      for (const a of result.assumptions.proposed) {
        expect(a.source).toBe('assumed')
        expect(a.reversible).toBe(true)
        expect(a.confidence.level).toBe('assumption')
        expect(a.provenance.source).toBe('assumed')
      }
      expect(result.assumptions.proposed.some((a) => a.field === 'destination')).toBe(false)
      expect(result.memoryUnchanged).toBe(true)
      expect(() => promoteAssumptionToConfirmed('adults')).toThrow(
        /INTERNAL_CONTRACT_VIOLATION/,
      )
      assertNoExecution(result)
    })

    it('ar: assumptions remain assumed; memory not written by planReasonTurn', () => {
      const { result } = runPlan(
        'انصحني برحلة إلى باريس',
        'ar',
        'g08-ar',
        { goalHint: 'advise', locale: 'ar' },
      )
      for (const a of result.assumptions.proposed) {
        expect(a.source).toBe('assumed')
        expect(a.reversible).toBe(true)
      }
      expect(result.memoryUnchanged).toBe(true)
      assertNoExecution(result)
    })
  })

  describe('G09 — Correction then replan missing', () => {
    it('en: Dubai→Morocco uses post-correction knownSlots only', () => {
      const turn1 = understandTurn({
        text: 'I wanted Dubai.',
        locale: 'en',
        conversationId: 'g09-en',
      })
      const turn2 = understandTurn({
        text: 'Actually make it Morocco.',
        locale: 'en',
        conversationId: 'g09-en',
        priorEntities: turn1.entities.entities,
        priorState: turn1.state,
        memoryHints: {
          destination: turn1.entities.entities.destination,
          recentTexts: ['I wanted Dubai.'],
        },
      })
      expect(turn2.state.knownSlots.destination).toBe('Morocco')
      expect(turn2.state.supersededFields).toContain('destination')

      const result = planReasonTurn(baseInput(turn2, { goalHint: 'advise' }))
      expect(result.preservedKnownSlots.destination).toBe('Morocco')
      expect(result.preservedSupersededFields).toContain('destination')
      expect(result.missing.confirmedFields).toContain('destination')
      expect(result.clarification.mergedFields).not.toContain('destination')
      expect(JSON.stringify(result.missing)).not.toMatch(/Dubai/i)
      assertNoExecution(result)
    })

    it('ar: destination correction overrides prior and replans', () => {
      const turn1 = understandTurn({
        text: 'أريد رحلة إلى المغرب',
        locale: 'ar',
        conversationId: 'g09-ar',
      })
      const turn2 = understandTurn({
        text: 'صرت أبغى تركيا بدل المغرب',
        locale: 'ar',
        conversationId: 'g09-ar',
        priorEntities: turn1.entities.entities,
        priorState: turn1.state,
        memoryHints: {
          destination: 'Morocco',
          recentTexts: ['أريد رحلة إلى المغرب'],
        },
      })
      const result = planReasonTurn(
        baseInput(turn2, { goalHint: 'advise', locale: 'ar' }),
      )
      expect(result.preservedKnownSlots.destination).toBe('Turkey')
      expect(result.missing.confirmedFields).toContain('destination')
      expect(result.clarification.mergedFields).not.toContain('destination')
      assertNoExecution(result)
    })
  })

  describe('G10 — Abort skips Phase 2 memory mutation', () => {
    it('en: abort → ABORT decision; no assumptions; memory identity unchanged', () => {
      const prior = understandTurn({
        text: 'Trip to Morocco from Jeddah',
        locale: 'en',
        conversationId: 'g10-en',
      })
      const aborted = understandTurn({
        text: 'Cancel everything, never mind.',
        locale: 'en',
        conversationId: 'g10-en',
        priorEntities: prior.entities.entities,
        priorState: prior.state,
      })
      const memory = emptyMemory('en')
      const result = planReasonTurn(
        baseInput(aborted, {
          memory,
          abort: true,
          goalHint: 'domain_flight',
        }),
      )
      expect(result.summary.toolDecision).toBe('ABORT')
      expect(result.clarification.shouldAsk).toBe(false)
      expect(result.assumptions.proposed).toEqual([])
      expect(result.memoryUnchanged).toBe(true)
      expect(result.preservedKnownSlots.destination).toBe(
        aborted.state.knownSlots.destination,
      )
      expect(result.recovery.reason).toBe('abort_short_circuit')
      assertNoExecution(result)

      // Explicit memory apply path also no-ops on abort preserve.
      const mm = createUnderstandingMemoryManager()
      const applied = mm.applyAssumptions(
        memory,
        [
          {
            field: 'adults',
            value: 1,
            source: 'assumed',
            reason: 'default_single_traveler',
            confidence: 0.65,
          },
        ],
        { preserveOnAbort: true },
      )
      expect(applied.applied).toHaveLength(0)
      expect(applied.memory).toBe(memory)
    })

    it('ar: abort → no clarify / no search / no memory writes', () => {
      const prior = understandTurn({
        text: 'أريد رحلة إلى دبي',
        locale: 'ar',
        conversationId: 'g10-ar',
      })
      const aborted = understandTurn({
        text: 'ألغِ كل شيء، خلاص ما أبي أسافر',
        locale: 'ar',
        conversationId: 'g10-ar',
        priorEntities: prior.entities.entities,
        priorState: prior.state,
      })
      const result = planReasonTurn(
        baseInput(aborted, {
          abort: true,
          locale: 'ar',
          goalHint: 'domain_flight',
        }),
      )
      expect(result.summary.toolDecision).toBe('ABORT')
      expect(result.summary.searchEligible).toBe(false)
      expect(result.clarification.shouldAsk).toBe(false)
      expect(result.assumptions.proposed).toEqual([])
      expect(result.memoryUnchanged).toBe(true)
      assertNoExecution(result)
    })
  })

  describe('T11 safety envelope', () => {
    it('does not call provider gateway search during goldens', async () => {
      const gatewayMod = await import('../../core/providerGateway').catch(() => null)
      const maybeSearch = gatewayMod
        ? (gatewayMod as unknown as { searchFlights?: (...a: unknown[]) => unknown }).searchFlights
        : undefined
      const spy =
        typeof maybeSearch === 'function'
          ? vi.spyOn(
              gatewayMod as unknown as { searchFlights: (...a: unknown[]) => unknown },
              'searchFlights',
            )
          : null

      for (const [text, locale, id] of [
        ['I want to travel to Morocco', 'en', 'g-safe-en'],
        ['أريد السفر إلى المغرب', 'ar', 'g-safe-ar'],
      ] as const) {
        const { result } = runPlan(text, locale, id)
        assertNoExecution(result)
      }
      if (spy) expect(spy).not.toHaveBeenCalled()
    })
  })
})
