/**
 * Sprint 87 — Rahhal AI Constitution behavioral types.
 * Governance only — does not alter engine public APIs.
 */

export const SPRINT87_AI_CONSTITUTION_VERSION = '1.0.0-ai-constitution'

/** Canonical principle identifiers. */
export type PrincipleId =
  | 'never_end_with_no_results'
  | 'mission_before_destination'
  | 'explain_every_recommendation'
  | 'offer_alternatives'
  | 'never_make_user_feel_wrong'
  | 'recover_conversation'
  | 'respect_user_intent'

export type PrincipleSeverity = 'mandatory' | 'advisory'

export interface PrincipleDefinition {
  id: PrincipleId
  number: 1 | 2 | 3 | 4 | 5 | 6 | 7
  title: string
  summary: string
  severity: PrincipleSeverity
  /** Policy modules that enforce / express this principle. */
  policies: ConstitutionPolicyId[]
}

export type ConstitutionPolicyId =
  | 'conversation'
  | 'recommendation'
  | 'decision'
  | 'recovery'
  | 'explanation'
  | 'alternative'
  | 'mission'

/** Snapshot of AI turn behavior for governance validation (additive). */
export interface BehaviorSnapshot {
  /** Declared empty / failed search without recovery attempts. */
  endedWithNoResults?: boolean
  /** Recovery strategies attempted before failure. */
  recoveryAttempts?: RecoveryAttemptKind[]
  /** Mission / objective inferred for the traveler. */
  mission?: string | null
  /** Destination treated as fixed immovable constraint. */
  destinationLocked?: boolean
  /** Recommendation present. */
  hasRecommendation?: boolean
  /** Explanation fields. */
  explanation?: {
    why?: string | null
    benefits?: string[]
    tradeoffs?: string[]
    confidence?: number | null
  } | null
  /** Confidence of primary recommendation (0–1 or 0–100). */
  confidence?: number | null
  /** Ranked alternatives offered. */
  alternativeCount?: number
  /** Traveler-facing copy (for tone checks). */
  replyText?: string | null
  /** User rejected / changed mind. */
  userRejected?: boolean
  /** Conversation recovered without full restart. */
  recoveredWithoutRestart?: boolean
  /** Explicit user intent captured this turn. */
  userIntent?: string | null
  /** System overrode explicit user intent. */
  systemOverrodeUserIntent?: boolean
}

export type RecoveryAttemptKind =
  | 'nearby_airports'
  | 'flexible_dates'
  | 'different_durations'
  | 'hotel_alternatives'
  | 'airline_alternatives'
  | 'nearby_destinations'
  | 'package_optimization'
  | 'budget_redistribution'
  | 'explanation'
  | 'multiple_options'

export interface PrincipleViolation {
  principleId: PrincipleId
  code: string
  message: string
  severity: PrincipleSeverity
}

export interface PrincipleValidationResult {
  version: string
  ok: boolean
  violations: PrincipleViolation[]
  checkedPrinciples: PrincipleId[]
  durationMs: number
}

/** Default confidence threshold below which alternatives are required (0–1). */
export const ALTERNATIVE_CONFIDENCE_THRESHOLD = 0.65

/** Phrases that make the traveler feel wrong / blocked. */
export const FORBIDDEN_FAILURE_PHRASES = [
  /\bimpossible\b/i,
  /\bwrong\b/i,
  /\bcannot\b/i,
  /\bcan'?t\b/i,
  /\bunable\s+to\b/i,
  /\bnot\s+possible\b/i,
  /\bno\s+way\b/i,
] as const
