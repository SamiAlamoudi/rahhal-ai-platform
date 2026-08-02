/**
 * Sprint 89 Phase 2 (T8) — BrainRouterPlanningAdapter.
 *
 * Pure adapter: PlanningHints (T7) → immutable BrainRouterPlanningResult.
 * Does NOT invoke BrainRouter, ConversationManager, Search, Gateway, or LLMs.
 * Never changes planner decisions. Never mutates Phase 1 / Phase 2 state.
 */

import type {
  ClarificationAvoidReason,
  ClarificationQuestionCandidatePlan,
} from './ClarificationBridge'
import type {
  NextPlannerAction,
  PlanningHints,
  PlanningHintsAssumption,
  PlanningHintsConfidence,
  PlanningHintsReasoning,
} from './PlanningHintsBuilder'
import { PLANNING_HINTS_BUILDER_VERSION } from './PlanningHintsBuilder'
import type { SearchHandoffMeta, ToolDecision } from './ToolDecisionBridge'

export const BRAIN_ROUTER_PLANNING_ADAPTER_VERSION =
  'brain-router-planning-adapter@1.x' as const

/** Stable BrainRouter-facing clarification slice (no user-facing copy). */
export type BrainRouterClarificationSlice = {
  shouldAsk: boolean
  candidate: ClarificationQuestionCandidatePlan | null
  mergedFields: readonly string[]
  avoidReasons: readonly ClarificationAvoidReason[]
}

/** Immutable BrainRouter-facing planning contract. */
export type BrainRouterPlanningResult = {
  readonly contractVersion: typeof BRAIN_ROUTER_PLANNING_ADAPTER_VERSION
  /** Preserved PlanningHints contract version from T7. */
  readonly planningHintsContractVersion: typeof PLANNING_HINTS_BUILDER_VERSION
  readonly toolDecision: ToolDecision
  readonly confidence: Readonly<PlanningHintsConfidence>
  readonly clarification: BrainRouterClarificationSlice
  readonly assumptions: readonly PlanningHintsAssumption[]
  readonly confirmedFields: readonly string[]
  readonly blockingFields: readonly string[]
  readonly searchHandoff: Readonly<SearchHandoffMeta>
  readonly plannerAction: NextPlannerAction
  readonly reasoning: Readonly<PlanningHintsReasoning>
  /** Always false — adapter never executes search. */
  readonly executeSearch: false
  /** Always false — adapter never invokes gateway. */
  readonly invokeGateway: false
  /** Always false — adapter does not call BrainRouter. */
  readonly invokeBrainRouter: false
  /** Always false — adapter does not call ConversationManager. */
  readonly invokeConversationManager: false
}

export type BrainRouterPlanningAdapterInput = {
  /** Sole input — output of PlanningHintsBuilder (T7). */
  planningHints: PlanningHints
}

function freezeDeep<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  if (Object.isFrozen(value)) return value
  for (const key of Object.keys(value as object)) {
    const child = (value as Record<string, unknown>)[key]
    if (child !== null && typeof child === 'object') {
      freezeDeep(child)
    }
  }
  return Object.freeze(value)
}

/**
 * Normalize PlanningHints into an immutable BrainRouter-facing result.
 * Preserves decisions exactly — no recomputation of ToolDecision / clarify / confidence.
 */
export function adaptPlanningHintsForBrainRouter(
  input: BrainRouterPlanningAdapterInput,
): BrainRouterPlanningResult {
  const hints = input.planningHints

  const result: BrainRouterPlanningResult = {
    contractVersion: BRAIN_ROUTER_PLANNING_ADAPTER_VERSION,
    planningHintsContractVersion: hints.contractVersion,
    toolDecision: hints.toolDecision,
    confidence: {
      level: hints.confidence.level,
      searchEligible: hints.confidence.searchEligible,
      shouldClarify: hints.confidence.shouldClarify,
      blockingReason: hints.confidence.blockingReason,
    },
    clarification: {
      shouldAsk: hints.shouldAsk,
      candidate: hints.clarificationCandidate
        ? {
            field: hints.clarificationCandidate.field,
            reason: hints.clarificationCandidate.reason,
            detail: hints.clarificationCandidate.detail,
          }
        : null,
      mergedFields: [...hints.mergedFields],
      avoidReasons: hints.avoidReasons.map((a) => ({
        field: a.field,
        reason: a.reason,
      })),
    },
    assumptions: hints.assumptions.map((a) => ({
      field: a.field,
      value: a.value,
      source: 'assumed' as const,
      reason: a.reason,
      confidence: { ...a.confidence },
      reversible: true as const,
      commitToMemory: a.commitToMemory,
    })),
    confirmedFields: [...hints.confirmedFields],
    blockingFields: [...hints.blockingFields],
    searchHandoff: {
      status: hints.searchHandoff.status,
      executeSearch: false,
      invokeGateway: false,
    },
    plannerAction: hints.nextPlannerAction,
    reasoning: {
      toolDecisionReason: hints.reasoning.toolDecisionReason,
      goal: hints.reasoning.goal,
      sufficientForAdvise: hints.reasoning.sufficientForAdvise,
      sufficientForSearch: hints.reasoning.sufficientForSearch,
      assumedFields: [...hints.reasoning.assumedFields],
      deferrableFields: [...hints.reasoning.deferrableFields],
      bookingOnlyFields: [...hints.reasoning.bookingOnlyFields],
      locale: hints.reasoning.locale,
    },
    executeSearch: false,
    invokeGateway: false,
    invokeBrainRouter: false,
    invokeConversationManager: false,
  }

  return freezeDeep(result)
}

/** Invariants: decisions preserved; no execute flags. */
export function assertBrainRouterPlanningInvariants(
  result: BrainRouterPlanningResult,
  source: PlanningHints,
): boolean {
  if (result.executeSearch !== false) return false
  if (result.invokeGateway !== false) return false
  if (result.invokeBrainRouter !== false) return false
  if (result.invokeConversationManager !== false) return false
  if (result.toolDecision !== source.toolDecision) return false
  if (result.plannerAction !== source.nextPlannerAction) return false
  if (result.confidence.searchEligible !== source.confidence.searchEligible) return false
  if (result.confidence.level !== source.confidence.level) return false
  if (result.clarification.shouldAsk !== source.shouldAsk) return false
  if (result.searchHandoff.status !== source.searchHandoff.status) return false
  if (result.confidence.searchEligible !== (result.toolDecision === 'SEARCH_HANDOFF')) {
    return false
  }
  if (!Object.isFrozen(result)) return false
  return true
}

export class BrainRouterPlanningAdapter {
  readonly version = BRAIN_ROUTER_PLANNING_ADAPTER_VERSION

  adapt(input: BrainRouterPlanningAdapterInput): BrainRouterPlanningResult {
    return adaptPlanningHintsForBrainRouter(input)
  }
}

export function createBrainRouterPlanningAdapter(): BrainRouterPlanningAdapter {
  return new BrainRouterPlanningAdapter()
}
