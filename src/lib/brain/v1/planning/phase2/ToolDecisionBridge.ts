/**
 * Sprint 89 Phase 2 (T6) — ToolDecisionBridge.
 *
 * Pure deterministic ToolDecision from T2–T5 planning outputs.
 * Decision metadata only — never executes Search, Gateway, BrainRouter, or CM.
 * Never emits user-facing text.
 */

import type { AssumptionPolicyResult } from './AssumptionPolicy'
import type { ClarificationBridgeResult } from './ClarificationBridge'
import type { ConfidenceDecision } from './ConfidenceGates'
import type { MissingInformationResult } from './MissingInformationPlanner'
import { BOOKING_ONLY_FIELDS } from './MissingInformationPlanner'

export const TOOL_DECISION_BRIDGE_VERSION = 'tool-decision-engine@1.x' as const

/**
 * Approved five-way ToolDecision enum (T6 authorization).
 * SEARCH_HANDOFF is search eligibility metadata only — never execute.
 */
export type ToolDecision =
  | 'ANSWER'
  | 'CLARIFY'
  | 'SEARCH_HANDOFF'
  | 'ABORT'
  | 'HANDOFF'

export type ToolDecisionReasonCode =
  | 'abort_path'
  | 'clarification_required'
  | 'search_eligible_meta_only'
  | 'non_search_planning_handoff'
  | 'advise_without_search'
  | 'blocking_prevents_search_handoff'
  | 'booking_only_ignored'

export type SearchHandoffMeta = {
  /** Decision-only — never triggers providers/gateway. */
  status:
    | 'eligible'
    | 'blocked_insufficient_information'
    | 'blocked_clarification_pending'
    | 'blocked_not_search_goal'
    | 'abort_locked'
  executeSearch: false
  invokeGateway: false
}

export type ToolDecisionBridgeInput = {
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
  assumptions: Pick<AssumptionPolicyResult, 'assumedFields' | 'abort'>
  confidence: ConfidenceDecision
  clarification: Pick<
    ClarificationBridgeResult,
    'shouldAsk' | 'questionCandidate' | 'mergedFields' | 'planningHints'
  >
  /** Optional explicit abort override. */
  abort?: boolean
  locale?: 'ar' | 'en'
}

/**
 * Machine-readable ToolDecision result only.
 * No reply text, no toolBatch, no provider calls.
 */
export type ToolDecisionResult = {
  contractVersion: typeof TOOL_DECISION_BRIDGE_VERSION
  toolDecision: ToolDecision
  /** True iff toolDecision === 'SEARCH_HANDOFF'. */
  searchEligible: boolean
  /** Always false in Phase 2. */
  executeSearch: false
  /** Always false in Phase 2. */
  invokeGateway: false
  reason: ToolDecisionReasonCode
  searchHandoff: SearchHandoffMeta
  /** Echoes used for eval — not user-facing. */
  diagnostics: {
    blocking: string[]
    shouldAsk: boolean
    confidenceShouldClarify: boolean
    assumedFields: string[]
    confirmedFields: string[]
    goal: MissingInformationResult['goal']
    locale: 'ar' | 'en'
  }
}

const BOOKING_ONLY_SET = new Set<string>(BOOKING_ONLY_FIELDS)

function withoutBooking(fields: readonly string[]): string[] {
  return fields.filter((f) => !BOOKING_ONLY_SET.has(f))
}

function isSearchShaped(goal: MissingInformationResult['goal']): boolean {
  return (
    goal === 'search'
    || goal === 'domain_flight'
    || goal === 'domain_hotel'
    || goal === 'domain_car'
    || goal === 'domain_activity'
  )
}

function isNonSearchHandoffGoal(goal: MissingInformationResult['goal']): boolean {
  return goal === 'compare' || goal === 'visa_guidance'
}

/**
 * Pure ToolDecision evaluation.
 *
 * Priority (first match wins):
 * 1. ABORT
 * 2. CLARIFY (shouldAsk / clarify pressure; never SEARCH_HANDOFF while asking)
 * 3. SEARCH_HANDOFF (searchEligible meta only; blocking must be empty)
 * 4. HANDOFF (non-search planning handoff — compare / visa guidance)
 * 5. ANSWER (advise without search)
 */
export function decideToolDecision(
  input: ToolDecisionBridgeInput,
): ToolDecisionResult {
  const locale = input.locale ?? 'en'
  const abort =
    input.abort === true
    || input.missing.abort === true
    || input.assumptions.abort === true
    || input.clarification.planningHints.moveHint === 'abort'

  const blocking = withoutBooking(input.missing.blocking)
  const shouldAsk = input.clarification.shouldAsk === true
  const confirmedFields = withoutBooking(input.missing.confirmedFields)
  const assumedFields = [...input.assumptions.assumedFields]
  const goal = input.missing.goal

  const diagnostics: ToolDecisionResult['diagnostics'] = {
    blocking,
    shouldAsk,
    confidenceShouldClarify: input.confidence.shouldClarify,
    assumedFields,
    confirmedFields,
    goal,
    locale,
  }

  const base = {
    contractVersion: TOOL_DECISION_BRIDGE_VERSION,
    executeSearch: false as const,
    invokeGateway: false as const,
    diagnostics,
  }

  // 1. Abort — never search, never clarify packaging here.
  if (abort) {
    return {
      ...base,
      toolDecision: 'ABORT',
      searchEligible: false,
      reason: 'abort_path',
      searchHandoff: {
        status: 'abort_locked',
        executeSearch: false,
        invokeGateway: false,
      },
    }
  }

  // 2. Clarification required — never SEARCH_HANDOFF while blocking/asking.
  if (shouldAsk || (input.confidence.shouldClarify && input.clarification.questionCandidate != null)) {
    return {
      ...base,
      toolDecision: 'CLARIFY',
      searchEligible: false,
      reason: 'clarification_required',
      searchHandoff: {
        status: 'blocked_clarification_pending',
        executeSearch: false,
        invokeGateway: false,
      },
    }
  }

  // Hard rule: residual blocking ⇒ never SEARCH_HANDOFF.
  if (blocking.length > 0) {
    return {
      ...base,
      toolDecision: 'ANSWER',
      searchEligible: false,
      reason: 'blocking_prevents_search_handoff',
      searchHandoff: {
        status: 'blocked_insufficient_information',
        executeSearch: false,
        invokeGateway: false,
      },
    }
  }

  // 3. Search eligibility → SEARCH_HANDOFF metadata only.
  if (input.confidence.searchEligible === true && isSearchShaped(goal)) {
    return {
      ...base,
      toolDecision: 'SEARCH_HANDOFF',
      searchEligible: true,
      reason: 'search_eligible_meta_only',
      searchHandoff: {
        status: 'eligible',
        executeSearch: false,
        invokeGateway: false,
      },
    }
  }

  // Invariant: searchEligible flag must match SEARCH_HANDOFF only.
  // If confidence claims eligible but goal is not search-shaped, do not emit SEARCH_HANDOFF.

  // 4. Non-search planning handoff (compare / visa) when no ask and enough to proceed.
  if (
    isNonSearchHandoffGoal(goal)
    && !shouldAsk
    && (input.missing.sufficientForAdvise || confirmedFields.length > 0)
  ) {
    return {
      ...base,
      toolDecision: 'HANDOFF',
      searchEligible: false,
      reason: 'non_search_planning_handoff',
      searchHandoff: {
        status: 'blocked_not_search_goal',
        executeSearch: false,
        invokeGateway: false,
      },
    }
  }

  // 5. Default — advise / answer without search.
  return {
    ...base,
    toolDecision: 'ANSWER',
    searchEligible: false,
    reason: 'advise_without_search',
    searchHandoff: {
      status: isSearchShaped(goal)
        ? 'blocked_insufficient_information'
        : 'blocked_not_search_goal',
      executeSearch: false,
      invokeGateway: false,
    },
  }
}

/** Property: searchEligible iff toolDecision === SEARCH_HANDOFF. */
export function assertSearchEligibleInvariant(result: ToolDecisionResult): boolean {
  return result.searchEligible === (result.toolDecision === 'SEARCH_HANDOFF')
}

export class ToolDecisionBridge {
  readonly version = TOOL_DECISION_BRIDGE_VERSION

  decide(input: ToolDecisionBridgeInput): ToolDecisionResult {
    return decideToolDecision(input)
  }
}

export function createToolDecisionBridge(): ToolDecisionBridge {
  return new ToolDecisionBridge()
}
