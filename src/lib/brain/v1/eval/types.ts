/**
 * Sprint 88 Task 4 — Golden evaluation contracts.
 * Deterministic structural assertions over public Brain preview APIs.
 * No LLM judge · no live providers · no second planner.
 */

export const GOLDEN_EVAL_CONTRACT_VERSION = 'sprint88-golden-eval-1' as const

export type GoldenScenarioId = 'G01' | 'G02' | 'G03' | 'G04' | 'G05'

export type GoldenLocale = 'ar' | 'en'

/** One user utterance in the fixture conversation. */
export type GoldenUserTurn = {
  text: string
  /** Explore by default; booking only for deferred-field positive controls. */
  stage?: 'explore' | 'search' | 'booking' | 'payment'
}

export type GoldenBehavioralAssertion =
  | { kind: 'provided_value'; equals: boolean }
  | { kind: 'question_count_max'; max: number }
  | { kind: 'question_count_equals'; equals: number }
  | { kind: 'reply_not_question_only' }
  | { kind: 'reply_ends_with_question'; equals: boolean }
  | { kind: 'reply_matches'; pattern: string; flags?: string }
  | { kind: 'question_slot_not_in'; slots: string[] }
  | { kind: 'question_slot_is'; slot: string | null }
  | { kind: 'router_path'; path: 'brain' | 'fallback' | 'current' }
  | { kind: 'tool_batch_null' }
  | { kind: 'plan_id_preserved' }
  | { kind: 'revised_slots_include'; slots: string[] }
  | { kind: 'revised_slots_exclude'; slots: string[] }
  | { kind: 'known_slot_equals'; slot: string; value: string | number }
  | { kind: 'known_slot_preserved'; slot: string; value: string | number }
  | { kind: 'provenance_changed'; fields: string[] }
  | { kind: 'provenance_preserved'; fields: string[] }
  | { kind: 'fallback_reason_present' }
  | { kind: 'provider_gateway_not_called' }

export type GoldenForbiddenBehavior =
  | 'question_only_reply'
  | 'exceed_one_question'
  | 'ask_passport_in_explore'
  | 'ask_payment_in_explore'
  | 'ask_traveler_identity_in_explore'
  | 'invoke_search'
  | 'invoke_provider_gateway'
  | 'discard_prior_context'
  | 'silent_empty_failure'
  | 'enable_ai_tie_v1'

export type GoldenScenario = {
  id: GoldenScenarioId
  title: string
  locale: GoldenLocale
  turns: GoldenUserTurn[]
  /** Force BrainRouter fallback (G05). */
  injectBrainFailure?: boolean
  expected: GoldenBehavioralAssertion[]
  forbidden: GoldenForbiddenBehavior[]
  metadata?: Record<string, unknown>
}

export type GoldenEvaluationResult = {
  scenarioId: GoldenScenarioId
  title: string
  passed: boolean
  failures: string[]
  /** Sanitized observation bag for debugging (no secrets). */
  observations: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export type GoldenSuiteResult = {
  version: typeof GOLDEN_EVAL_CONTRACT_VERSION
  passed: boolean
  results: GoldenEvaluationResult[]
  failureCount: number
}
