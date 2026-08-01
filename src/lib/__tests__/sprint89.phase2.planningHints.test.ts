/**
 * Sprint 89 Phase 2 T7 — PlanningHintsBuilder (pure aggregation).
 * No Search / Gateway / BrainRouter / CM / flags / Phase 3.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import {
  assertPlanningHintsInvariants,
  buildPlanningHints,
  CLARIFICATION_BRIDGE_VERSION,
  CONFIDENCE_GATES_VERSION,
  createPlanningHintsBuilder,
  decideToolDecision,
  PLANNING_HINTS_BUILDER_VERSION,
  TOOL_DECISION_BRIDGE_VERSION,
  type AssumptionDecision,
  type ClarificationBridgeResult,
  type ConfidenceDecision,
  type PlanningHintsBuilderInput,
  type ToolDecisionResult,
} from '../brain/v1/planning/phase2'

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

function toolFrom(input: Parameters<typeof decideToolDecision>[0]): ToolDecisionResult {
  return decideToolDecision(input)
}

function base(
  overrides: Partial<PlanningHintsBuilderInput> = {},
): PlanningHintsBuilderInput {
  const missing: PlanningHintsBuilderInput['missing'] = {
    blocking: [],
    deferrable: ['budget'],
    bookingOnly: ['passport', 'payment'],
    confirmedFields: ['destination'],
    abort: false,
    goal: 'advise',
    sufficientForAdvise: true,
    sufficientForSearch: false,
  }
  const assumptions: PlanningHintsBuilderInput['assumptions'] = {
    assumedFields: ['adults'],
    abort: false,
    proposed: [assumedAdults()],
    committable: [assumedAdults()],
  }
  const conf = confidence()
  const clar = clarification()
  const toolDecision = toolFrom({
    missing,
    assumptions: { assumedFields: assumptions.assumedFields, abort: false },
    confidence: conf,
    clarification: clar,
    locale: 'en',
  })
  return {
    missing,
    assumptions,
    confidence: conf,
    clarification: clar,
    toolDecision,
    locale: 'en',
    ...overrides,
  }
}

function assertNoCopy(hints: ReturnType<typeof buildPlanningHints>): void {
  expect(hints).not.toHaveProperty('ar')
  expect(hints).not.toHaveProperty('en')
  expect(hints).not.toHaveProperty('prompt')
  expect(hints).not.toHaveProperty('questionText')
  if (hints.clarificationCandidate) {
    expect(hints.clarificationCandidate).not.toHaveProperty('ar')
    expect(hints.clarificationCandidate).not.toHaveProperty('en')
  }
  expect(hints.executeSearch).toBe(false)
  expect(hints.invokeGateway).toBe(false)
  expect(assertPlanningHintsInvariants(hints)).toBe(true)
}

describe('Sprint 89 Phase 2 T7 — PlanningHintsBuilder', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
    vi.restoreAllMocks()
  })

  it('builds versioned machine-readable hints without gateway/search', async () => {
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

    const hints = buildPlanningHints(base())
    expect(hints.contractVersion).toBe(PLANNING_HINTS_BUILDER_VERSION)
    expect(hints.toolDecision).toBe('ANSWER')
    expect(hints.nextPlannerAction).toBe('emit_answer')
    assertNoCopy(hints)
    if (spy) expect(spy).not.toHaveBeenCalled()
  })

  describe('English scenarios', () => {
    it('aggregates clarify path from T2–T6', () => {
      const missing: PlanningHintsBuilderInput['missing'] = {
        blocking: ['origin', 'dates'],
        deferrable: [],
        bookingOnly: ['passport'],
        confirmedFields: ['destination'],
        abort: false,
        goal: 'domain_flight',
        sufficientForAdvise: true,
        sufficientForSearch: false,
      }
      const conf = confidence({
        searchEligible: false,
        shouldClarify: true,
        confidenceLevel: 'unknown',
        blockingReason: 'blocking_fields_missing',
      })
      const clar = clarification({
        shouldAsk: true,
        questionCandidate: {
          field: 'destination',
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
          questionKey: 'destination',
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
      const toolDecision = toolFrom({
        missing,
        assumptions: { assumedFields: [], abort: false },
        confidence: conf,
        clarification: clar,
        locale: 'en',
      })
      const hints = buildPlanningHints({
        missing,
        assumptions: {
          assumedFields: [],
          abort: false,
          proposed: [],
          committable: [],
        },
        confidence: conf,
        clarification: clar,
        toolDecision,
        locale: 'en',
      })

      expect(hints.toolDecision).toBe('CLARIFY')
      expect(hints.nextPlannerAction).toBe('emit_clarify')
      expect(hints.blockingFields).toEqual(['origin', 'dates'])
      expect(hints.clarificationCandidate?.field).toBe('destination')
      expect(hints.shouldAsk).toBe(true)
      expect(hints.mergedFields).toEqual(['origin', 'dates'])
      expect(hints.confidence.shouldClarify).toBe(true)
      expect(hints.searchHandoff.status).toBe('blocked_clarification_pending')
      expect(hints.avoidReasons.some((a) => a.reason === 'booking_deferred')).toBe(true)
      expect(hints.reasoning.toolDecisionReason).toBe('clarification_required')
      expect(hints.toolDecision).not.toBe('SEARCH_HANDOFF')
      assertNoCopy(hints)
    })

    it('aggregates SEARCH_HANDOFF meta only', () => {
      const missing: PlanningHintsBuilderInput['missing'] = {
        blocking: [],
        deferrable: ['budget'],
        bookingOnly: ['passport'],
        confirmedFields: ['destination', 'origin', 'dates'],
        abort: false,
        goal: 'domain_flight',
        sufficientForAdvise: true,
        sufficientForSearch: true,
      }
      const conf = confidence({
        searchEligible: true,
        confidenceLevel: 'confirmed',
      })
      const clar = clarification({ shouldAsk: false })
      const assumptions = {
        assumedFields: ['adults'],
        abort: false,
        proposed: [assumedAdults()],
        committable: [assumedAdults()],
      }
      const toolDecision = toolFrom({
        missing,
        assumptions: { assumedFields: ['adults'], abort: false },
        confidence: conf,
        clarification: clar,
        locale: 'en',
      })
      const hints = buildPlanningHints({
        missing,
        assumptions,
        confidence: conf,
        clarification: clar,
        toolDecision,
        locale: 'en',
      })

      expect(hints.toolDecision).toBe('SEARCH_HANDOFF')
      expect(hints.nextPlannerAction).toBe('emit_search_handoff_meta')
      expect(hints.confidence.searchEligible).toBe(true)
      expect(hints.searchHandoff.status).toBe('eligible')
      expect(hints.searchHandoff.executeSearch).toBe(false)
      expect(hints.executeSearch).toBe(false)
      expect(hints.assumptions[0]?.source).toBe('assumed')
      expect(hints.confirmedFields).toEqual(
        expect.arrayContaining(['destination', 'origin', 'dates']),
      )
      expect(hints.reasoning.goal).toBe('domain_flight')
      assertNoCopy(hints)
    })
  })

  describe('Arabic scenarios', () => {
    it('abort → emit_abort with abort_locked handoff meta', () => {
      const missing: PlanningHintsBuilderInput['missing'] = {
        blocking: ['origin'],
        deferrable: [],
        bookingOnly: [],
        confirmedFields: ['destination'],
        abort: true,
        goal: 'domain_flight',
        sufficientForAdvise: true,
        sufficientForSearch: false,
      }
      const conf = confidence({ searchEligible: false })
      const clar = clarification({
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
      })
      const toolDecision = toolFrom({
        missing,
        assumptions: { assumedFields: [], abort: true },
        confidence: conf,
        clarification: clar,
        locale: 'ar',
        abort: true,
      })
      const hints = buildPlanningHints({
        missing,
        assumptions: {
          assumedFields: [],
          abort: true,
          proposed: [],
          committable: [],
        },
        confidence: conf,
        clarification: clar,
        toolDecision,
        locale: 'ar',
      })

      expect(hints.toolDecision).toBe('ABORT')
      expect(hints.nextPlannerAction).toBe('emit_abort')
      expect(hints.searchHandoff.status).toBe('abort_locked')
      expect(hints.reasoning.locale).toBe('ar')
      expect(hints.confirmedFields).toContain('destination')
      assertNoCopy(hints)
    })

    it('visa_guidance HANDOFF preserves confirmed + avoidReasons', () => {
      const missing: PlanningHintsBuilderInput['missing'] = {
        blocking: [],
        deferrable: [],
        bookingOnly: ['passport'],
        confirmedFields: ['destination'],
        abort: false,
        goal: 'visa_guidance',
        sufficientForAdvise: true,
        sufficientForSearch: false,
      }
      const conf = confidence({ searchEligible: false })
      const clar = clarification({
        shouldAsk: false,
        avoidReasons: [
          { field: 'passport', reason: 'booking_deferred' },
          { field: 'destination', reason: 'already_known' },
        ],
      })
      const toolDecision = toolFrom({
        missing,
        assumptions: { assumedFields: [], abort: false },
        confidence: conf,
        clarification: clar,
        locale: 'ar',
      })
      const hints = buildPlanningHints({
        missing,
        assumptions: {
          assumedFields: [],
          abort: false,
          proposed: [],
          committable: [],
        },
        confidence: conf,
        clarification: clar,
        toolDecision,
        locale: 'ar',
      })

      expect(hints.toolDecision).toBe('HANDOFF')
      expect(hints.nextPlannerAction).toBe('emit_handoff')
      expect(hints.blockingFields).toEqual([])
      expect(hints.clarificationCandidate).toBeNull()
      expect(hints.avoidReasons.some((a) => a.field === 'passport')).toBe(true)
      expect(hints.reasoning.locale).toBe('ar')
      assertNoCopy(hints)
    })
  })

  describe('invariants + class API', () => {
    it('searchEligible mirrors SEARCH_HANDOFF only', () => {
      for (const decision of [
        'ANSWER',
        'CLARIFY',
        'SEARCH_HANDOFF',
        'ABORT',
        'HANDOFF',
      ] as const) {
        const toolDecision: ToolDecisionResult = {
          contractVersion: TOOL_DECISION_BRIDGE_VERSION,
          toolDecision: decision,
          searchEligible: decision === 'SEARCH_HANDOFF',
          executeSearch: false,
          invokeGateway: false,
          reason: 'advise_without_search',
          searchHandoff: {
            status: decision === 'SEARCH_HANDOFF' ? 'eligible' : 'blocked_not_search_goal',
            executeSearch: false,
            invokeGateway: false,
          },
          diagnostics: {
            blocking: [],
            shouldAsk: decision === 'CLARIFY',
            confidenceShouldClarify: decision === 'CLARIFY',
            assumedFields: [],
            confirmedFields: ['destination'],
            goal: 'advise',
            locale: 'en',
          },
        }
        const hints = buildPlanningHints({
          ...base({
            clarification: clarification({
              shouldAsk: decision === 'CLARIFY',
              questionCandidate:
                decision === 'CLARIFY'
                  ? {
                      field: 'dates',
                      reason: 'absent_from_known_slots',
                      detail: 'dates',
                    }
                  : null,
            }),
            toolDecision,
          }),
          toolDecision,
        })
        expect(hints.confidence.searchEligible).toBe(decision === 'SEARCH_HANDOFF')
        expect(assertPlanningHintsInvariants(hints)).toBe(true)
      }
    })

    it('class build delegates to pure function', () => {
      const input = base()
      expect(createPlanningHintsBuilder().build(input)).toEqual(buildPlanningHints(input))
    })

    it('does not mutate input objects', () => {
      const input = base()
      const blockingBefore = [...input.missing.blocking]
      const assumedBefore = [...input.assumptions.assumedFields]
      buildPlanningHints(input)
      expect(input.missing.blocking).toEqual(blockingBefore)
      expect(input.assumptions.assumedFields).toEqual(assumedBefore)
    })
  })
})
