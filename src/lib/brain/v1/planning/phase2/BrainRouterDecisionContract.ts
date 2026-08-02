/**
 * Sprint 89 Phase 2 (T9) — BrainRouterDecisionContract.
 *
 * Pure contract builder: BrainRouterPlanningResult (T8) → immutable decision contract
 * for a future BrainRouter runtime.
 *
 * Contract only — no BrainRouter execution, CM, Search, Gateway, or LLM calls.
 * Never changes planner decisions. Never mutates state.
 */

import type {
  BrainRouterClarificationSlice,
  BrainRouterPlanningResult,
} from './BrainRouterPlanningAdapter'
import { BRAIN_ROUTER_PLANNING_ADAPTER_VERSION } from './BrainRouterPlanningAdapter'
import type {
  NextPlannerAction,
  PlanningHintsAssumption,
  PlanningHintsConfidence,
  PlanningHintsReasoning,
} from './PlanningHintsBuilder'
import type { SearchHandoffMeta, ToolDecision } from './ToolDecisionBridge'

export const BRAIN_ROUTER_DECISION_CONTRACT_VERSION =
  'brain-router-decision-contract@1.x' as const

/** Sealed decision payload preserved from T8 planning result. */
export type BrainRouterDecisionPayload = {
  readonly toolDecision: ToolDecision
  readonly plannerAction: NextPlannerAction
  readonly confidence: Readonly<PlanningHintsConfidence>
  readonly clarification: BrainRouterClarificationSlice
  readonly searchHandoff: Readonly<SearchHandoffMeta>
  readonly assumptions: readonly PlanningHintsAssumption[]
  readonly confirmedFields: readonly string[]
  readonly blockingFields: readonly string[]
  readonly reasoning: Readonly<PlanningHintsReasoning>
}

/** Capability flags — all false in Phase 2 compile-only contract. */
export type BrainRouterDecisionCapabilities = {
  readonly executeSearch: false
  readonly invokeGateway: false
  readonly invokeBrainRouter: false
  readonly invokeConversationManager: false
  readonly invokeLlm: false
}

/**
 * Stable immutable decision contract for future BrainRouter runtime consumption.
 */
export type BrainRouterDecisionContract = {
  readonly contractVersion: typeof BRAIN_ROUTER_DECISION_CONTRACT_VERSION
  /** Preserved T8 adapter contract version. */
  readonly planningAdapterContractVersion: typeof BRAIN_ROUTER_PLANNING_ADAPTER_VERSION
  /** Preserved T7 hints contract version echoed via T8. */
  readonly planningHintsContractVersion: BrainRouterPlanningResult['planningHintsContractVersion']
  readonly decision: BrainRouterDecisionPayload
  readonly capabilities: BrainRouterDecisionCapabilities
  /** Marker that this object is a sealed compile-time contract (not executable). */
  readonly sealed: true
}

export type BrainRouterDecisionContractInput = {
  /** Sole input — output of BrainRouterPlanningAdapter (T8). */
  planningResult: BrainRouterPlanningResult
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
 * Build an immutable BrainRouterDecisionContract from a T8 planning result.
 * Preserves planner outputs exactly — no recomputation.
 */
export function buildBrainRouterDecisionContract(
  input: BrainRouterDecisionContractInput,
): BrainRouterDecisionContract {
  const src = input.planningResult

  const contract: BrainRouterDecisionContract = {
    contractVersion: BRAIN_ROUTER_DECISION_CONTRACT_VERSION,
    planningAdapterContractVersion: src.contractVersion,
    planningHintsContractVersion: src.planningHintsContractVersion,
    decision: {
      toolDecision: src.toolDecision,
      plannerAction: src.plannerAction,
      confidence: {
        level: src.confidence.level,
        searchEligible: src.confidence.searchEligible,
        shouldClarify: src.confidence.shouldClarify,
        blockingReason: src.confidence.blockingReason,
      },
      clarification: {
        shouldAsk: src.clarification.shouldAsk,
        candidate: src.clarification.candidate
          ? {
              field: src.clarification.candidate.field,
              reason: src.clarification.candidate.reason,
              detail: src.clarification.candidate.detail,
            }
          : null,
        mergedFields: [...src.clarification.mergedFields],
        avoidReasons: src.clarification.avoidReasons.map((a) => ({
          field: a.field,
          reason: a.reason,
        })),
      },
      searchHandoff: {
        status: src.searchHandoff.status,
        executeSearch: false,
        invokeGateway: false,
      },
      assumptions: src.assumptions.map((a) => ({
        field: a.field,
        value: a.value,
        source: 'assumed' as const,
        reason: a.reason,
        confidence: { ...a.confidence },
        reversible: true as const,
        commitToMemory: a.commitToMemory,
      })),
      confirmedFields: [...src.confirmedFields],
      blockingFields: [...src.blockingFields],
      reasoning: {
        toolDecisionReason: src.reasoning.toolDecisionReason,
        goal: src.reasoning.goal,
        sufficientForAdvise: src.reasoning.sufficientForAdvise,
        sufficientForSearch: src.reasoning.sufficientForSearch,
        assumedFields: [...src.reasoning.assumedFields],
        deferrableFields: [...src.reasoning.deferrableFields],
        bookingOnlyFields: [...src.reasoning.bookingOnlyFields],
        locale: src.reasoning.locale,
      },
    },
    capabilities: {
      executeSearch: false,
      invokeGateway: false,
      invokeBrainRouter: false,
      invokeConversationManager: false,
      invokeLlm: false,
    },
    sealed: true,
  }

  return freezeDeep(contract)
}

/** Invariants: decisions preserved from T8; capabilities all false; sealed + frozen. */
export function assertBrainRouterDecisionContractInvariants(
  contract: BrainRouterDecisionContract,
  source: BrainRouterPlanningResult,
): boolean {
  if (!contract.sealed) return false
  if (!Object.isFrozen(contract)) return false
  if (contract.decision.toolDecision !== source.toolDecision) return false
  if (contract.decision.plannerAction !== source.plannerAction) return false
  if (contract.decision.confidence.level !== source.confidence.level) return false
  if (contract.decision.confidence.searchEligible !== source.confidence.searchEligible) {
    return false
  }
  if (contract.decision.clarification.shouldAsk !== source.clarification.shouldAsk) {
    return false
  }
  if (contract.decision.searchHandoff.status !== source.searchHandoff.status) return false
  if (
    contract.decision.confidence.searchEligible
    !== (contract.decision.toolDecision === 'SEARCH_HANDOFF')
  ) {
    return false
  }
  const caps = contract.capabilities
  if (
    caps.executeSearch
    || caps.invokeGateway
    || caps.invokeBrainRouter
    || caps.invokeConversationManager
    || caps.invokeLlm
  ) {
    return false
  }
  return true
}

export class BrainRouterDecisionContractBuilder {
  readonly version = BRAIN_ROUTER_DECISION_CONTRACT_VERSION

  build(input: BrainRouterDecisionContractInput): BrainRouterDecisionContract {
    return buildBrainRouterDecisionContract(input)
  }
}

export function createBrainRouterDecisionContractBuilder(): BrainRouterDecisionContractBuilder {
  return new BrainRouterDecisionContractBuilder()
}
