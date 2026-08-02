/**
 * Sprint 89 Phase 2 T8 — BrainRouterPlanningAdapter (pure normalize only).
 * No BrainRouter runtime, CM, Search, Gateway, LLM, or Phase 3.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import {
  adaptPlanningHintsForBrainRouter,
  assertBrainRouterPlanningInvariants,
  BRAIN_ROUTER_PLANNING_ADAPTER_VERSION,
  buildPlanningHints,
  createBrainRouterPlanningAdapter,
  decideToolDecision,
  PLANNING_HINTS_BUILDER_VERSION,
  type AssumptionDecision,
  type ClarificationBridgeResult,
  type ConfidenceDecision,
  type PlanningHints,
  type PlanningHintsBuilderInput,
} from '../brain/v1/planning/phase2'
import { CONFIDENCE_GATES_VERSION } from '../brain/v1/planning/phase2/ConfidenceGates'
import { CLARIFICATION_BRIDGE_VERSION } from '../brain/v1/planning/phase2/ClarificationBridge'

function confidence(partial: Partial<ConfidenceDecision> = {}): ConfidenceDecision {
  return {
    contractVersion: CONFIDENCE_GATES_VERSION,
    confidenceLevel: 'confirmed',
    searchEligible: false,
    shouldClarify: false,
    blockingReason: null,
    ...partial,
  }
}

function clarification(
  partial: Partial<ClarificationBridgeResult> = {},
): PlanningHintsBuilderInput['clarification'] {
  const full: ClarificationBridgeResult = {
    contractVersion: CLARIFICATION_BRIDGE_VERSION,
    shouldAsk: false,
    questionCandidate: null,
    mergedFields: [],
    avoidReasons: [{ field: 'passport', reason: 'booking_deferred' }],
    planningHints: {
      shouldAsk: false,
      questionKey: null,
      mergedFields: [],
      avoidReasons: [{ field: 'passport', reason: 'booking_deferred' }],
      searchEligible: false,
      confidenceLevel: 'confirmed',
      confidenceShouldClarify: false,
      assumedFields: [],
      correctedFields: [],
      moveHint: 'none',
      questionBudgetUsed: 0,
    },
    cmInjectionDesign: {
      mode: 'planning_hints_injection',
      planningHints: {
        shouldAsk: false,
        questionKey: null,
        mergedFields: [],
        avoidReasons: [],
        searchEligible: false,
        confidenceLevel: 'confirmed',
        confidenceShouldClarify: false,
        assumedFields: [],
        correctedFields: [],
        moveHint: 'none',
        questionBudgetUsed: 0,
      },
      cmMustSkipSelection: true,
      bridgeSuppliesCopy: false,
    },
    ...partial,
  }
  return {
    shouldAsk: full.shouldAsk,
    questionCandidate: full.questionCandidate,
    mergedFields: full.mergedFields,
    avoidReasons: full.avoidReasons,
    planningHints: full.planningHints,
  }
}

function assumedAdults(): AssumptionDecision {
  return {
    field: 'adults',
    value: 1,
    source: 'assumed',
    confidence: { level: 'assumption', score: 0.62 },
    reason: 'default_single_traveler',
    provenance: {
      field: 'adults',
      value: 1,
      source: 'assumed',
      confidence: 0.62,
      updatedAt: new Date(0).toISOString(),
      planId: null,
      reversible: true,
    },
    reversible: true,
    requiresConfirmationBeforeBooking: true,
    commitToMemory: true,
  }
}

function hintsFor(
  overrides: Partial<PlanningHintsBuilderInput> & { locale?: 'ar' | 'en' } = {},
): PlanningHints {
  const locale = overrides.locale ?? 'en'
  const missing: PlanningHintsBuilderInput['missing'] = {
    blocking: [],
    deferrable: ['budget'],
    bookingOnly: ['passport'],
    confirmedFields: ['destination'],
    abort: false,
    goal: 'advise',
    sufficientForAdvise: true,
    sufficientForSearch: false,
    ...overrides.missing,
  }
  const assumptions: PlanningHintsBuilderInput['assumptions'] = {
    assumedFields: ['adults'],
    abort: false,
    proposed: [assumedAdults()],
    committable: [assumedAdults()],
    ...overrides.assumptions,
  }
  const conf = overrides.confidence ?? confidence()
  const clar = overrides.clarification ?? clarification()
  const toolDecision =
    overrides.toolDecision
    ?? decideToolDecision({
      missing,
      assumptions: { assumedFields: assumptions.assumedFields, abort: assumptions.abort },
      confidence: conf,
      clarification: clar,
      locale,
    })
  return buildPlanningHints({
    missing,
    assumptions,
    confidence: conf,
    clarification: clar,
    toolDecision,
    locale,
  })
}

describe('Sprint 89 Phase 2 T8 — BrainRouterPlanningAdapter', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
    vi.restoreAllMocks()
  })

  it('adapts PlanningHints into versioned immutable contract without gateway', async () => {
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

    const source = hintsFor({ locale: 'en' })
    const result = adaptPlanningHintsForBrainRouter({ planningHints: source })
    expect(result.contractVersion).toBe(BRAIN_ROUTER_PLANNING_ADAPTER_VERSION)
    expect(result.planningHintsContractVersion).toBe(PLANNING_HINTS_BUILDER_VERSION)
    expect(assertBrainRouterPlanningInvariants(result, source)).toBe(true)
    expect(result.invokeBrainRouter).toBe(false)
    expect(result.invokeConversationManager).toBe(false)
    expect(result.executeSearch).toBe(false)
    expect(result.invokeGateway).toBe(false)
    if (spy) expect(spy).not.toHaveBeenCalled()
  })

  describe('English', () => {
    it('preserves ANSWER decisions exactly', () => {
      const source = hintsFor({ locale: 'en' })
      const result = adaptPlanningHintsForBrainRouter({ planningHints: source })
      expect(result.toolDecision).toBe(source.toolDecision)
      expect(result.plannerAction).toBe(source.nextPlannerAction)
      expect(result.toolDecision).toBe('ANSWER')
      expect(result.plannerAction).toBe('emit_answer')
      expect(result.confirmedFields).toEqual(source.confirmedFields)
      expect(result.assumptions[0]?.source).toBe('assumed')
      expect(result.reasoning.locale).toBe('en')
    })

    it('preserves CLARIFY + clarification candidate', () => {
      const clar = clarification({
        shouldAsk: true,
        questionCandidate: {
          field: 'dates',
          reason: 'merged_blocking_gap',
          detail: 'origin+dates',
        },
        mergedFields: ['origin', 'dates'],
        avoidReasons: [
          { field: 'passport', reason: 'booking_deferred' },
          { field: 'destination', reason: 'already_known' },
        ],
        planningHints: {
          shouldAsk: true,
          questionKey: 'dates',
          mergedFields: ['origin', 'dates'],
          avoidReasons: [{ field: 'passport', reason: 'booking_deferred' }],
          searchEligible: false,
          confidenceLevel: 'unknown',
          confidenceShouldClarify: true,
          assumedFields: [],
          correctedFields: [],
          moveHint: 'clarify',
          questionBudgetUsed: 1,
        },
      })
      const source = hintsFor({
        locale: 'en',
        missing: {
          blocking: ['origin', 'dates'],
          deferrable: [],
          bookingOnly: ['passport'],
          confirmedFields: ['destination'],
          abort: false,
          goal: 'domain_flight',
          sufficientForAdvise: true,
          sufficientForSearch: false,
        },
        confidence: confidence({
          shouldClarify: true,
          searchEligible: false,
          confidenceLevel: 'unknown',
          blockingReason: 'blocking_fields_missing',
        }),
        clarification: clar,
        assumptions: {
          assumedFields: [],
          abort: false,
          proposed: [],
          committable: [],
        },
      })
      const result = adaptPlanningHintsForBrainRouter({ planningHints: source })
      expect(result.toolDecision).toBe('CLARIFY')
      expect(result.plannerAction).toBe('emit_clarify')
      expect(result.clarification.shouldAsk).toBe(true)
      expect(result.clarification.candidate?.field).toBe('dates')
      expect(result.blockingFields).toEqual(['origin', 'dates'])
      expect(result.searchHandoff.status).toBe('blocked_clarification_pending')
      expect(assertBrainRouterPlanningInvariants(result, source)).toBe(true)
    })

    it('preserves SEARCH_HANDOFF metadata without enabling execute', () => {
      const source = hintsFor({
        locale: 'en',
        missing: {
          blocking: [],
          deferrable: ['budget'],
          bookingOnly: ['passport'],
          confirmedFields: ['destination', 'origin', 'dates'],
          abort: false,
          goal: 'domain_flight',
          sufficientForAdvise: true,
          sufficientForSearch: true,
        },
        confidence: confidence({ searchEligible: true, confidenceLevel: 'confirmed' }),
        clarification: clarification({ shouldAsk: false }),
      })
      const result = adaptPlanningHintsForBrainRouter({ planningHints: source })
      expect(result.toolDecision).toBe('SEARCH_HANDOFF')
      expect(result.plannerAction).toBe('emit_search_handoff_meta')
      expect(result.confidence.searchEligible).toBe(true)
      expect(result.searchHandoff.status).toBe('eligible')
      expect(result.searchHandoff.executeSearch).toBe(false)
      expect(result.executeSearch).toBe(false)
    })
  })

  describe('Arabic', () => {
    it('preserves ABORT path and locale in reasoning', () => {
      const source = hintsFor({
        locale: 'ar',
        missing: {
          blocking: ['origin'],
          deferrable: [],
          bookingOnly: [],
          confirmedFields: ['destination'],
          abort: true,
          goal: 'domain_flight',
          sufficientForAdvise: true,
          sufficientForSearch: false,
        },
        assumptions: {
          assumedFields: [],
          abort: true,
          proposed: [],
          committable: [],
        },
        clarification: clarification({
          shouldAsk: false,
          planningHints: {
            shouldAsk: false,
            questionKey: null,
            mergedFields: [],
            avoidReasons: [{ field: '*', reason: 'abort_no_ask' }],
            searchEligible: false,
            confidenceLevel: 'confirmed',
            confidenceShouldClarify: false,
            assumedFields: [],
            correctedFields: [],
            moveHint: 'abort',
            questionBudgetUsed: 0,
          },
        }),
      })
      const result = adaptPlanningHintsForBrainRouter({ planningHints: source })
      expect(result.toolDecision).toBe('ABORT')
      expect(result.plannerAction).toBe('emit_abort')
      expect(result.searchHandoff.status).toBe('abort_locked')
      expect(result.reasoning.locale).toBe('ar')
      expect(result.confirmedFields).toContain('destination')
      expect(assertBrainRouterPlanningInvariants(result, source)).toBe(true)
    })

    it('preserves HANDOFF for visa_guidance', () => {
      const source = hintsFor({
        locale: 'ar',
        missing: {
          blocking: [],
          deferrable: [],
          bookingOnly: ['passport'],
          confirmedFields: ['destination'],
          abort: false,
          goal: 'visa_guidance',
          sufficientForAdvise: true,
          sufficientForSearch: false,
        },
        assumptions: {
          assumedFields: [],
          abort: false,
          proposed: [],
          committable: [],
        },
        clarification: clarification({ shouldAsk: false }),
      })
      const result = adaptPlanningHintsForBrainRouter({ planningHints: source })
      expect(result.toolDecision).toBe('HANDOFF')
      expect(result.plannerAction).toBe('emit_handoff')
      expect(result.reasoning.locale).toBe('ar')
      expect(result.clarification.avoidReasons.some((a) => a.field === 'passport')).toBe(true)
    })
  })

  describe('immutability + non-mutation', () => {
    it('freezes result and does not mutate source PlanningHints', () => {
      const source = hintsFor({ locale: 'en' })
      const toolBefore = source.toolDecision
      const confirmedBefore = [...source.confirmedFields]
      const result = adaptPlanningHintsForBrainRouter({ planningHints: source })

      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.confidence)).toBe(true)
      expect(Object.isFrozen(result.clarification)).toBe(true)
      expect(() => {
        ;(result as { toolDecision: string }).toolDecision = 'ABORT'
      }).toThrow()

      expect(source.toolDecision).toBe(toolBefore)
      expect(source.confirmedFields).toEqual(confirmedBefore)
    })

    it('class adapt delegates to pure function', () => {
      const source = hintsFor()
      const input = { planningHints: source }
      expect(createBrainRouterPlanningAdapter().adapt(input)).toEqual(
        adaptPlanningHintsForBrainRouter(input),
      )
    })

    it('never changes planner decisions relative to PlanningHints', () => {
      const source = hintsFor({
        missing: {
          blocking: [],
          deferrable: [],
          bookingOnly: [],
          confirmedFields: ['destination', 'origin', 'dates'],
          abort: false,
          goal: 'domain_hotel',
          sufficientForAdvise: true,
          sufficientForSearch: true,
        },
        confidence: confidence({ searchEligible: true }),
      })
      const result = adaptPlanningHintsForBrainRouter({ planningHints: source })
      expect(result.toolDecision).toBe(source.toolDecision)
      expect(result.confidence).toEqual(source.confidence)
      expect(result.plannerAction).toBe(source.nextPlannerAction)
      expect(result.searchHandoff.status).toBe(source.searchHandoff.status)
      expect(result.assumptions.map((a) => a.field)).toEqual(
        source.assumptions.map((a) => a.field),
      )
    })
  })
})
