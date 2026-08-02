/**
 * Sprint 89 Phase 2 T10 — planReasonTurn pure orchestration.
 * No BrainRouter runtime, CM, Search, Gateway, LLM, flags, or Phase 3.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyMemory } from '../agent/types'
import { resetFeatureRegistry } from '../ai'
import { understandTurn } from '../brain/v1'
import {
  assertPlanReasonTurnInvariants,
  PLAN_REASON_TURN_VERSION,
  planReasonTurn,
  type PlanReasonTurnInput,
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

describe('Sprint 89 Phase 2 T10 — planReasonTurn', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
    vi.restoreAllMocks()
  })

  it('exposes sealed versioned result without gateway/search', async () => {
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

    const understanding = understandTurn({
      text: 'Trip to Dubai from Riyadh 2026-10-01 to 2026-10-08 for 2 adults',
      locale: 'en',
      conversationId: 'prt-complete-en',
    })
    const result = planReasonTurn(baseInput(understanding, { goalHint: 'domain_flight' }))
    expect(result.contractVersion).toBe(PLAN_REASON_TURN_VERSION)
    expect(assertPlanReasonTurnInvariants(result)).toBe(true)
    expect(result.capabilities.executeSearch).toBe(false)
    expect(result.capabilities.invokeGateway).toBe(false)
    expect(result.capabilities.invokeBrainRouter).toBe(false)
    expect(result.capabilities.invokeConversationManager).toBe(false)
    expect(result.capabilities.invokeLlm).toBe(false)
    if (spy) expect(spy).not.toHaveBeenCalled()
  })

  describe('complete trip / search handoff meta', () => {
    it('en: complete flight request may yield SEARCH_HANDOFF meta only', () => {
      const understanding = understandTurn({
        text: 'Flight to Dubai from Riyadh 2026-10-01 to 2026-10-08 adults 2',
        locale: 'en',
        conversationId: 'prt-flight-en',
      })
      const result = planReasonTurn(
        baseInput(understanding, { goalHint: 'domain_flight' }),
      )
      expect(result.sealed).toBe(true)
      expect(result.toolDecision.executeSearch).toBe(false)
      expect(result.toolDecision.invokeGateway).toBe(false)
      if (result.summary.toolDecision === 'SEARCH_HANDOFF') {
        expect(result.summary.searchEligible).toBe(true)
        expect(result.decisionContract.decision.searchHandoff.executeSearch).toBe(false)
      }
      expect(result.memoryUnchanged).toBe(true)
      expect(result.preservedKnownSlots.destination).toBeTruthy()
      expect(assertPlanReasonTurnInvariants(result)).toBe(true)
    })

    it('ar: complete request preserves Arabic locale in summary', () => {
      const understanding = understandTurn({
        text: 'أريد رحلة من الرياض إلى دبي من 2026-10-01 إلى 2026-10-08 لشخصين',
        locale: 'ar',
        conversationId: 'prt-flight-ar',
      })
      const result = planReasonTurn(
        baseInput(understanding, { goalHint: 'domain_flight', locale: 'ar' }),
      )
      expect(result.summary.locale).toBe('ar')
      expect(result.sealed).toBe(true)
      expect(result.capabilities.invokeLlm).toBe(false)
      expect(result.toolDecision.executeSearch).toBe(false)
    })
  })

  describe('missing blocking + one merged clarification', () => {
    it('en: missing origin/dates → clarify path, ≤1 candidate', () => {
      const understanding = understandTurn({
        text: 'I want to go to Morocco',
        locale: 'en',
        conversationId: 'prt-missing-en',
      })
      const result = planReasonTurn(
        baseInput(understanding, { goalHint: 'domain_flight' }),
      )
      expect(result.missing.blocking.length).toBeGreaterThan(0)
      expect(result.summary.toolDecision).not.toBe('SEARCH_HANDOFF')
      expect(result.summary.searchEligible).toBe(false)
      if (result.clarification.shouldAsk) {
        expect(result.clarification.questionCandidate).not.toBeNull()
        expect(result.clarification.mergedFields.length).toBeGreaterThanOrEqual(1)
        expect(result.valueBeforeQuestion.strategy).toBe('value_then_clarify')
      }
      // Never ask booking-only
      expect(result.clarification.mergedFields).not.toContain('passport')
      expect(result.clarification.mergedFields).not.toContain('payment')
    })

    it('en: Morocco next month → flexibleDates demotes dates from blocking (post-assumption missing)', () => {
      const understanding = understandTurn({
        text: 'I want to travel to Morocco next month.',
        locale: 'en',
        conversationId: 'prt-flex-dates-en',
      })
      expect(understanding.state.knownSlots.destination).toBe('Morocco')

      const result = planReasonTurn(
        baseInput(understanding, { goalHint: 'domain_flight' }),
      )

      // Destination remains confirmed from Phase 1.
      expect(result.missing.confirmedFields).toContain('destination')
      expect(result.preservedKnownSlots.destination).toBe('Morocco')

      // Same-turn flexibleDates assumption is reflected in final missing SoT.
      expect(result.assumptions.assumedFields).toContain('flexibleDates')
      expect(
        result.assumptions.proposed.some(
          (a) => a.field === 'flexibleDates' && a.source === 'assumed' && a.reversible === true,
        ),
      ).toBe(true)
      expect(result.missing.blocking).not.toContain('dates')
      expect(result.missing.deferrable).toContain('dates')
      expect(
        result.missing.fields.some(
          (f) => f.field === 'dates' && f.reason === 'assumed_not_confirmed',
        ),
      ).toBe(true)

      // Downstream consumers must not retain stale pre-assumption dates blocking.
      expect(result.planningHints.blockingFields).not.toContain('dates')
      expect(result.decisionContract.decision.blockingFields).not.toContain('dates')
      expect(result.clarification.mergedFields).not.toContain('dates')
      expect(result.clarification.mergedFields).not.toContain('destination')

      // No runtime execution; search is decision metadata only (SEARCH_HANDOFF iff eligible).
      expect(result.toolDecision.executeSearch).toBe(false)
      expect(result.toolDecision.invokeGateway).toBe(false)
      expect(result.capabilities.executeSearch).toBe(false)
      expect(result.capabilities.invokeGateway).toBe(false)
      expect(result.summary.searchEligible).toBe(
        result.summary.toolDecision === 'SEARCH_HANDOFF',
      )
      // Flex dates alone never authorize search handoff.
      expect(result.summary.toolDecision).not.toBe('SEARCH_HANDOFF')
      expect(result.summary.searchEligible).toBe(false)
      expect(assertPlanReasonTurnInvariants(result)).toBe(true)
    })

    it('ar: missing blocking does not authorize search handoff', () => {
      const understanding = understandTurn({
        text: 'أبغى أروح دبي',
        locale: 'ar',
        conversationId: 'prt-missing-ar',
      })
      const result = planReasonTurn(
        baseInput(understanding, { goalHint: 'domain_flight', locale: 'ar' }),
      )
      expect(result.summary.searchEligible).toBe(false)
      expect(result.toolDecision.executeSearch).toBe(false)
      expect(result.decisionContract.capabilities.executeSearch).toBe(false)
    })
  })

  describe('corrections / superseded / confirmed', () => {
    it('en: destination correction uses post-correction knownSlots', () => {
      const turn1 = understandTurn({
        text: 'I wanted Dubai.',
        locale: 'en',
        conversationId: 'prt-corr-dest',
      })
      const turn2 = understandTurn({
        text: 'Actually make it Morocco.',
        locale: 'en',
        conversationId: 'prt-corr-dest',
        priorEntities: turn1.entities.entities,
        priorState: turn1.state,
        memoryHints: {
          destination: turn1.entities.entities.destination,
          recentTexts: ['I wanted Dubai.'],
        },
      })
      expect(turn2.state.knownSlots.destination).toBe('Morocco')
      expect(turn2.state.supersededFields).toContain('destination')

      const result = planReasonTurn(
        baseInput(turn2, { goalHint: 'advise' }),
      )
      expect(result.preservedKnownSlots.destination).toBe('Morocco')
      expect(result.preservedSupersededFields).toContain('destination')
      expect(result.missing.confirmedFields).toContain('destination')
      // Superseded Dubai must not drive missing plan as current destination ask target.
      expect(JSON.stringify(result.missing.blocking)).not.toContain('Dubai')
      expect(result.clarification.mergedFields).not.toContain('destination')
    })

    it('ar: correction overrides prior destination', () => {
      const turn1 = understandTurn({
        text: 'أريد رحلة إلى المغرب',
        locale: 'ar',
        conversationId: 'prt-corr-ar',
      })
      const turn2 = understandTurn({
        text: 'صرت أبغى تركيا بدل المغرب',
        locale: 'ar',
        conversationId: 'prt-corr-ar',
        priorEntities: turn1.entities.entities,
        priorState: turn1.state,
        memoryHints: { destination: 'Morocco', recentTexts: ['أريد رحلة إلى المغرب'] },
      })
      const result = planReasonTurn(
        baseInput(turn2, { goalHint: 'advise', locale: 'ar' }),
      )
      expect(result.preservedKnownSlots.destination).toBe('Turkey')
      expect(result.missing.confirmedFields).toContain('destination')
    })

    it('assumptions remain reversible; confirmed never overwritten in policy', () => {
      const understanding = understandTurn({
        text: 'Advise me on a trip to Paris',
        locale: 'en',
        conversationId: 'prt-assume',
      })
      const result = planReasonTurn(
        baseInput(understanding, { goalHint: 'advise' }),
      )
      for (const a of result.assumptions.proposed) {
        expect(a.source).toBe('assumed')
        expect(a.reversible).toBe(true)
        expect(a.confidence.level).toBe('assumption')
      }
      expect(result.assumptions.proposed.some((a) => a.field === 'destination')).toBe(false)
      expect(result.memoryUnchanged).toBe(true)
    })
  })

  describe('abort short-circuit', () => {
    it('en: abort preserves knownSlots and skips clarify/search', () => {
      const prior = understandTurn({
        text: 'Trip to Morocco from Jeddah',
        locale: 'en',
        conversationId: 'prt-abort-en',
      })
      const aborted = understandTurn({
        text: 'Cancel everything, never mind.',
        locale: 'en',
        conversationId: 'prt-abort-en',
        priorEntities: prior.entities.entities,
        priorState: prior.state,
      })
      const result = planReasonTurn(
        baseInput(aborted, {
          abort: true,
          goalHint: 'domain_flight',
        }),
      )
      expect(result.summary.toolDecision).toBe('ABORT')
      expect(result.summary.searchEligible).toBe(false)
      expect(result.clarification.shouldAsk).toBe(false)
      expect(result.assumptions.proposed).toEqual([])
      expect(result.recovery.reason).toBe('abort_short_circuit')
      expect(result.preservedKnownSlots.destination).toBe(
        aborted.state.knownSlots.destination,
      )
      expect(result.valueBeforeQuestion.strategy).toBe('abort')
      expect(assertPlanReasonTurnInvariants(result)).toBe(true)
    })
  })

  describe('failure recovery', () => {
    it('preserves memory and returns safe sealed ANSWER', () => {
      const understanding = understandTurn({
        text: 'Trip to Dubai from Riyadh 2026-10-01',
        locale: 'en',
        conversationId: 'prt-recover',
      })
      const memory = emptyMemory('en')
      const result = planReasonTurn(
        baseInput(understanding, {
          memory,
          goalHint: 'domain_flight',
          __testForceFailure: true,
        }),
      )
      expect(result.recovery.used).toBe(true)
      expect(result.recovery.failureCode).toBe('PLAN_REASON_INTERNAL_ERROR')
      expect(result.recovery.reason).toBe('recovery_safe_answer')
      expect(result.summary.toolDecision).toBe('ANSWER')
      expect(result.summary.searchEligible).toBe(false)
      expect(result.assumptions.proposed).toEqual([])
      expect(result.preservedKnownSlots).toEqual(understanding.state.knownSlots)
      expect(result.preservedProvenance).toEqual(understanding.provenance)
      expect(result.memoryUnchanged).toBe(true)
      expect(result.sealed).toBe(true)
      expect(assertPlanReasonTurnInvariants(result)).toBe(true)
      // No stack / CoT leakage keys
      expect(result.recovery).not.toHaveProperty('stack')
      expect(JSON.stringify(result.recovery)).not.toMatch(/Error:|at planReasonTurn/)
    })
  })

  describe('determinism + immutability', () => {
    it('identical inputs produce identical sealed output', () => {
      const understanding = understandTurn({
        text: 'Advise a weekend in Dubai',
        locale: 'en',
        conversationId: 'prt-det',
      })
      const input = baseInput(understanding, {
        goalHint: 'advise',
        updatedAt: '1970-01-01T00:00:00.000Z',
      })
      const a = planReasonTurn(input)
      const b = planReasonTurn(input)
      expect(a).toEqual(b)
      expect(Object.isFrozen(a)).toBe(true)
      expect(() => {
        ;(a as { sealed: boolean }).sealed = false
      }).toThrow()
    })
  })
})
