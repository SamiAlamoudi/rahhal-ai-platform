/**
 * Sprint 89 Phase 2 (T7) — PlanningHintsBuilder.
 *
 * Pure deterministic aggregation of T2–T6 planning outputs into
 * machine-readable PlanningHints for future consumers.
 *
 * Never executes Search/Gateway, never wires BrainRouter/CM,
 * never generates user-facing copy or prompts, never mutates Phase 1 state.
 */

import type {
  AssumptionDecision,
  AssumptionPolicyResult,
} from './AssumptionPolicy'
import type {
  ClarificationAvoidReason,
  ClarificationBridgeResult,
  ClarificationQuestionCandidatePlan,
} from './ClarificationBridge'
import type { ConfidenceDecision, ConfidenceLevel } from './ConfidenceGates'
import type {
  MissingInfoGoal,
  MissingInformationResult,
} from './MissingInformationPlanner'
import type {
  SearchHandoffMeta,
  ToolDecision,
  ToolDecisionReasonCode,
  ToolDecisionResult,
} from './ToolDecisionBridge'

export const PLANNING_HINTS_BUILDER_VERSION = 'planning-hints@1.x' as const

/**
 * Machine-readable next action for future planners / CM injection.
 * Not a prompt. Not executable tool call.
 */
export type NextPlannerAction =
  | 'emit_answer'
  | 'emit_clarify'
  | 'emit_search_handoff_meta'
  | 'emit_abort'
  | 'emit_handoff'
  | 'stop'

export type PlanningHintsAssumption = {
  field: string
  value: unknown
  source: 'assumed'
  reason: AssumptionDecision['reason']
  confidence: AssumptionDecision['confidence']
  reversible: true
  commitToMemory: boolean
}

export type PlanningHintsConfidence = {
  level: ConfidenceLevel
  searchEligible: boolean
  shouldClarify: boolean
  blockingReason: ConfidenceDecision['blockingReason']
}

export type PlanningHintsReasoning = {
  /** ToolDecisionBridge reason code — not chain-of-thought. */
  toolDecisionReason: ToolDecisionReasonCode
  goal: MissingInfoGoal
  sufficientForAdvise: boolean
  sufficientForSearch: boolean
  assumedFields: string[]
  deferrableFields: string[]
  bookingOnlyFields: string[]
  locale: 'ar' | 'en'
}

/**
 * Authoritative Phase 2 PlanningHints (machine-readable only).
 * No ar/en copy, no prompts, no toolBatch, no execute flags true.
 */
export type PlanningHints = {
  contractVersion: typeof PLANNING_HINTS_BUILDER_VERSION
  toolDecision: ToolDecision
  confidence: PlanningHintsConfidence
  blockingFields: string[]
  clarificationCandidate: ClarificationQuestionCandidatePlan | null
  shouldAsk: boolean
  mergedFields: string[]
  searchHandoff: SearchHandoffMeta
  assumptions: PlanningHintsAssumption[]
  confirmedFields: string[]
  reasoning: PlanningHintsReasoning
  avoidReasons: ClarificationAvoidReason[]
  nextPlannerAction: NextPlannerAction
  /** Always false — Phase 2 never executes search. */
  executeSearch: false
  /** Always false — Phase 2 never invokes gateway. */
  invokeGateway: false
}

export type PlanningHintsBuilderInput = {
  missing: Pick<
    MissingInformationResult,
    | 'blocking'
    | 'deferrable'
    | 'bookingOnly'
    | 'confirmedFields'
    | 'abort'
    | 'goal'
    | 'sufficientForAdvise'
    | 'sufficientForSearch'
  >
  assumptions: Pick<
    AssumptionPolicyResult,
    'assumedFields' | 'abort' | 'proposed' | 'committable'
  >
  confidence: ConfidenceDecision
  clarification: Pick<
    ClarificationBridgeResult,
    | 'shouldAsk'
    | 'questionCandidate'
    | 'mergedFields'
    | 'avoidReasons'
    | 'planningHints'
  >
  toolDecision: ToolDecisionResult
  locale?: 'ar' | 'en'
}

function mapNextPlannerAction(decision: ToolDecision): NextPlannerAction {
  switch (decision) {
    case 'ANSWER':
      return 'emit_answer'
    case 'CLARIFY':
      return 'emit_clarify'
    case 'SEARCH_HANDOFF':
      return 'emit_search_handoff_meta'
    case 'ABORT':
      return 'emit_abort'
    case 'HANDOFF':
      return 'emit_handoff'
    default: {
      const _exhaustive: never = decision
      return _exhaustive
    }
  }
}

function mapAssumptions(
  assumptions: PlanningHintsBuilderInput['assumptions'],
): PlanningHintsAssumption[] {
  // Prefer full proposed rows; fall back to committable. Never invent values.
  const rows =
    assumptions.proposed.length > 0 ? assumptions.proposed : assumptions.committable
  return rows.map((p) => ({
    field: p.field,
    value: p.value,
    source: 'assumed' as const,
    reason: p.reason,
    confidence: p.confidence,
    reversible: true as const,
    commitToMemory: p.commitToMemory,
  }))
}

/**
 * Pure PlanningHints aggregation. Deterministic. No side effects.
 */
export function buildPlanningHints(
  input: PlanningHintsBuilderInput,
): PlanningHints {
  const locale = input.locale ?? input.toolDecision.diagnostics.locale ?? 'en'
  const toolDecision = input.toolDecision.toolDecision

  // Prefer ToolDecisionBridge searchHandoff (authoritative for execute flags).
  const searchHandoff: SearchHandoffMeta = {
    status: input.toolDecision.searchHandoff.status,
    executeSearch: false,
    invokeGateway: false,
  }

  const assumptions = mapAssumptions(input.assumptions)

  return {
    contractVersion: PLANNING_HINTS_BUILDER_VERSION,
    toolDecision,
    confidence: {
      level: input.confidence.confidenceLevel,
      searchEligible: input.toolDecision.searchEligible,
      shouldClarify: input.confidence.shouldClarify,
      blockingReason: input.confidence.blockingReason,
    },
    blockingFields: [...input.missing.blocking],
    clarificationCandidate: input.clarification.questionCandidate,
    shouldAsk: input.clarification.shouldAsk,
    mergedFields: [...input.clarification.mergedFields],
    searchHandoff,
    assumptions,
    confirmedFields: [...input.missing.confirmedFields],
    reasoning: {
      toolDecisionReason: input.toolDecision.reason,
      goal: input.missing.goal,
      sufficientForAdvise: input.missing.sufficientForAdvise,
      sufficientForSearch: input.missing.sufficientForSearch,
      assumedFields: [...input.assumptions.assumedFields],
      deferrableFields: [...input.missing.deferrable],
      bookingOnlyFields: [...input.missing.bookingOnly],
      locale,
    },
    avoidReasons: [...input.clarification.avoidReasons],
    nextPlannerAction: mapNextPlannerAction(toolDecision),
    executeSearch: false,
    invokeGateway: false,
  }
}

/** Invariant helpers for tests / future planReasonTurn. */
export function assertPlanningHintsInvariants(hints: PlanningHints): boolean {
  if (hints.executeSearch !== false) return false
  if (hints.invokeGateway !== false) return false
  if (hints.searchHandoff.executeSearch !== false) return false
  if (hints.searchHandoff.invokeGateway !== false) return false
  if (hints.confidence.searchEligible !== (hints.toolDecision === 'SEARCH_HANDOFF')) {
    return false
  }
  if (hints.shouldAsk && hints.toolDecision === 'SEARCH_HANDOFF') return false
  if (hints.assumptions.some((a) => a.source !== 'assumed')) return false
  return true
}

export class PlanningHintsBuilder {
  readonly version = PLANNING_HINTS_BUILDER_VERSION

  build(input: PlanningHintsBuilderInput): PlanningHints {
    return buildPlanningHints(input)
  }
}

export function createPlanningHintsBuilder(): PlanningHintsBuilder {
  return new PlanningHintsBuilder()
}
