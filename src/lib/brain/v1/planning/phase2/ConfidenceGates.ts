/**
 * Sprint 89 Phase 2 (T4) — ConfidenceGates.
 *
 * Pure, deterministic gates. No I/O, no memory writes, no Search / gateway,
 * no BrainRouter / ConversationManager orchestration.
 */

import type { ConversationKnownSlots } from '../../understanding/types'
import type { MissingInfoGoal, MissingInformationResult } from './MissingInformationPlanner'
import { BOOKING_ONLY_FIELDS } from './MissingInformationPlanner'

export const CONFIDENCE_GATES_VERSION = 'confidence-gates@1.x' as const

/** AI Contracts confidence levels — level wins over numeric score. */
export type ConfidenceLevel =
  | 'confirmed'
  | 'high_confidence_inferred'
  | 'medium_confidence_inferred'
  | 'assumption'
  | 'unknown'
  | 'conflicting'
  | 'stale'

export type ConfidenceBlockingReason =
  | 'abort_preserves_state'
  | 'blocking_fields_missing'
  | 'ambiguous_values'
  | 'conflicting_values'
  | 'medium_confidence_dates'
  | 'assumption_insufficient_for_search'
  | 'low_or_unknown_required'
  | 'stale_after_correction'
  | null

/** Non-normative score bands (companions only; level wins). */
export const CONFIDENCE_SCORE_HIGH = 0.75
export const CONFIDENCE_SCORE_MEDIUM = 0.55

/**
 * Fields that may count toward searchEligible when
 * `high_confidence_inferred` (never when merely assumed / medium).
 */
export const SEARCH_INFERENCE_ALLOWLIST = [
  'origin',
  'destination',
  'dates',
  'startDate',
  'endDate',
  'adults',
  'travelerCount',
] as const

const BOOKING_ONLY_SET = new Set<string>(BOOKING_ONLY_FIELDS)
const SEARCH_ALLOWLIST_SET = new Set<string>(SEARCH_INFERENCE_ALLOWLIST)

export type FieldConfidenceMap = Readonly<
  Record<string, ConfidenceLevel | { level: ConfidenceLevel; score?: number | null }>
>

export type ConfidenceGateInput = {
  knownSlots: ConversationKnownSlots
  confirmedFields: readonly string[]
  assumedFields: readonly string[]
  /** MissingInformationPlanner output (bookingOnly ignored for gates). */
  missing: Pick<
    MissingInformationResult,
    'blocking' | 'deferrable' | 'bookingOnly' | 'goal' | 'abort' | 'sufficientForSearch'
  >
  ambiguousFields?: readonly string[]
  conflictingFields?: readonly string[]
  /**
   * Fields corrected this turn — prior confidence for those fields is invalid;
   * recompute from current confirmed/knownSlots only.
   */
  correctedFields?: readonly string[]
  /** Per-field confidence; defaults derived from confirmed/assumed sets. */
  fieldConfidence?: FieldConfidenceMap
  abort?: boolean
  /** Prior decision retained only on abort (confirmed state preserved). */
  priorDecision?: ConfidenceDecision | null
  locale?: 'ar' | 'en'
}

/**
 * Normative outputs only (plus contract version).
 * No reply text, no tool batches, no side effects.
 */
export type ConfidenceDecision = {
  contractVersion: typeof CONFIDENCE_GATES_VERSION
  confidenceLevel: ConfidenceLevel
  searchEligible: boolean
  shouldClarify: boolean
  blockingReason: ConfidenceBlockingReason
}

function levelOf(
  entry: ConfidenceLevel | { level: ConfidenceLevel; score?: number | null } | undefined,
): ConfidenceLevel | undefined {
  if (entry == null) return undefined
  return typeof entry === 'string' ? entry : entry.level
}

function withoutBookingOnly(fields: readonly string[] | undefined): string[] {
  return (fields ?? []).filter((f) => !BOOKING_ONLY_SET.has(f))
}

function isSearchShaped(goal: MissingInfoGoal): boolean {
  return (
    goal === 'search'
    || goal === 'domain_flight'
    || goal === 'domain_hotel'
    || goal === 'domain_car'
    || goal === 'domain_activity'
  )
}

function isPresent(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

function hasUsableDates(slots: ConversationKnownSlots): boolean {
  return isPresent(slots.startDate) || isPresent(slots.endDate)
}

function datesConfidence(
  input: ConfidenceGateInput,
  confirmed: Set<string>,
  assumed: Set<string>,
): ConfidenceLevel {
  const corrected = new Set(withoutBookingOnly(input.correctedFields))
  if (corrected.has('dates') || corrected.has('startDate') || corrected.has('endDate')) {
    // Corrections invalidate prior medium/stale — post-correction slots win.
    if (hasUsableDates(input.knownSlots)) return 'confirmed'
    return 'unknown'
  }

  const explicit =
    levelOf(input.fieldConfidence?.dates)
    ?? levelOf(input.fieldConfidence?.startDate)
    ?? levelOf(input.fieldConfidence?.endDate)
  if (explicit) return explicit

  if (confirmed.has('dates') || confirmed.has('startDate') || confirmed.has('endDate')) {
    return 'confirmed'
  }
  if (assumed.has('dates') || assumed.has('flexibleDates') || assumed.has('startDate')) {
    return 'assumption'
  }
  if (hasUsableDates(input.knownSlots)) return 'high_confidence_inferred'
  return 'unknown'
}

function fieldLevel(
  field: string,
  input: ConfidenceGateInput,
  confirmed: Set<string>,
  assumed: Set<string>,
): ConfidenceLevel {
  if (field === 'dates' || field === 'startDate' || field === 'endDate') {
    return datesConfidence(input, confirmed, assumed)
  }
  const corrected = new Set(withoutBookingOnly(input.correctedFields))
  if (corrected.has(field)) {
    return confirmed.has(field) || slotPresent(input.knownSlots, field)
      ? 'confirmed'
      : 'unknown'
  }
  const explicit = levelOf(input.fieldConfidence?.[field])
  if (explicit) return explicit
  if (confirmed.has(field)) return 'confirmed'
  if (assumed.has(field)) return 'assumption'
  if (slotPresent(input.knownSlots, field)) return 'high_confidence_inferred'
  return 'unknown'
}

function slotPresent(slots: ConversationKnownSlots, field: string): boolean {
  switch (field) {
    case 'destination':
      return isPresent(slots.destination)
    case 'origin':
      return isPresent(slots.origin)
    case 'startDate':
      return isPresent(slots.startDate)
    case 'endDate':
      return isPresent(slots.endDate)
    case 'dates':
      return hasUsableDates(slots)
    case 'adults':
    case 'travelerCount':
      return slots.adults != null || slots.travelerCount != null
    case 'children':
      return slots.children != null
    case 'budget':
      return slots.budget != null
    default:
      return false
  }
}

function countsTowardSearch(level: ConfidenceLevel, field: string): boolean {
  if (level === 'confirmed') return true
  if (level === 'high_confidence_inferred' && SEARCH_ALLOWLIST_SET.has(field)) return true
  return false
}

function worstLevel(levels: ConfidenceLevel[]): ConfidenceLevel {
  const rank: Record<ConfidenceLevel, number> = {
    conflicting: 0,
    stale: 1,
    unknown: 2,
    assumption: 3,
    medium_confidence_inferred: 4,
    high_confidence_inferred: 5,
    confirmed: 6,
  }
  let worst: ConfidenceLevel = 'confirmed'
  for (const level of levels) {
    if (rank[level] < rank[worst]) worst = level
  }
  return worst
}

/**
 * Pure confidence gate evaluation.
 * Booking-only fields are stripped and never influence outcomes.
 */
export function evaluateConfidenceGates(input: ConfidenceGateInput): ConfidenceDecision {
  const abort = input.abort === true || input.missing.abort === true

  if (abort) {
    const prior = input.priorDecision
    return {
      contractVersion: CONFIDENCE_GATES_VERSION,
      // Preserve prior confirmed/high state; never invent search eligibility on abort.
      confidenceLevel: prior?.confidenceLevel ?? 'confirmed',
      searchEligible: false,
      shouldClarify: false,
      blockingReason: 'abort_preserves_state',
    }
  }

  const confirmed = new Set(withoutBookingOnly(input.confirmedFields))
  const assumed = new Set(withoutBookingOnly(input.assumedFields))
  const blocking = withoutBookingOnly(input.missing.blocking)
  const ambiguous = withoutBookingOnly(input.ambiguousFields)
  const conflicting = withoutBookingOnly(input.conflictingFields)
  const corrected = withoutBookingOnly(input.correctedFields)

  // Corrections invalidate stale prior decisions — ignore priorDecision except abort.
  void corrected

  if (conflicting.length > 0) {
    return {
      contractVersion: CONFIDENCE_GATES_VERSION,
      confidenceLevel: 'conflicting',
      searchEligible: false,
      shouldClarify: true,
      blockingReason: 'conflicting_values',
    }
  }

  if (ambiguous.length > 0) {
    return {
      contractVersion: CONFIDENCE_GATES_VERSION,
      confidenceLevel:
        levelOf(input.fieldConfidence?.[ambiguous[0]!])
        ?? 'medium_confidence_inferred',
      searchEligible: false,
      shouldClarify: true,
      blockingReason: 'ambiguous_values',
    }
  }

  const dateLevel = datesConfidence(input, confirmed, assumed)

  // Medium-confidence dates must NEVER automatically enable search.
  if (dateLevel === 'medium_confidence_inferred') {
    const overall = worstLevel([
      dateLevel,
      ...blocking.map((f) => fieldLevel(f, input, confirmed, assumed)),
      ...[...confirmed].map((f) => fieldLevel(f, input, confirmed, assumed)),
    ])
    return {
      contractVersion: CONFIDENCE_GATES_VERSION,
      confidenceLevel: overall === 'confirmed' ? 'medium_confidence_inferred' : overall,
      searchEligible: false,
      shouldClarify: isSearchShaped(input.missing.goal) || blocking.length > 0,
      blockingReason: 'medium_confidence_dates',
    }
  }

  if (blocking.length > 0) {
    const levels = blocking.map((f) => fieldLevel(f, input, confirmed, assumed))
    const overall = worstLevel(levels)
    const assumedBlocking = blocking.some((f) => fieldLevel(f, input, confirmed, assumed) === 'assumption')
    return {
      contractVersion: CONFIDENCE_GATES_VERSION,
      confidenceLevel: overall,
      searchEligible: false,
      shouldClarify: true,
      blockingReason: assumedBlocking
        ? 'assumption_insufficient_for_search'
        : overall === 'unknown' || overall === 'stale'
          ? 'low_or_unknown_required'
          : 'blocking_fields_missing',
    }
  }

  // No blocking gaps — evaluate search eligibility for search-shaped goals.
  const searchShaped = isSearchShaped(input.missing.goal)
  const requiredForGoal = requiredFieldsForGoal(input.missing.goal)
  const requiredLevels = requiredForGoal.map((f) => ({
    field: f,
    level: fieldLevel(f, input, confirmed, assumed),
  }))

  const overall = worstLevel(
    requiredLevels.map((r) => r.level).concat(
      [...confirmed].map((f) => fieldLevel(f, input, confirmed, assumed)),
      requiredForGoal.includes('dates') ? [dateLevel] : [],
    ),
  )

  // Dates assumption / unknown never authorize search when dates are required.
  if (
    searchShaped
    && requiredForGoal.includes('dates')
    && !countsTowardSearch(dateLevel, 'dates')
  ) {
    return {
      contractVersion: CONFIDENCE_GATES_VERSION,
      confidenceLevel: overall,
      searchEligible: false,
      shouldClarify: dateLevel === 'unknown' || dateLevel === 'stale',
      blockingReason:
        dateLevel === 'assumption'
          ? 'assumption_insufficient_for_search'
          : 'low_or_unknown_required',
    }
  }

  const allRequiredOk = requiredLevels.every(({ field, level }) =>
    countsTowardSearch(level, field),
  )

  const searchEligible = searchShaped && allRequiredOk

  return {
    contractVersion: CONFIDENCE_GATES_VERSION,
    confidenceLevel: overall,
    searchEligible,
    shouldClarify: false,
    blockingReason: null,
  }
}

function requiredFieldsForGoal(goal: MissingInfoGoal): string[] {
  switch (goal) {
    case 'search':
    case 'domain_flight':
      return ['origin', 'destination', 'dates']
    case 'domain_hotel':
      return ['destination', 'dates']
    case 'domain_car':
      return ['origin', 'dates']
    case 'domain_activity':
      return ['destination']
    default:
      return []
  }
}

/** Convenience: map a numeric score to a level (level still wins when both provided). */
export function scoreToConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE_SCORE_HIGH) return 'high_confidence_inferred'
  if (score >= CONFIDENCE_SCORE_MEDIUM) return 'medium_confidence_inferred'
  if (score > 0) return 'unknown'
  return 'unknown'
}

export class ConfidenceGates {
  readonly version = CONFIDENCE_GATES_VERSION

  evaluate(input: ConfidenceGateInput): ConfidenceDecision {
    return evaluateConfidenceGates(input)
  }
}

export function createConfidenceGates(): ConfidenceGates {
  return new ConfidenceGates()
}
