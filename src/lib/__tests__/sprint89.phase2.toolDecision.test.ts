/**
 * Sprint 89 Phase 2 T6 — ToolDecisionBridge (pure decision only).
 * No Search / Gateway / BrainRouter / CM / flags / Phase 3.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import {
  assertSearchEligibleInvariant,
  CONFIDENCE_GATES_VERSION,
  CLARIFICATION_BRIDGE_VERSION,
  createToolDecisionBridge,
  decideToolDecision,
  TOOL_DECISION_BRIDGE_VERSION,
  type ClarificationBridgeResult,
  type ConfidenceDecision,
  type ToolDecisionBridgeInput,
  type ToolDecision,
} from '../brain/v1/planning/phase2'

function confidence(partial: Partial<ConfidenceDecision> = {}): ConfidenceDecision {
  return {
    contractVersion: CONFIDENCE_GATES_VERSION,
    confidenceLevel: 'unknown',
    searchEligible: false,
    shouldClarify: false,
    blockingReason: null,
    ...partial,
  }
}

function clarification(
  partial: Partial<ClarificationBridgeResult> = {},
): ToolDecisionBridgeInput['clarification'] {
  const full: ClarificationBridgeResult = {
    contractVersion: CLARIFICATION_BRIDGE_VERSION,
    shouldAsk: false,
    questionCandidate: null,
    mergedFields: [],
    avoidReasons: [],
    planningHints: {
      shouldAsk: false,
      questionKey: null,
      mergedFields: [],
      avoidReasons: [],
      searchEligible: false,
      confidenceLevel: 'unknown',
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
        confidenceLevel: 'unknown',
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
    planningHints: full.planningHints,
  }
}

function base(
  overrides: Partial<ToolDecisionBridgeInput> = {},
): ToolDecisionBridgeInput {
  return {
    missing: {
      blocking: [],
      deferrable: [],
      bookingOnly: ['passport', 'payment'],
      confirmedFields: [],
      abort: false,
      goal: 'advise',
      sufficientForAdvise: true,
      sufficientForSearch: false,
    },
    assumptions: { assumedFields: [], abort: false },
    confidence: confidence(),
    clarification: clarification(),
    abort: false,
    locale: 'en',
    ...overrides,
  }
}

function expectDecisionOnly(result: ReturnType<typeof decideToolDecision>): void {
  expect(result.executeSearch).toBe(false)
  expect(result.invokeGateway).toBe(false)
  expect(result.searchHandoff.executeSearch).toBe(false)
  expect(result.searchHandoff.invokeGateway).toBe(false)
  expect(assertSearchEligibleInvariant(result)).toBe(true)
  expect(result).not.toHaveProperty('ar')
  expect(result).not.toHaveProperty('en')
  expect(result).not.toHaveProperty('toolBatch')
  const five: ToolDecision[] = [
    'ANSWER',
    'CLARIFY',
    'SEARCH_HANDOFF',
    'ABORT',
    'HANDOFF',
  ]
  expect(five).toContain(result.toolDecision)
}

describe('Sprint 89 Phase 2 T6 — ToolDecisionBridge', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
    vi.restoreAllMocks()
  })

  it('exposes version and never invokes gateway/search', async () => {
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

    const result = decideToolDecision(base())
    expect(result.contractVersion).toBe(TOOL_DECISION_BRIDGE_VERSION)
    expectDecisionOnly(result)
    if (spy) expect(spy).not.toHaveBeenCalled()
  })

  describe('ABORT', () => {
    it('en: explicit abort → ABORT', () => {
      const result = decideToolDecision(base({ abort: true, locale: 'en' }))
      expect(result.toolDecision).toBe('ABORT')
      expect(result.searchEligible).toBe(false)
      expect(result.reason).toBe('abort_path')
      expect(result.searchHandoff.status).toBe('abort_locked')
    })

    it('ar: missing.abort → ABORT', () => {
      const result = decideToolDecision(
        base({
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
        }),
      )
      expect(result.toolDecision).toBe('ABORT')
      expect(result.diagnostics.locale).toBe('ar')
    })
  })

  describe('CLARIFY', () => {
    it('en: shouldAsk → CLARIFY; never SEARCH_HANDOFF', () => {
      const result = decideToolDecision(
        base({
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
            searchEligible: false,
            shouldClarify: true,
            blockingReason: 'blocking_fields_missing',
          }),
          clarification: clarification({
            shouldAsk: true,
            questionCandidate: {
              field: 'destination',
              reason: 'merged_blocking_gap',
              detail: 'origin+dates',
            },
            mergedFields: ['origin', 'dates'],
            planningHints: {
              shouldAsk: true,
              questionKey: 'destination',
              mergedFields: ['origin', 'dates'],
              avoidReasons: [],
              searchEligible: false,
              confidenceLevel: 'unknown',
              confidenceShouldClarify: true,
              assumedFields: [],
              correctedFields: [],
              moveHint: 'clarify',
              questionBudgetUsed: 1,
            },
          }),
        }),
      )
      expect(result.toolDecision).toBe('CLARIFY')
      expect(result.searchEligible).toBe(false)
      expect(result.searchHandoff.status).toBe('blocked_clarification_pending')
      expectDecisionOnly(result)
    })

    it('ar: blocking present even without shouldAsk still not SEARCH_HANDOFF', () => {
      const result = decideToolDecision(
        base({
          locale: 'ar',
          missing: {
            blocking: ['dates'],
            deferrable: [],
            bookingOnly: [],
            confirmedFields: ['destination', 'origin'],
            abort: false,
            goal: 'domain_flight',
            sufficientForAdvise: true,
            sufficientForSearch: false,
          },
          confidence: confidence({ searchEligible: false }),
          clarification: clarification({ shouldAsk: false }),
        }),
      )
      expect(result.toolDecision).toBe('ANSWER')
      expect(result.reason).toBe('blocking_prevents_search_handoff')
      expect(result.searchEligible).toBe(false)
    })
  })

  describe('SEARCH_HANDOFF', () => {
    it('en: searchEligible flight → SEARCH_HANDOFF meta only', () => {
      const result = decideToolDecision(
        base({
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
          confidence: confidence({
            searchEligible: true,
            shouldClarify: false,
            confidenceLevel: 'confirmed',
          }),
          clarification: clarification({ shouldAsk: false }),
          assumptions: { assumedFields: ['adults'], abort: false },
        }),
      )
      expect(result.toolDecision).toBe('SEARCH_HANDOFF')
      expect(result.searchEligible).toBe(true)
      expect(result.executeSearch).toBe(false)
      expect(result.invokeGateway).toBe(false)
      expect(result.searchHandoff.status).toBe('eligible')
      expect(result.reason).toBe('search_eligible_meta_only')
    })

    it('ar: searchEligible hotel → SEARCH_HANDOFF', () => {
      const result = decideToolDecision(
        base({
          locale: 'ar',
          missing: {
            blocking: [],
            deferrable: [],
            bookingOnly: ['payment'],
            confirmedFields: ['destination', 'dates'],
            abort: false,
            goal: 'domain_hotel',
            sufficientForAdvise: true,
            sufficientForSearch: true,
          },
          confidence: confidence({ searchEligible: true, confidenceLevel: 'confirmed' }),
        }),
      )
      expect(result.toolDecision).toBe('SEARCH_HANDOFF')
      expect(assertSearchEligibleInvariant(result)).toBe(true)
    })

    it('booking-only blocking noise does not prevent SEARCH_HANDOFF', () => {
      const result = decideToolDecision(
        base({
          missing: {
            blocking: ['passport', 'payment'],
            deferrable: [],
            bookingOnly: ['passport', 'payment'],
            confirmedFields: ['destination', 'origin', 'dates'],
            abort: false,
            goal: 'search',
            sufficientForAdvise: true,
            sufficientForSearch: true,
          },
          confidence: confidence({ searchEligible: true }),
        }),
      )
      expect(result.diagnostics.blocking).toEqual([])
      expect(result.toolDecision).toBe('SEARCH_HANDOFF')
    })
  })

  describe('HANDOFF (non-search)', () => {
    it('en: compare goal with confirmed destination → HANDOFF', () => {
      const result = decideToolDecision(
        base({
          locale: 'en',
          missing: {
            blocking: [],
            deferrable: [],
            bookingOnly: [],
            confirmedFields: ['destination'],
            abort: false,
            goal: 'compare',
            sufficientForAdvise: true,
            sufficientForSearch: false,
          },
          confidence: confidence({ searchEligible: false }),
        }),
      )
      expect(result.toolDecision).toBe('HANDOFF')
      expect(result.searchEligible).toBe(false)
      expect(result.reason).toBe('non_search_planning_handoff')
      expect(result.searchHandoff.status).toBe('blocked_not_search_goal')
    })

    it('ar: visa_guidance → HANDOFF when no ask', () => {
      const result = decideToolDecision(
        base({
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
        }),
      )
      expect(result.toolDecision).toBe('HANDOFF')
      expect(result.executeSearch).toBe(false)
    })
  })

  describe('ANSWER', () => {
    it('en: advise without search → ANSWER', () => {
      const result = decideToolDecision(
        base({
          locale: 'en',
          missing: {
            blocking: [],
            deferrable: ['budget'],
            bookingOnly: [],
            confirmedFields: ['destination'],
            abort: false,
            goal: 'advise',
            sufficientForAdvise: true,
            sufficientForSearch: false,
          },
        }),
      )
      expect(result.toolDecision).toBe('ANSWER')
      expect(result.searchEligible).toBe(false)
      expect(result.reason).toBe('advise_without_search')
    })

    it('ar: explore → ANSWER', () => {
      const result = decideToolDecision(
        base({
          locale: 'ar',
          missing: {
            blocking: [],
            deferrable: [],
            bookingOnly: [],
            confirmedFields: [],
            abort: false,
            goal: 'explore',
            sufficientForAdvise: true,
            sufficientForSearch: false,
          },
        }),
      )
      expect(result.toolDecision).toBe('ANSWER')
    })
  })

  describe('invariants', () => {
    it('CLARIFY wins over searchEligible', () => {
      const result = decideToolDecision(
        base({
          missing: {
            blocking: ['dates'],
            deferrable: [],
            bookingOnly: [],
            confirmedFields: ['destination', 'origin'],
            abort: false,
            goal: 'domain_flight',
            sufficientForAdvise: true,
            sufficientForSearch: true,
          },
          confidence: confidence({ searchEligible: true, shouldClarify: true }),
          clarification: clarification({
            shouldAsk: true,
            questionCandidate: {
              field: 'dates',
              reason: 'absent_from_known_slots',
              detail: 'dates',
            },
            planningHints: {
              shouldAsk: true,
              questionKey: 'dates',
              mergedFields: ['dates'],
              avoidReasons: [],
              searchEligible: true,
              confidenceLevel: 'confirmed',
              confidenceShouldClarify: true,
              assumedFields: [],
              correctedFields: [],
              moveHint: 'clarify',
              questionBudgetUsed: 1,
            },
          }),
        }),
      )
      expect(result.toolDecision).toBe('CLARIFY')
      expect(result.searchEligible).toBe(false)
    })

    it('class decide delegates to pure function', () => {
      const input = base({
        missing: {
          blocking: [],
          deferrable: [],
          bookingOnly: [],
          confirmedFields: ['destination'],
          abort: false,
          goal: 'advise',
          sufficientForAdvise: true,
          sufficientForSearch: false,
        },
      })
      expect(createToolDecisionBridge().decide(input)).toEqual(decideToolDecision(input))
    })

    it('five-way enum exhaustiveness surface', () => {
      const seen = new Set<ToolDecision>()
      seen.add(decideToolDecision(base({ abort: true })).toolDecision)
      seen.add(
        decideToolDecision(
          base({
            clarification: clarification({
              shouldAsk: true,
              questionCandidate: {
                field: 'destination',
                reason: 'merged_blocking_gap',
                detail: 'x',
              },
            }),
          }),
        ).toolDecision,
      )
      seen.add(
        decideToolDecision(
          base({
            missing: {
              blocking: [],
              deferrable: [],
              bookingOnly: [],
              confirmedFields: ['destination', 'origin', 'dates'],
              abort: false,
              goal: 'domain_flight',
              sufficientForAdvise: true,
              sufficientForSearch: true,
            },
            confidence: confidence({ searchEligible: true }),
          }),
        ).toolDecision,
      )
      seen.add(
        decideToolDecision(
          base({
            missing: {
              blocking: [],
              deferrable: [],
              bookingOnly: [],
              confirmedFields: ['destination'],
              abort: false,
              goal: 'compare',
              sufficientForAdvise: true,
              sufficientForSearch: false,
            },
          }),
        ).toolDecision,
      )
      seen.add(decideToolDecision(base()).toolDecision)
      expect([...seen].sort()).toEqual(
        ['ABORT', 'ANSWER', 'CLARIFY', 'HANDOFF', 'SEARCH_HANDOFF'].sort(),
      )
    })
  })
})
