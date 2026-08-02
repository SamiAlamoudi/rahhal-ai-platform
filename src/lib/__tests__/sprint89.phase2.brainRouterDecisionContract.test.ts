/**
 * Sprint 89 Phase 2 T9 — BrainRouterDecisionContract (pure contract only).
 * No BrainRouter runtime, CM, Search, Gateway, LLM, or Phase 3.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import {
  adaptPlanningHintsForBrainRouter,
  assertBrainRouterDecisionContractInvariants,
  BRAIN_ROUTER_DECISION_CONTRACT_VERSION,
  BRAIN_ROUTER_PLANNING_ADAPTER_VERSION,
  buildBrainRouterDecisionContract,
  buildPlanningHints,
  createBrainRouterDecisionContractBuilder,
  decideToolDecision,
  PLANNING_HINTS_BUILDER_VERSION,
  type AssumptionDecision,
  type BrainRouterPlanningResult,
  type ClarificationBridgeResult,
  type ConfidenceDecision,
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

function planningResultFor(
  overrides: Partial<PlanningHintsBuilderInput> & { locale?: 'ar' | 'en' } = {},
): BrainRouterPlanningResult {
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
  const hints = buildPlanningHints({
    missing,
    assumptions,
    confidence: conf,
    clarification: clar,
    toolDecision,
    locale,
  })
  return adaptPlanningHintsForBrainRouter({ planningHints: hints })
}

describe('Sprint 89 Phase 2 T9 — BrainRouterDecisionContract', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
    vi.restoreAllMocks()
  })

  it('builds sealed contract from T8 without gateway/LLM', async () => {
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

    const source = planningResultFor({ locale: 'en' })
    const contract = buildBrainRouterDecisionContract({ planningResult: source })
    expect(contract.contractVersion).toBe(BRAIN_ROUTER_DECISION_CONTRACT_VERSION)
    expect(contract.planningAdapterContractVersion).toBe(BRAIN_ROUTER_PLANNING_ADAPTER_VERSION)
    expect(contract.planningHintsContractVersion).toBe(PLANNING_HINTS_BUILDER_VERSION)
    expect(contract.sealed).toBe(true)
    expect(contract.capabilities.invokeLlm).toBe(false)
    expect(assertBrainRouterDecisionContractInvariants(contract, source)).toBe(true)
    if (spy) expect(spy).not.toHaveBeenCalled()
  })

  describe('English', () => {
    it('preserves ANSWER toolDecision and plannerAction', () => {
      const source = planningResultFor({ locale: 'en' })
      const contract = buildBrainRouterDecisionContract({ planningResult: source })
      expect(contract.decision.toolDecision).toBe('ANSWER')
      expect(contract.decision.plannerAction).toBe('emit_answer')
      expect(contract.decision.toolDecision).toBe(source.toolDecision)
      expect(contract.decision.confirmedFields).toEqual(source.confirmedFields)
      expect(contract.decision.assumptions[0]?.source).toBe('assumed')
      expect(contract.decision.reasoning.locale).toBe('en')
    })

    it('preserves CLARIFY metadata exactly', () => {
      const source = planningResultFor({
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
        clarification: clarification({
          shouldAsk: true,
          questionCandidate: {
            field: 'dates',
            reason: 'merged_blocking_gap',
            detail: 'origin+dates',
          },
          mergedFields: ['origin', 'dates'],
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
        }),
        assumptions: {
          assumedFields: [],
          abort: false,
          proposed: [],
          committable: [],
        },
      })
      const contract = buildBrainRouterDecisionContract({ planningResult: source })
      expect(contract.decision.toolDecision).toBe('CLARIFY')
      expect(contract.decision.plannerAction).toBe('emit_clarify')
      expect(contract.decision.clarification.shouldAsk).toBe(true)
      expect(contract.decision.clarification.candidate?.field).toBe('dates')
      expect(contract.decision.blockingFields).toEqual(['origin', 'dates'])
      expect(contract.decision.searchHandoff.status).toBe('blocked_clarification_pending')
      expect(contract.decision.confidence.shouldClarify).toBe(true)
      expect(assertBrainRouterDecisionContractInvariants(contract, source)).toBe(true)
    })

    it('preserves SEARCH_HANDOFF with execute flags false', () => {
      const source = planningResultFor({
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
        confidence: confidence({ searchEligible: true }),
        clarification: clarification({ shouldAsk: false }),
      })
      const contract = buildBrainRouterDecisionContract({ planningResult: source })
      expect(contract.decision.toolDecision).toBe('SEARCH_HANDOFF')
      expect(contract.decision.plannerAction).toBe('emit_search_handoff_meta')
      expect(contract.decision.confidence.searchEligible).toBe(true)
      expect(contract.decision.searchHandoff.status).toBe('eligible')
      expect(contract.decision.searchHandoff.executeSearch).toBe(false)
      expect(contract.capabilities.executeSearch).toBe(false)
      expect(contract.capabilities.invokeGateway).toBe(false)
    })
  })

  describe('Arabic', () => {
    it('preserves ABORT decision and ar locale', () => {
      const source = planningResultFor({
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
      const contract = buildBrainRouterDecisionContract({ planningResult: source })
      expect(contract.decision.toolDecision).toBe('ABORT')
      expect(contract.decision.plannerAction).toBe('emit_abort')
      expect(contract.decision.searchHandoff.status).toBe('abort_locked')
      expect(contract.decision.reasoning.locale).toBe('ar')
      expect(contract.decision.confirmedFields).toContain('destination')
      expect(assertBrainRouterDecisionContractInvariants(contract, source)).toBe(true)
    })

    it('preserves HANDOFF for visa_guidance', () => {
      const source = planningResultFor({
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
      })
      const contract = buildBrainRouterDecisionContract({ planningResult: source })
      expect(contract.decision.toolDecision).toBe('HANDOFF')
      expect(contract.decision.plannerAction).toBe('emit_handoff')
      expect(contract.decision.reasoning.locale).toBe('ar')
      expect(
        contract.decision.clarification.avoidReasons.some((a) => a.field === 'passport'),
      ).toBe(true)
    })
  })

  describe('immutability + non-mutation', () => {
    it('freezes contract and does not mutate T8 planning result', () => {
      const source = planningResultFor({ locale: 'en' })
      const toolBefore = source.toolDecision
      const confirmedBefore = [...source.confirmedFields]
      const contract = buildBrainRouterDecisionContract({ planningResult: source })

      expect(Object.isFrozen(contract)).toBe(true)
      expect(Object.isFrozen(contract.decision)).toBe(true)
      expect(Object.isFrozen(contract.capabilities)).toBe(true)
      expect(() => {
        ;(contract as { sealed: boolean }).sealed = false
      }).toThrow()

      expect(source.toolDecision).toBe(toolBefore)
      expect(source.confirmedFields).toEqual(confirmedBefore)
    })

    it('class build delegates to pure function', () => {
      const source = planningResultFor()
      const input = { planningResult: source }
      expect(createBrainRouterDecisionContractBuilder().build(input)).toEqual(
        buildBrainRouterDecisionContract(input),
      )
    })

    it('never changes planner decisions relative to T8 result', () => {
      const source = planningResultFor({
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
      const contract = buildBrainRouterDecisionContract({ planningResult: source })
      expect(contract.decision.toolDecision).toBe(source.toolDecision)
      expect(contract.decision.plannerAction).toBe(source.plannerAction)
      expect(contract.decision.confidence).toEqual(source.confidence)
      expect(contract.decision.searchHandoff.status).toBe(source.searchHandoff.status)
      expect(contract.capabilities.invokeBrainRouter).toBe(false)
      expect(contract.capabilities.invokeConversationManager).toBe(false)
      expect(contract.capabilities.invokeLlm).toBe(false)
    })
  })
})
