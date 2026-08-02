/**
 * Sprint 89 Phase 2 (T10) — planReasonTurn.
 *
 * Pure sequential orchestration over Phase 1 Understanding + T2–T9 modules.
 * Normative order: proposeAssumptions → planMissingInformation(post-assumption)
 * → ConfidenceGates → ClarificationBridge → ToolDecisionBridge → hints/adapter/contract.
 * Returns a sealed planning decision contract. No BrainRouter / CM / Search /
 * Gateway / LLM execution. Never mutates Phase 1 memory or knownSlots.
 */

import type { AgentMemory } from '../../../../agent/types'
import type {
  ConversationStateSnapshot,
  UnderstandingTurnResult,
} from '../../understanding/types'
import {
  proposeAssumptions,
  type AssumptionPolicyResult,
} from './AssumptionPolicy'
import {
  adaptPlanningHintsForBrainRouter,
  type BrainRouterPlanningResult,
} from './BrainRouterPlanningAdapter'
import {
  buildBrainRouterDecisionContract,
  type BrainRouterDecisionContract,
} from './BrainRouterDecisionContract'
import {
  planClarification,
  type ClarificationBridgeResult,
} from './ClarificationBridge'
import {
  evaluateConfidenceGates,
  type ConfidenceDecision,
  type ConfidenceLevel,
  type FieldConfidenceMap,
} from './ConfidenceGates'
import {
  planMissingInformation,
  type MissingInfoGoal,
  type MissingInformationResult,
} from './MissingInformationPlanner'
import {
  buildPlanningHints,
  type PlanningHints,
} from './PlanningHintsBuilder'
import {
  decideToolDecision,
  type ToolDecisionResult,
} from './ToolDecisionBridge'

export const PLAN_REASON_TURN_VERSION = 'sprint89-phase2-planning-1' as const

export type PlanReasonFailureCode =
  | 'PLAN_REASON_INTERNAL_ERROR'
  | 'PLAN_REASON_STEP_FAILED'
  | null

export type PlanReasonRecoveryReason =
  | 'recovery_safe_answer'
  | 'recovery_abort_compatible'
  | 'abort_short_circuit'
  | null

export type ValueBeforeQuestionMeta = {
  /** Represented in planning path — CM formats later; no copy here. */
  represented: true
  strategy: 'value_then_clarify' | 'advise_only' | 'abort' | 'none'
}

export type PlanReasonTurnInput = {
  /** Phase 1 understanding — sole source of truth for slots/provenance. */
  understanding: UnderstandingTurnResult
  /** Echoed unchanged; never mutated by planReasonTurn. */
  memory: AgentMemory
  /** Optional; knownSlots SoT remains understanding.state.knownSlots. */
  conversationState?: ConversationStateSnapshot | null
  locale?: 'ar' | 'en'
  /** Explicit abort; also derived from primaryIntent === 'abort'. */
  abort?: boolean
  priorClarificationAttempts?: ReadonlyArray<{ field: string; count: number }>
  goalHint?: MissingInfoGoal
  priorAssumedFields?: readonly string[]
  priorConfidenceDecision?: ConfidenceDecision | null
  /** Optional fixed timestamp for determinism (ISO). */
  updatedAt?: string
  /**
   * Test-only hook to exercise failure recovery.
   * Must never be set in production callers.
   */
  __testForceFailure?: boolean
}

export type PlanReasonTurnResult = {
  readonly contractVersion: typeof PLAN_REASON_TURN_VERSION
  readonly sealed: true
  readonly decisionContract: BrainRouterDecisionContract
  readonly planningHints: PlanningHints
  readonly planningResult: BrainRouterPlanningResult
  readonly missing: MissingInformationResult
  readonly assumptions: AssumptionPolicyResult
  readonly confidence: ConfidenceDecision
  readonly clarification: ClarificationBridgeResult
  readonly toolDecision: ToolDecisionResult
  readonly valueBeforeQuestion: ValueBeforeQuestionMeta
  /** Phase 1 knownSlots echo — preserved, never cleared. */
  readonly preservedKnownSlots: UnderstandingTurnResult['state']['knownSlots']
  /** Phase 1 provenance echo — preserved, never cleared. */
  readonly preservedProvenance: UnderstandingTurnResult['provenance']
  readonly preservedSupersededFields: readonly string[]
  /** Memory identity echo — planReasonTurn never writes AgentMemory. */
  readonly memoryUnchanged: true
  readonly recovery: {
    readonly used: boolean
    readonly failureCode: PlanReasonFailureCode
    /** Machine-readable user-safe reason — not stack / CoT. */
    readonly reason: PlanReasonRecoveryReason
  }
  readonly capabilities: {
    readonly executeSearch: false
    readonly invokeGateway: false
    readonly invokeBrainRouter: false
    readonly invokeConversationManager: false
    readonly invokeLlm: false
  }
  readonly summary: {
    readonly toolDecision: ToolDecisionResult['toolDecision']
    readonly searchEligible: boolean
    readonly shouldAsk: boolean
    readonly abort: boolean
    readonly goal: MissingInfoGoal
    readonly locale: 'ar' | 'en'
    readonly recovered: boolean
  }
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

function isAbort(input: PlanReasonTurnInput): boolean {
  return (
    input.abort === true
    || input.understanding.intent.primaryIntent === 'abort'
  )
}

function localeOf(input: PlanReasonTurnInput): 'ar' | 'en' {
  return input.locale ?? input.understanding.state.locale
}

function collectAmbiguous(understanding: UnderstandingTurnResult): string[] {
  return understanding.references.ambiguous.map((r) => r.field)
}

function collectConflicting(understanding: UnderstandingTurnResult): string[] {
  return understanding.entities.facts
    .filter((f) => f.confidence.level === 'conflicting')
    .map((f) => f.field)
}

function collectCorrected(understanding: UnderstandingTurnResult): string[] {
  const fields = new Set<string>()
  for (const f of understanding.state.supersededFields) fields.add(f)
  for (const f of understanding.entities.revisedFields) {
    if (f === 'travelDates.start' || f === 'travelDates.end' || f.startsWith('travelDates')) {
      fields.add('dates')
    } else {
      fields.add(f)
    }
  }
  if (understanding.intent.isCorrection) {
    for (const fact of understanding.entities.facts) {
      if (fact.kind === 'corrected') {
        if (fact.field.startsWith('travelDates')) fields.add('dates')
        else fields.add(fact.field)
      }
    }
  }
  return [...fields]
}

function collectAssumedFields(
  understanding: UnderstandingTurnResult,
  prior: readonly string[] | undefined,
): string[] {
  const set = new Set<string>(prior ?? [])
  for (const [field, fact] of Object.entries(understanding.provenance)) {
    if (fact?.source === 'assumed') set.add(field)
  }
  for (const fact of understanding.entities.facts) {
    if (fact.kind === 'assumption' || fact.confidence.level === 'assumption') {
      set.add(fact.field)
    }
  }
  return [...set]
}

function fieldConfidenceFromUnderstanding(
  understanding: UnderstandingTurnResult,
): FieldConfidenceMap {
  const map: Record<string, { level: ConfidenceLevel; score: number | null }> = {}
  for (const fact of understanding.entities.facts) {
    const level = fact.confidence.level as ConfidenceLevel
    const key =
      fact.field.startsWith('travelDates') || fact.field === 'startDate' || fact.field === 'endDate'
        ? 'dates'
        : fact.field
    map[key] = { level, score: fact.confidence.score }
  }
  return map
}

function valueBeforeStrategy(input: {
  abort: boolean
  shouldAsk: boolean
  toolDecision: ToolDecisionResult['toolDecision']
}): ValueBeforeQuestionMeta {
  if (input.abort || input.toolDecision === 'ABORT') {
    return { represented: true, strategy: 'abort' }
  }
  if (input.shouldAsk || input.toolDecision === 'CLARIFY') {
    return { represented: true, strategy: 'value_then_clarify' }
  }
  if (input.toolDecision === 'ANSWER' || input.toolDecision === 'HANDOFF') {
    return { represented: true, strategy: 'advise_only' }
  }
  if (input.toolDecision === 'SEARCH_HANDOFF') {
    return { represented: true, strategy: 'advise_only' }
  }
  return { represented: true, strategy: 'none' }
}

function buildAbortResult(input: PlanReasonTurnInput): PlanReasonTurnResult {
  const locale = localeOf(input)
  const understanding = input.understanding
  const knownSlots = understanding.state.knownSlots

  // Abort: no new assumptions (policy short-circuits). Order matches runPipeline:
  // propose assumptions first, then classify missing from that post-assumption set.
  const assumptions = proposeAssumptions({
    understanding,
    priorAssumedFields: [],
    abort: true,
    locale,
    planId: understanding.state.activeTripId,
    updatedAt: input.updatedAt ?? new Date(0).toISOString(),
  })

  const missing = planMissingInformation({
    understanding,
    goalHint: input.goalHint,
    assumedFields: assumptions.assumedFields,
    abort: true,
  })

  const confidence = evaluateConfidenceGates({
    knownSlots,
    confirmedFields: missing.confirmedFields,
    assumedFields: [],
    missing: {
      blocking: missing.blocking,
      deferrable: missing.deferrable,
      bookingOnly: missing.bookingOnly,
      goal: 'abort',
      abort: true,
      sufficientForSearch: false,
    },
    abort: true,
    priorDecision: input.priorConfidenceDecision ?? null,
    locale,
  })

  const clarification = planClarification({
    missing: {
      blocking: missing.blocking,
      deferrable: missing.deferrable,
      bookingOnly: missing.bookingOnly,
      confirmedFields: missing.confirmedFields,
      abort: true,
      goal: 'abort',
    },
    confidence,
    assumptions: {
      assumedFields: assumptions.assumedFields,
      abort: true,
      proposed: assumptions.proposed,
    },
    knownSlots,
    abort: true,
    locale,
  })

  const toolDecision = decideToolDecision({
    missing: {
      blocking: missing.blocking,
      deferrable: missing.deferrable,
      bookingOnly: missing.bookingOnly,
      confirmedFields: missing.confirmedFields,
      abort: true,
      goal: 'abort',
      sufficientForAdvise: missing.sufficientForAdvise,
      sufficientForSearch: false,
    },
    assumptions: { assumedFields: assumptions.assumedFields, abort: true },
    confidence,
    clarification: {
      shouldAsk: clarification.shouldAsk,
      questionCandidate: clarification.questionCandidate,
      mergedFields: clarification.mergedFields,
      planningHints: clarification.planningHints,
    },
    abort: true,
    locale,
  })

  const planningHints = buildPlanningHints({
    missing: {
      blocking: missing.blocking,
      deferrable: missing.deferrable,
      bookingOnly: missing.bookingOnly,
      confirmedFields: missing.confirmedFields,
      abort: true,
      goal: 'abort',
      sufficientForAdvise: missing.sufficientForAdvise,
      sufficientForSearch: false,
    },
    assumptions: {
      assumedFields: assumptions.assumedFields,
      abort: true,
      proposed: assumptions.proposed,
      committable: assumptions.committable,
    },
    confidence,
    clarification: {
      shouldAsk: clarification.shouldAsk,
      questionCandidate: clarification.questionCandidate,
      mergedFields: clarification.mergedFields,
      avoidReasons: clarification.avoidReasons,
      planningHints: clarification.planningHints,
    },
    toolDecision,
    locale,
  })

  const planningResult = adaptPlanningHintsForBrainRouter({ planningHints })
  const decisionContract = buildBrainRouterDecisionContract({ planningResult })

  return sealResult({
    decisionContract,
    planningHints,
    planningResult,
    missing,
    assumptions,
    confidence,
    clarification,
    toolDecision,
    valueBeforeQuestion: { represented: true, strategy: 'abort' },
    understanding,
    recovery: {
      used: false,
      failureCode: null,
      reason: 'abort_short_circuit',
    },
    locale,
  })
}

function buildRecoveryResult(
  input: PlanReasonTurnInput,
  failureCode: PlanReasonFailureCode,
): PlanReasonTurnResult {
  const locale = localeOf(input)
  const understanding = input.understanding
  const abort = isAbort(input)
  const knownSlots = understanding.state.knownSlots

  // Recovery never invents new assumptions (abort-style propose).
  // Classify missing only after that empty proposal set (same ordering as runPipeline).
  const assumptions = proposeAssumptions({
    understanding,
    priorAssumedFields: [],
    abort: true,
    locale,
    planId: understanding.state.activeTripId,
    updatedAt: input.updatedAt ?? new Date(0).toISOString(),
  })

  // Safe path: preserve Phase 1 slots/provenance; no new assumptions in missing SoT.
  const missing = planMissingInformation({
    understanding,
    goalHint: input.goalHint ?? 'advise',
    assumedFields: assumptions.assumedFields,
    abort,
  })

  const confidence = evaluateConfidenceGates({
    knownSlots,
    confirmedFields: missing.confirmedFields,
    assumedFields: [],
    missing: {
      blocking: [],
      deferrable: missing.deferrable,
      bookingOnly: missing.bookingOnly,
      goal: abort ? 'abort' : 'advise',
      abort,
      sufficientForSearch: false,
    },
    abort,
    priorDecision: input.priorConfidenceDecision ?? null,
    locale,
  })

  const clarification = planClarification({
    missing: {
      blocking: [],
      deferrable: missing.deferrable,
      bookingOnly: missing.bookingOnly,
      confirmedFields: missing.confirmedFields,
      abort,
      goal: abort ? 'abort' : 'advise',
    },
    confidence,
    assumptions: { assumedFields: [], abort, proposed: [] },
    knownSlots,
    abort,
    locale,
  })

  const toolDecision = decideToolDecision({
    missing: {
      blocking: [],
      deferrable: missing.deferrable,
      bookingOnly: missing.bookingOnly,
      confirmedFields: missing.confirmedFields,
      abort,
      goal: abort ? 'abort' : 'advise',
      sufficientForAdvise: true,
      sufficientForSearch: false,
    },
    assumptions: { assumedFields: [], abort },
    confidence,
    clarification: {
      shouldAsk: false,
      questionCandidate: null,
      mergedFields: [],
      planningHints: {
        ...clarification.planningHints,
        shouldAsk: false,
        questionKey: null,
        mergedFields: [],
        moveHint: abort ? 'abort' : 'none',
        questionBudgetUsed: 0,
      },
    },
    abort,
    locale,
  })

  // Force ANSWER (or ABORT) — never SEARCH_HANDOFF on recovery.
  const safeTool =
    abort || toolDecision.toolDecision === 'ABORT'
      ? toolDecision
      : {
          ...toolDecision,
          toolDecision: 'ANSWER' as const,
          searchEligible: false,
          reason: 'advise_without_search' as const,
          searchHandoff: {
            status: 'blocked_not_search_goal' as const,
            executeSearch: false as const,
            invokeGateway: false as const,
          },
        }

  const planningHints = buildPlanningHints({
    missing: {
      blocking: [],
      deferrable: missing.deferrable,
      bookingOnly: missing.bookingOnly,
      confirmedFields: missing.confirmedFields,
      abort,
      goal: abort ? 'abort' : 'advise',
      sufficientForAdvise: true,
      sufficientForSearch: false,
    },
    assumptions: {
      assumedFields: [],
      abort,
      proposed: [],
      committable: [],
    },
    confidence: {
      ...confidence,
      searchEligible: false,
      shouldClarify: false,
    },
    clarification: {
      shouldAsk: false,
      questionCandidate: null,
      mergedFields: [],
      avoidReasons: clarification.avoidReasons,
      planningHints: {
        ...clarification.planningHints,
        shouldAsk: false,
        questionKey: null,
        mergedFields: [],
        moveHint: abort ? 'abort' : 'none',
        questionBudgetUsed: 0,
        searchEligible: false,
      },
    },
    toolDecision: safeTool,
    locale,
  })

  const planningResult = adaptPlanningHintsForBrainRouter({ planningHints })
  const decisionContract = buildBrainRouterDecisionContract({ planningResult })

  return sealResult({
    decisionContract,
    planningHints,
    planningResult,
    missing: {
      ...missing,
      blocking: [],
      clarificationRequired: false,
      clarificationCandidate: null,
      sufficientForSearch: false,
    },
    assumptions,
    confidence: {
      ...confidence,
      searchEligible: false,
      shouldClarify: false,
    },
    clarification: {
      ...clarification,
      shouldAsk: false,
      questionCandidate: null,
      mergedFields: [],
    },
    toolDecision: safeTool,
    valueBeforeQuestion: {
      represented: true,
      strategy: abort ? 'abort' : 'advise_only',
    },
    understanding,
    recovery: {
      used: true,
      failureCode,
      reason: abort ? 'recovery_abort_compatible' : 'recovery_safe_answer',
    },
    locale,
  })
}

function sealResult(parts: {
  decisionContract: BrainRouterDecisionContract
  planningHints: PlanningHints
  planningResult: BrainRouterPlanningResult
  missing: MissingInformationResult
  assumptions: AssumptionPolicyResult
  confidence: ConfidenceDecision
  clarification: ClarificationBridgeResult
  toolDecision: ToolDecisionResult
  valueBeforeQuestion: ValueBeforeQuestionMeta
  understanding: UnderstandingTurnResult
  recovery: PlanReasonTurnResult['recovery']
  locale: 'ar' | 'en'
}): PlanReasonTurnResult {
  const result: PlanReasonTurnResult = {
    contractVersion: PLAN_REASON_TURN_VERSION,
    sealed: true,
    decisionContract: parts.decisionContract,
    planningHints: parts.planningHints,
    planningResult: parts.planningResult,
    missing: parts.missing,
    assumptions: parts.assumptions,
    confidence: parts.confidence,
    clarification: parts.clarification,
    toolDecision: parts.toolDecision,
    valueBeforeQuestion: parts.valueBeforeQuestion,
    preservedKnownSlots: { ...parts.understanding.state.knownSlots },
    preservedProvenance: { ...parts.understanding.provenance },
    preservedSupersededFields: [...parts.understanding.state.supersededFields],
    memoryUnchanged: true,
    recovery: parts.recovery,
    capabilities: {
      executeSearch: false,
      invokeGateway: false,
      invokeBrainRouter: false,
      invokeConversationManager: false,
      invokeLlm: false,
    },
    summary: {
      toolDecision: parts.toolDecision.toolDecision,
      searchEligible: parts.toolDecision.searchEligible,
      shouldAsk: parts.clarification.shouldAsk,
      abort: parts.missing.abort || parts.toolDecision.toolDecision === 'ABORT',
      goal: parts.missing.goal,
      locale: parts.locale,
      recovered: parts.recovery.used,
    },
  }
  return freezeDeep(result)
}

function runPipeline(input: PlanReasonTurnInput): PlanReasonTurnResult {
  const understanding = input.understanding
  const locale = localeOf(input)
  const knownSlots = understanding.state.knownSlots
  const abort = false
  const priorAssumed = collectAssumedFields(understanding, input.priorAssumedFields)
  const ambiguousFields = collectAmbiguous(understanding)
  const conflictingFields = collectConflicting(understanding)
  const correctedFields = collectCorrected(understanding)
  const fieldConfidence = fieldConfidenceFromUnderstanding(understanding)

  // 1. AssumptionPolicy first — reversible assumed only; never overwrite confirmed.
  //    Final missing classification MUST see these same-turn proposals.
  const assumptions = proposeAssumptions({
    understanding,
    priorAssumedFields: priorAssumed,
    abort,
    locale,
    planId: understanding.state.activeTripId,
    updatedAt: input.updatedAt ?? new Date(0).toISOString(),
  })

  const assumedFields = [
    ...new Set([...priorAssumed, ...assumptions.assumedFields]),
  ]

  // 2. MissingInformationPlanner — post-assumption classification (sole missing SoT
  //    for all downstream consumers). Never use a pre-assumption missing snapshot.
  const missing = planMissingInformation({
    understanding,
    goalHint: input.goalHint,
    assumedFields,
    abort,
  })

  // 3. ConfidenceGates — consumes post-assumption missing only
  const confidence = evaluateConfidenceGates({
    knownSlots,
    confirmedFields: missing.confirmedFields,
    assumedFields,
    missing: {
      blocking: missing.blocking,
      deferrable: missing.deferrable,
      bookingOnly: missing.bookingOnly,
      goal: missing.goal,
      abort: missing.abort,
      sufficientForSearch: missing.sufficientForSearch,
    },
    ambiguousFields,
    conflictingFields,
    correctedFields,
    fieldConfidence,
    abort,
    priorDecision: input.priorConfidenceDecision ?? null,
    locale,
  })

  // 4. ClarificationBridge — ≤1 candidate; no booking-only / confirmed asks
  const clarification = planClarification({
    missing: {
      blocking: missing.blocking,
      deferrable: missing.deferrable,
      bookingOnly: missing.bookingOnly,
      confirmedFields: missing.confirmedFields,
      abort: missing.abort,
      goal: missing.goal,
    },
    confidence,
    assumptions: {
      assumedFields: assumptions.assumedFields,
      abort: assumptions.abort,
      proposed: assumptions.proposed,
    },
    knownSlots,
    ambiguousFields,
    conflictingFields,
    correctedFields,
    confirmedFields: missing.confirmedFields,
    priorClarificationAttempts: input.priorClarificationAttempts,
    abort,
    locale,
  })

  // 5. ToolDecisionBridge
  const toolDecision = decideToolDecision({
    missing: {
      blocking: missing.blocking,
      deferrable: missing.deferrable,
      bookingOnly: missing.bookingOnly,
      confirmedFields: missing.confirmedFields,
      abort: missing.abort,
      goal: missing.goal,
      sufficientForAdvise: missing.sufficientForAdvise,
      sufficientForSearch: missing.sufficientForSearch,
    },
    assumptions: {
      assumedFields: assumptions.assumedFields,
      abort: assumptions.abort,
    },
    confidence,
    clarification: {
      shouldAsk: clarification.shouldAsk,
      questionCandidate: clarification.questionCandidate,
      mergedFields: clarification.mergedFields,
      planningHints: clarification.planningHints,
    },
    abort,
    locale,
  })

  // 6. PlanningHintsBuilder
  const planningHints = buildPlanningHints({
    missing: {
      blocking: missing.blocking,
      deferrable: missing.deferrable,
      bookingOnly: missing.bookingOnly,
      confirmedFields: missing.confirmedFields,
      abort: missing.abort,
      goal: missing.goal,
      sufficientForAdvise: missing.sufficientForAdvise,
      sufficientForSearch: missing.sufficientForSearch,
    },
    assumptions: {
      assumedFields: assumptions.assumedFields,
      abort: assumptions.abort,
      proposed: assumptions.proposed,
      committable: assumptions.committable,
    },
    confidence,
    clarification: {
      shouldAsk: clarification.shouldAsk,
      questionCandidate: clarification.questionCandidate,
      mergedFields: clarification.mergedFields,
      avoidReasons: clarification.avoidReasons,
      planningHints: clarification.planningHints,
    },
    toolDecision,
    locale,
  })

  // 7. BrainRouterPlanningAdapter
  const planningResult = adaptPlanningHintsForBrainRouter({ planningHints })

  // 8. BrainRouterDecisionContract
  const decisionContract = buildBrainRouterDecisionContract({ planningResult })

  return sealResult({
    decisionContract,
    planningHints,
    planningResult,
    missing,
    assumptions,
    confidence,
    clarification,
    toolDecision,
    valueBeforeQuestion: valueBeforeStrategy({
      abort,
      shouldAsk: clarification.shouldAsk,
      toolDecision: toolDecision.toolDecision,
    }),
    understanding,
    recovery: {
      used: false,
      failureCode: null,
      reason: null,
    },
    locale,
  })
}

/**
 * Pure Phase 2 orchestration. Deterministic for identical inputs
 * (fixed updatedAt recommended). Never executes tools or mutates memory.
 */
export function planReasonTurn(input: PlanReasonTurnInput): PlanReasonTurnResult {
  // Abort short-circuit — before assumptions / clarification / search handoff.
  if (isAbort(input)) {
    return buildAbortResult(input)
  }

  try {
    if (input.__testForceFailure) {
      throw new Error('PLAN_REASON_STEP_FAILED')
    }
    return runPipeline(input)
  } catch {
    return buildRecoveryResult(input, 'PLAN_REASON_INTERNAL_ERROR')
  }
}

/** Test / eval helper: assert mandatory T10 capability invariants. */
export function assertPlanReasonTurnInvariants(result: PlanReasonTurnResult): boolean {
  if (!result.sealed) return false
  if (!Object.isFrozen(result)) return false
  const caps = result.capabilities
  if (
    caps.executeSearch
    || caps.invokeGateway
    || caps.invokeBrainRouter
    || caps.invokeConversationManager
    || caps.invokeLlm
  ) {
    return false
  }
  if (!result.decisionContract.sealed) return false
  if (result.decisionContract.capabilities.executeSearch) return false
  if (result.toolDecision.executeSearch) return false
  if (result.toolDecision.invokeGateway) return false
  if (result.planningHints.executeSearch) return false
  if (result.memoryUnchanged !== true) return false
  if (
    result.summary.searchEligible
    !== (result.summary.toolDecision === 'SEARCH_HANDOFF')
  ) {
    return false
  }
  return true
}

export class PlanReasonTurnOrchestrator {
  readonly version = PLAN_REASON_TURN_VERSION

  run(input: PlanReasonTurnInput): PlanReasonTurnResult {
    return planReasonTurn(input)
  }
}

export function createPlanReasonTurnOrchestrator(): PlanReasonTurnOrchestrator {
  return new PlanReasonTurnOrchestrator()
}
