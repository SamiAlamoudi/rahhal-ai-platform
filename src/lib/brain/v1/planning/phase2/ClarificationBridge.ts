/**
 * Sprint 89 Phase 2 (T5) — ClarificationBridge.
 *
 * Pure planning: at most ONE clarification candidate.
 * Never generates user-facing wording, prompts, or locale copy.
 * No BrainRouter / ConversationManager wiring / Search / ProviderGateway.
 */

import type { ConversationKnownSlots } from '../../understanding/types'
import type { AssumptionPolicyResult } from './AssumptionPolicy'
import type { ConfidenceDecision } from './ConfidenceGates'
import {
  BOOKING_ONLY_FIELDS,
  type MissingInformationResult,
} from './MissingInformationPlanner'

export const CLARIFICATION_BRIDGE_VERSION = 'clarification-planner@1.x' as const

const BOOKING_ONLY_SET = new Set<string>(BOOKING_ONLY_FIELDS)

/** Machine-readable avoid reasons — never user-facing prose. */
export type ClarificationAvoidReasonCode =
  | 'already_known'
  | 'assumed_safe'
  | 'booking_deferred'
  | 'not_blocking'
  | 'abort_no_ask'
  | 'search_eligible_no_ask'
  | 'corrected_now_known'
  | 'strategy_shift_examples'
  | 'zero_question_path'

export type ClarificationAvoidReason = {
  field: string
  reason: ClarificationAvoidReasonCode
}

/**
 * Structured question candidate — field keys + reason codes only.
 * CM (later) may format copy; this module never emits ar/en strings.
 */
export type ClarificationQuestionCandidatePlan = {
  /** Primary field key for the single candidate. */
  field: string
  reason:
    | 'absent_from_known_slots'
    | 'ambiguous_reference'
    | 'conflicting_confidence'
    | 'medium_confidence_dates'
    | 'merged_blocking_gap'
  detail: string
}

/**
 * Machine-readable planning hints for a future CM injection path.
 * No reply text. No ToolDecision execution. Design-only contract surface.
 */
export type ClarificationPlanningHints = {
  shouldAsk: boolean
  /** Primary question field key — not localized copy. */
  questionKey: string | null
  mergedFields: string[]
  avoidReasons: ClarificationAvoidReason[]
  searchEligible: boolean
  confidenceLevel: ConfidenceDecision['confidenceLevel']
  confidenceShouldClarify: boolean
  assumedFields: string[]
  correctedFields: string[]
  moveHint: 'clarify' | 'none' | 'abort'
  questionBudgetUsed: 0 | 1
}

/**
 * Design-only CM injection contract (T5 gate).
 * Not wired into ConversationManager in this task.
 *
 * Future additive shape (T6+):
 *   runConversationManagerTurn(input, { enabled: true, planningHints })
 * When planningHints present, CM must skip internal clarify/tool selection.
 */
export type ClarificationCmInjectionDesign = {
  mode: 'planning_hints_injection'
  planningHints: ClarificationPlanningHints
  /** CM must not re-decide shouldAsk / mergedFields when hints present. */
  cmMustSkipSelection: true
  /** CM may format locale strings later — bridge never supplies them. */
  bridgeSuppliesCopy: false
}

export type ClarificationBridgeInput = {
  missing: Pick<
    MissingInformationResult,
    'blocking' | 'deferrable' | 'bookingOnly' | 'confirmedFields' | 'abort' | 'goal'
  >
  confidence: ConfidenceDecision
  assumptions: Pick<AssumptionPolicyResult, 'assumedFields' | 'abort' | 'proposed'>
  knownSlots: ConversationKnownSlots
  /** Explicit blocking field list (optional; merged with missing.blocking). */
  blockingFields?: readonly string[]
  ambiguousFields?: readonly string[]
  conflictingFields?: readonly string[]
  correctedFields?: readonly string[]
  /** Confirmed slot keys — never re-asked. Defaults from missing.confirmedFields + knownSlots. */
  confirmedFields?: readonly string[]
  /**
   * Prior clarification attempts per field. After 2 failures on same gap,
   * emit strategy_shift_examples avoid (no copy generated here).
   */
  priorClarificationAttempts?: ReadonlyArray<{ field: string; count: number }>
  abort?: boolean
  locale?: 'ar' | 'en'
}

export type ClarificationBridgeResult = {
  contractVersion: typeof CLARIFICATION_BRIDGE_VERSION
  shouldAsk: boolean
  questionCandidate: ClarificationQuestionCandidatePlan | null
  mergedFields: string[]
  avoidReasons: ClarificationAvoidReason[]
  planningHints: ClarificationPlanningHints
  /** Design artifact only — proves injection contract without CM wiring. */
  cmInjectionDesign: ClarificationCmInjectionDesign
}

/** Related fields merged into a single candidate whenever co-present. */
export const CLARIFICATION_MERGE_GROUPS: readonly (readonly string[])[] = [
  ['origin', 'destination', 'dates'],
  ['startDate', 'endDate', 'dates'],
  ['pickupLocation', 'dates'],
  ['adults', 'travelerCount', 'children'],
  ['destination', 'dates'],
]

/** Priority for choosing the primary field of the single candidate. */
const PRIMARY_PRIORITY = [
  'destination',
  'origin',
  'pickupLocation',
  'dates',
  'startDate',
  'endDate',
  'nationality',
  'adults',
  'travelerCount',
  'children',
  'budget',
] as const

function withoutBooking(fields: readonly string[] | undefined): string[] {
  return (fields ?? []).filter((f) => !BOOKING_ONLY_SET.has(f))
}

function unique(fields: readonly string[]): string[] {
  const out: string[] = []
  for (const f of fields) {
    if (!out.includes(f)) out.push(f)
  }
  return out
}

function normalizeField(field: string): string {
  if (field === 'travelDates.start' || field === 'startDate') return 'startDate'
  if (field === 'travelDates.end' || field === 'endDate') return 'endDate'
  if (field.startsWith('travelDates')) return 'dates'
  return field
}

function isSlotPresent(slots: ConversationKnownSlots, field: string): boolean {
  switch (field) {
    case 'destination':
      return Boolean(slots.destination && String(slots.destination).trim())
    case 'origin':
      return Boolean(slots.origin && String(slots.origin).trim())
    case 'startDate':
      return Boolean(slots.startDate && String(slots.startDate).trim())
    case 'endDate':
      return Boolean(slots.endDate && String(slots.endDate).trim())
    case 'dates':
      return isSlotPresent(slots, 'startDate') || isSlotPresent(slots, 'endDate')
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

function collectConfirmed(
  input: ClarificationBridgeInput,
): Set<string> {
  const set = new Set<string>()
  for (const f of withoutBooking(input.confirmedFields ?? input.missing.confirmedFields)) {
    set.add(normalizeField(f))
  }
  const slots = input.knownSlots
  if (isSlotPresent(slots, 'destination')) set.add('destination')
  if (isSlotPresent(slots, 'origin')) set.add('origin')
  if (isSlotPresent(slots, 'startDate')) set.add('startDate')
  if (isSlotPresent(slots, 'endDate')) set.add('endDate')
  if (isSlotPresent(slots, 'dates')) set.add('dates')
  if (slots.adults != null) set.add('adults')
  if (slots.children != null) set.add('children')
  if (slots.travelerCount != null) set.add('travelerCount')
  if (slots.budget != null) set.add('budget')
  // Corrections that landed in knownSlots are confirmed now.
  for (const f of withoutBooking(input.correctedFields)) {
    const key = normalizeField(f)
    if (isSlotPresent(slots, key) || (key === 'dates' && isSlotPresent(slots, 'dates'))) {
      set.add(key)
    }
  }
  return set
}

function collectAssumed(input: ClarificationBridgeInput): Set<string> {
  const set = new Set<string>()
  for (const f of input.assumptions.assumedFields) set.add(normalizeField(f))
  for (const p of input.assumptions.proposed) {
    if (p.source === 'assumed') set.add(normalizeField(p.field))
  }
  // flexibleDates assumption covers dates ask pressure.
  if (set.has('flexibleDates')) set.add('dates')
  return set
}

/**
 * Merge co-present askable fields into one ordered mergedFields list.
 * Always a single candidate — related groups collapse together.
 */
export function mergeClarificationFields(askable: readonly string[]): string[] {
  if (askable.length <= 1) return [...askable]

  const remaining = new Set(askable.map(normalizeField))
  const merged: string[] = []

  for (const group of CLARIFICATION_MERGE_GROUPS) {
    const hit = group.filter((f) => remaining.has(f))
    if (hit.length >= 2) {
      for (const f of hit) {
        if (!merged.includes(f)) merged.push(f)
        remaining.delete(f)
      }
    }
  }

  // Append any leftover askable fields (still one candidate).
  for (const f of askable.map(normalizeField)) {
    if (remaining.has(f) && !merged.includes(f)) {
      merged.push(f)
      remaining.delete(f)
    }
  }

  return merged
}

function pickPrimaryField(mergedFields: readonly string[]): string {
  for (const p of PRIMARY_PRIORITY) {
    if (mergedFields.includes(p)) return p
  }
  return mergedFields[0]!
}

function candidateReason(
  primary: string,
  input: ClarificationBridgeInput,
): ClarificationQuestionCandidatePlan['reason'] {
  const conflicting = new Set(withoutBooking(input.conflictingFields).map(normalizeField))
  const ambiguous = new Set(withoutBooking(input.ambiguousFields).map(normalizeField))
  if (conflicting.has(primary)) return 'conflicting_confidence'
  if (ambiguous.has(primary)) return 'ambiguous_reference'
  if (
    (primary === 'dates' || primary === 'startDate' || primary === 'endDate')
    && input.confidence.blockingReason === 'medium_confidence_dates'
  ) {
    return 'medium_confidence_dates'
  }
  return 'merged_blocking_gap'
}

/**
 * Pure clarification planning — max one candidate, no copywriting.
 */
export function planClarification(
  input: ClarificationBridgeInput,
): ClarificationBridgeResult {
  const abort =
    input.abort === true
    || input.missing.abort === true
    || input.assumptions.abort === true

  const avoidReasons: ClarificationAvoidReason[] = []
  const confirmed = collectConfirmed(input)
  const assumed = collectAssumed(input)

  const pushAvoid = (field: string, reason: ClarificationAvoidReasonCode) => {
    if (!avoidReasons.some((a) => a.field === field && a.reason === reason)) {
      avoidReasons.push({ field, reason })
    }
  }

  // Always record booking-only as deferred (never ask).
  for (const field of BOOKING_ONLY_FIELDS) {
    pushAvoid(field, 'booking_deferred')
  }
  for (const field of withoutBooking(input.missing.bookingOnly)) {
    pushAvoid(field, 'booking_deferred')
  }

  if (abort) {
    pushAvoid('*', 'abort_no_ask')
    const planningHints: ClarificationPlanningHints = {
      shouldAsk: false,
      questionKey: null,
      mergedFields: [],
      avoidReasons,
      searchEligible: false,
      confidenceLevel: input.confidence.confidenceLevel,
      confidenceShouldClarify: false,
      assumedFields: [...assumed],
      correctedFields: withoutBooking(input.correctedFields).map(normalizeField),
      moveHint: 'abort',
      questionBudgetUsed: 0,
    }
    return {
      contractVersion: CLARIFICATION_BRIDGE_VERSION,
      shouldAsk: false,
      questionCandidate: null,
      mergedFields: [],
      avoidReasons,
      planningHints,
      cmInjectionDesign: {
        mode: 'planning_hints_injection',
        planningHints,
        cmMustSkipSelection: true,
        bridgeSuppliesCopy: false,
      },
    }
  }

  // Confirmed / corrected-now-known / assumed → avoid.
  for (const field of confirmed) {
    pushAvoid(field, 'already_known')
  }
  for (const field of withoutBooking(input.correctedFields).map(normalizeField)) {
    if (confirmed.has(field)) pushAvoid(field, 'corrected_now_known')
  }
  for (const field of assumed) {
    if (!confirmed.has(field)) pushAvoid(field, 'assumed_safe')
  }

  // Deferrable non-blocking → avoid as not_blocking.
  for (const field of withoutBooking(input.missing.deferrable)) {
    const key = normalizeField(field)
    if (!confirmed.has(key) && !assumed.has(key)) {
      pushAvoid(key, 'not_blocking')
    }
  }

  const rawBlocking = unique(
    [
      ...withoutBooking(input.missing.blocking),
      ...withoutBooking(input.blockingFields),
      // Ambiguity / conflict create clarify pressure even if missing.blocking omitted.
      ...withoutBooking(input.ambiguousFields),
      ...withoutBooking(input.conflictingFields),
    ].map(normalizeField),
  )

  // Normalize date aliases into dates when any date part is blocking.
  const hasDatePart = rawBlocking.some((f) => f === 'dates' || f === 'startDate' || f === 'endDate')
  const normalizedBlocking = rawBlocking.map((f) =>
    f === 'startDate' || f === 'endDate' ? 'dates' : f,
  )
  const blockingUnique = unique(
    hasDatePart
      ? [...normalizedBlocking.filter((f) => f !== 'startDate' && f !== 'endDate'), 'dates']
      : normalizedBlocking,
  )

  const ambiguousSet = new Set(withoutBooking(input.ambiguousFields).map(normalizeField))
  const conflictingSet = new Set(withoutBooking(input.conflictingFields).map(normalizeField))

  const askable = blockingUnique.filter((field) => {
    if (BOOKING_ONLY_SET.has(field)) {
      pushAvoid(field, 'booking_deferred')
      return false
    }
    // Ambiguous / conflicting values remain askable even if a slot value exists.
    if (ambiguousSet.has(field) || conflictingSet.has(field)) {
      return true
    }
    if (confirmed.has(field)) {
      pushAvoid(field, 'already_known')
      return false
    }
    if (assumed.has(field)) {
      pushAvoid(field, 'assumed_safe')
      return false
    }
    return true
  })

  // Strict rule: if blocking set is empty after filters → shouldAsk=false.
  if (askable.length === 0) {
    pushAvoid('*', 'zero_question_path')
    if (input.confidence.searchEligible) {
      pushAvoid('*', 'search_eligible_no_ask')
    }
    const planningHints: ClarificationPlanningHints = {
      shouldAsk: false,
      questionKey: null,
      mergedFields: [],
      avoidReasons,
      searchEligible: input.confidence.searchEligible,
      confidenceLevel: input.confidence.confidenceLevel,
      confidenceShouldClarify: input.confidence.shouldClarify,
      assumedFields: [...assumed],
      correctedFields: withoutBooking(input.correctedFields).map(normalizeField),
      moveHint: 'none',
      questionBudgetUsed: 0,
    }
    return {
      contractVersion: CLARIFICATION_BRIDGE_VERSION,
      shouldAsk: false,
      questionCandidate: null,
      mergedFields: [],
      avoidReasons,
      planningHints,
      cmInjectionDesign: {
        mode: 'planning_hints_injection',
        planningHints,
        cmMustSkipSelection: true,
        bridgeSuppliesCopy: false,
      },
    }
  }

  // Search eligible with no residual askable → already handled. If somehow
  // searchEligible but askable remains (shouldn't for handoff), still allow ask
  // only when not searchEligible OR confidence says clarify.
  // Spec: "If search is not eligible, clarification may be produced."
  // Spec: blocking empty ⇒ no ask (handled). When askable non-empty, ask.
  const shouldAsk = true

  const mergedFields = mergeClarificationFields(askable)
  const primary = pickPrimaryField(mergedFields)

  // After 2 failed attempts on primary → strategy shift signal (no copy).
  const attempts = input.priorClarificationAttempts ?? []
  const primaryAttempts = attempts.find((a) => normalizeField(a.field) === primary)?.count ?? 0
  if (primaryAttempts >= 2) {
    pushAvoid(primary, 'strategy_shift_examples')
  }

  const questionCandidate: ClarificationQuestionCandidatePlan = {
    field: primary,
    reason: candidateReason(primary, input),
    detail: `single_clarification_candidate:merged=${mergedFields.join('+')}`,
  }

  const planningHints: ClarificationPlanningHints = {
    shouldAsk,
    questionKey: primary,
    mergedFields,
    avoidReasons,
    searchEligible: input.confidence.searchEligible,
    confidenceLevel: input.confidence.confidenceLevel,
    confidenceShouldClarify: input.confidence.shouldClarify,
    assumedFields: [...assumed],
    correctedFields: withoutBooking(input.correctedFields).map(normalizeField),
    moveHint: 'clarify',
    questionBudgetUsed: 1,
  }

  return {
    contractVersion: CLARIFICATION_BRIDGE_VERSION,
    shouldAsk,
    questionCandidate,
    mergedFields,
    avoidReasons,
    planningHints,
    cmInjectionDesign: {
      mode: 'planning_hints_injection',
      planningHints,
      cmMustSkipSelection: true,
      bridgeSuppliesCopy: false,
    },
  }
}

export class ClarificationBridge {
  readonly version = CLARIFICATION_BRIDGE_VERSION

  plan(input: ClarificationBridgeInput): ClarificationBridgeResult {
    return planClarification(input)
  }
}

export function createClarificationBridge(): ClarificationBridge {
  return new ClarificationBridge()
}
