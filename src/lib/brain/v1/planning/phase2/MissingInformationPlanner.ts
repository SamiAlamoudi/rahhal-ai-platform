/**
 * Sprint 89 Phase 2 (T2) — MissingInformationPlanner.
 *
 * Pure classification over Phase 1 UnderstandingTurnResult + knownSlots.
 * Does NOT re-extract entities, generate user-facing reply text, execute search,
 * call ProviderGateway, or wire BrainRouter / ConversationManager.
 */

import type {
  ConsultantIntent,
  ConversationKnownSlots,
  UnderstandingTurnResult,
} from '../../understanding/types'

export const MISSING_INFORMATION_PLANNER_VERSION =
  'missing-information-planner@1.x' as const

/** Planning goal used to choose blocking vs deferrable sets (interim). */
export type MissingInfoGoal =
  | 'advise'
  | 'explore'
  | 'search'
  | 'compare'
  | 'visa_guidance'
  | 'domain_flight'
  | 'domain_hotel'
  | 'domain_activity'
  | 'domain_car'
  | 'abort'

export type MissingFieldClassification = 'blocking' | 'deferrable' | 'bookingOnly'

/** Machine-readable reason codes — never user-facing copy. */
export type MissingFieldReasonCode =
  | 'absent_from_known_slots'
  | 'assumed_not_confirmed'
  | 'ambiguous_reference'
  | 'conflicting_confidence'
  | 'booking_deferred'
  | 'superseded_cleared'
  | 'goal_optional'
  | 'abort_no_ask'

export type MissingFieldEntry = {
  field: string
  classification: MissingFieldClassification
  reason: MissingFieldReasonCode
  /** Why this field matters for the current goal (structured, not prose). */
  detail: string
}

/**
 * At most one clarification candidate. Field keys + reason only —
 * CM (later) formats locale strings. No ar/en reply text here.
 */
export type ClarificationQuestionCandidate = {
  field: string
  mergedFields: string[]
  reason: MissingFieldReasonCode
  detail: string
}

export type MissingInformationPlannerInput = {
  /** Phase 1 understanding — required source of truth for slots/provenance. */
  understanding: UnderstandingTurnResult
  /** Optional goal override; otherwise derived from consultant intent. */
  goalHint?: MissingInfoGoal
  /**
   * Fields already accepted as safe assumptions (T3 will own writes).
   * Never re-asked for advise; do not alone authorize search sufficiency.
   */
  assumedFields?: readonly string[]
  /** Explicit abort; defaults from primaryIntent === 'abort'. */
  abort?: boolean
}

export type MissingInformationResult = {
  contractVersion: typeof MISSING_INFORMATION_PLANNER_VERSION
  goal: MissingInfoGoal
  abort: boolean
  /** Structured missing entries (blocking + deferrable + bookingOnly). */
  fields: MissingFieldEntry[]
  /** Flat field names (union of classifications). */
  missing: string[]
  blocking: string[]
  deferrable: string[]
  bookingOnly: string[]
  /** Present knownSlots keys (post-correction) — must never be re-asked. */
  confirmedFields: string[]
  /** Echo of Phase 1 supersededFields (priors are not current). */
  supersededFields: string[]
  sufficientForAdvise: boolean
  /** Eligibility only — never executes search. */
  sufficientForSearch: boolean
  clarificationRequired: boolean
  /** Maximum one candidate; null when no ask. */
  clarificationCandidate: ClarificationQuestionCandidate | null
}

/** Never enter `blocking` for advise / planning / handoff eligibility. */
export const BOOKING_ONLY_FIELDS = [
  'passport',
  'payment',
  'payment_consent',
  'traveler_identity',
  'identity',
  'credit_card',
] as const

const BOOKING_ONLY_SET = new Set<string>(BOOKING_ONLY_FIELDS)

/** Deferrable trip-shape fields (never HANDOFF-blocking by themselves). */
const DEFERRABLE_TRIP_FIELDS = [
  'budget',
  'adults',
  'children',
  'travelerCount',
  'cabin',
  'hotelPreference',
  'activities',
  'currency',
  'specialRequests',
] as const

type PlannerContext = {
  slots: ConversationKnownSlots
  assumed: Set<string>
  ambiguousFields: Set<string>
  conflictingFields: Set<string>
  supersededFields: string[]
}

function deriveGoal(
  intent: ConsultantIntent,
  goalHint?: MissingInfoGoal,
): MissingInfoGoal {
  if (goalHint) return goalHint
  switch (intent) {
    case 'abort':
      return 'abort'
    case 'advise':
      return 'advise'
    case 'explore_destination':
    case 'small_talk':
      return 'explore'
    case 'compare':
      return 'compare'
    case 'visa_guidance':
      return 'visa_guidance'
    case 'domain_flight':
      return 'domain_flight'
    case 'domain_hotel':
      return 'domain_hotel'
    case 'domain_activity':
      return 'domain_activity'
    case 'domain_car':
      return 'domain_car'
    case 'plan_trip':
    case 'refine_trip':
      return 'search'
    case 'correct':
    case 'confirm':
    case 'unknown':
    default:
      return 'explore'
  }
}

function isPresent(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  return true
}

function slotPresent(
  slots: ConversationKnownSlots,
  field: string,
): boolean {
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
      return isPresent(slots.startDate) || isPresent(slots.endDate)
    case 'adults':
      return slots.adults != null || slots.travelerCount != null
    case 'children':
      return slots.children != null
    case 'travelerCount':
      return slots.travelerCount != null || slots.adults != null
    case 'budget':
      return slots.budget != null
    case 'nationality':
      // Not in ConversationKnownSlots — always absent unless assumed.
      return false
    case 'pickupLocation':
      return isPresent(slots.origin) || isPresent(slots.destination)
    default:
      return false
  }
}

function hasUsableDates(ctx: PlannerContext): boolean {
  if (slotPresent(ctx.slots, 'dates')) return true
  // Flex assumption removes ask pressure but does not alone authorize search.
  return false
}

function datesAssumedFlexible(ctx: PlannerContext): boolean {
  return ctx.assumed.has('flexibleDates') || ctx.assumed.has('dates')
}

function collectConfirmedFields(slots: ConversationKnownSlots): string[] {
  const out: string[] = []
  if (isPresent(slots.destination)) out.push('destination')
  if (isPresent(slots.origin)) out.push('origin')
  if (isPresent(slots.startDate)) out.push('startDate')
  if (isPresent(slots.endDate)) out.push('endDate')
  if (slots.adults != null) out.push('adults')
  if (slots.children != null) out.push('children')
  if (slots.travelerCount != null) out.push('travelerCount')
  if (slots.budget != null) out.push('budget')
  if (slotPresent(slots, 'dates')) out.push('dates')
  return out
}

function collectAssumedFromUnderstanding(
  understanding: UnderstandingTurnResult,
  explicit?: readonly string[],
): Set<string> {
  const assumed = new Set<string>(explicit ?? [])
  for (const [field, fact] of Object.entries(understanding.provenance)) {
    if (fact?.source === 'assumed') {
      assumed.add(normalizeFieldKey(field))
    }
  }
  for (const fact of understanding.entities.facts) {
    if (fact.kind === 'assumption' || fact.confidence.level === 'assumption') {
      assumed.add(normalizeFieldKey(fact.field))
    }
  }
  return assumed
}

function normalizeFieldKey(field: string): string {
  if (field === 'travelDates.start' || field === 'travelDates.end') return 'dates'
  if (field.startsWith('travelDates')) return 'dates'
  return field
}

function collectAmbiguousFields(understanding: UnderstandingTurnResult): Set<string> {
  const set = new Set<string>()
  for (const ref of understanding.references.ambiguous) {
    set.add(normalizeFieldKey(ref.field))
  }
  return set
}

function collectConflictingFields(understanding: UnderstandingTurnResult): Set<string> {
  const set = new Set<string>()
  for (const fact of understanding.entities.facts) {
    if (fact.confidence.level === 'conflicting') {
      set.add(normalizeFieldKey(fact.field))
    }
  }
  return set
}

function blockingFieldsForGoal(goal: MissingInfoGoal): string[] {
  switch (goal) {
    case 'advise':
    case 'explore':
    case 'abort':
      return []
    case 'compare':
      // Open explore is allowed; a single destination still suffices to advise compare themes.
      return []
    case 'visa_guidance':
      // Nationality may be needed for specific guidance — not search execute / not booking.
      return ['nationality']
    case 'search':
    case 'domain_flight':
      return ['origin', 'destination', 'dates']
    case 'domain_hotel':
      return ['destination', 'dates']
    case 'domain_car':
      return ['pickupLocation', 'dates']
    case 'domain_activity':
      return ['destination']
    default:
      return []
  }
}

function pushUnique(list: string[], field: string): void {
  if (!list.includes(field)) list.push(field)
}

function classifyMissing(input: MissingInformationPlannerInput): MissingInformationResult {
  const understanding = input.understanding
  const abort =
    input.abort === true || understanding.intent.primaryIntent === 'abort'
  const goal = abort ? 'abort' : deriveGoal(understanding.intent.primaryIntent, input.goalHint)

  // Post-correction knownSlots are the sole trip-fact SoT (no re-extract).
  const slots = understanding.state.knownSlots
  const supersededFields = [...understanding.state.supersededFields]
  const assumed = collectAssumedFromUnderstanding(understanding, input.assumedFields)
  const ambiguousFields = collectAmbiguousFields(understanding)
  const conflictingFields = collectConflictingFields(understanding)
  const confirmedFields = collectConfirmedFields(slots)

  const ctx: PlannerContext = {
    slots,
    assumed,
    ambiguousFields,
    conflictingFields,
    supersededFields,
  }

  const fields: MissingFieldEntry[] = []
  const blocking: string[] = []
  const deferrable: string[] = []
  const bookingOnly: string[] = []

  // Always surface booking-only fields as never-blocking deferred intake.
  for (const field of BOOKING_ONLY_FIELDS) {
    pushUnique(bookingOnly, field)
    fields.push({
      field,
      classification: 'bookingOnly',
      reason: 'booking_deferred',
      detail: 'passport_payment_identity_never_blocks_advise_or_planning',
    })
  }

  if (abort) {
    return {
      contractVersion: MISSING_INFORMATION_PLANNER_VERSION,
      goal: 'abort',
      abort: true,
      fields,
      missing: [...bookingOnly],
      blocking: [],
      deferrable: [],
      bookingOnly,
      confirmedFields,
      supersededFields,
      sufficientForAdvise: true,
      sufficientForSearch: false,
      clarificationRequired: false,
      clarificationCandidate: null,
    }
  }

  const requiredBlocking = blockingFieldsForGoal(goal)

  for (const field of requiredBlocking) {
    if (BOOKING_ONLY_SET.has(field)) continue

    const present = field === 'dates' ? hasUsableDates(ctx) : slotPresent(slots, field)
    const assumedOk =
      assumed.has(field)
      || (field === 'dates' && datesAssumedFlexible(ctx))
      || (field === 'pickupLocation'
        && (assumed.has('origin') || assumed.has('destination') || assumed.has('pickupLocation')))

    if (present && !conflictingFields.has(field) && !ambiguousFields.has(field)) {
      continue
    }

    if (present && (conflictingFields.has(field) || ambiguousFields.has(field))) {
      // Value exists but is unusable — still blocking for search-shaped goals.
      pushUnique(blocking, field)
      fields.push({
        field,
        classification: 'blocking',
        reason: conflictingFields.has(field)
          ? 'conflicting_confidence'
          : 'ambiguous_reference',
        detail: present
          ? 'known_slot_unusable_until_resolved'
          : 'absent_from_known_slots',
      })
      continue
    }

    // Absent from knownSlots.
    if (assumedOk) {
      // Assumed: not asked again for advise; not listed as blocking ask.
      // Still does not alone authorize search (sufficientForSearch computed below).
      pushUnique(deferrable, field)
      fields.push({
        field,
        classification: 'deferrable',
        reason: 'assumed_not_confirmed',
        detail: 'assumed_skips_reask_does_not_authorize_handoff_alone',
      })
      continue
    }

    const clearedBySupersede =
      supersededFields.includes(field)
      || (field === 'dates'
        && (supersededFields.includes('startDate') || supersededFields.includes('endDate')))

    pushUnique(blocking, field)
    fields.push({
      field,
      classification: 'blocking',
      reason: clearedBySupersede ? 'superseded_cleared' : 'absent_from_known_slots',
      detail: `required_for_goal:${goal}`,
    })
  }

  // Deferrable trip fields when absent and not assumed / confirmed.
  for (const field of DEFERRABLE_TRIP_FIELDS) {
    if (confirmedFields.includes(field) || slotPresent(slots, field)) continue
    if (assumed.has(field)) continue
    if (blocking.includes(field)) continue
    pushUnique(deferrable, field)
    fields.push({
      field,
      classification: 'deferrable',
      reason: 'goal_optional',
      detail: 'optional_or_high_impact_not_blocking',
    })
  }

  // Origin/destination soft gaps on advise/explore (never blocking).
  if (goal === 'advise' || goal === 'explore' || goal === 'compare') {
    for (const field of ['destination', 'origin', 'dates'] as const) {
      if (slotPresent(slots, field === 'dates' ? 'dates' : field)) continue
      if (field === 'dates' && datesAssumedFlexible(ctx)) continue
      if (assumed.has(field)) continue
      if (blocking.includes(field) || deferrable.includes(field)) continue
      pushUnique(deferrable, field)
      fields.push({
        field,
        classification: 'deferrable',
        reason: 'goal_optional',
        detail: `helpful_for_${goal}_not_handoff_blocking`,
      })
    }
  }

  // Guard: booking-only must never appear in blocking.
  for (const field of [...blocking]) {
    if (BOOKING_ONLY_SET.has(field)) {
      const idx = blocking.indexOf(field)
      if (idx >= 0) blocking.splice(idx, 1)
      pushUnique(bookingOnly, field)
    }
  }

  const hasDestination = slotPresent(slots, 'destination')
  const sufficientForAdvise =
    goal === 'visa_guidance'
      ? !blocking.includes('nationality') || assumed.has('nationality')
      : true // advise/explore may proceed with zero slots (value-first)

  const searchShaped =
    goal === 'search'
    || goal === 'domain_flight'
    || goal === 'domain_hotel'
    || goal === 'domain_car'
    || goal === 'domain_activity'

  // Assumed flex/dates alone never authorize search sufficiency (ConfidenceGates later).
  const datesOkForSearch = hasUsableDates(ctx) && !conflictingFields.has('dates')
  const originOk =
    (goal === 'domain_hotel' || goal === 'domain_activity')
      ? true
      : goal === 'domain_car'
        ? slotPresent(slots, 'pickupLocation')
        : slotPresent(slots, 'origin')
  const destOk =
    goal === 'domain_car'
      ? slotPresent(slots, 'pickupLocation')
      : hasDestination

  const sufficientForSearch =
    searchShaped
    && blocking.length === 0
    && destOk
    && originOk
    && (goal === 'domain_activity' ? destOk : datesOkForSearch)
    && ambiguousFields.size === 0
    && conflictingFields.size === 0

  const clarificationCandidate = pickClarificationCandidate({
    blocking,
    ambiguousFields,
    conflictingFields,
    goal,
  })

  const clarificationRequired = clarificationCandidate != null

  const missing = [
    ...new Set([...blocking, ...deferrable, ...bookingOnly]),
  ]

  return {
    contractVersion: MISSING_INFORMATION_PLANNER_VERSION,
    goal,
    abort: false,
    fields,
    missing,
    blocking,
    deferrable,
    bookingOnly,
    confirmedFields,
    supersededFields,
    sufficientForAdvise,
    sufficientForSearch,
    clarificationRequired,
    clarificationCandidate,
  }
}

function pickClarificationCandidate(input: {
  blocking: string[]
  ambiguousFields: Set<string>
  conflictingFields: Set<string>
  goal: MissingInfoGoal
}): ClarificationQuestionCandidate | null {
  // Prefer conflicting / ambiguous on a blocking field, else first blocking.
  for (const field of input.blocking) {
    if (input.conflictingFields.has(field)) {
      return {
        field,
        mergedFields: [field],
        reason: 'conflicting_confidence',
        detail: 'resolve_conflict_before_handoff',
      }
    }
  }
  for (const field of input.blocking) {
    if (input.ambiguousFields.has(field)) {
      return {
        field,
        mergedFields: [field],
        reason: 'ambiguous_reference',
        detail: 'resolve_ambiguity_before_handoff',
      }
    }
  }
  if (input.blocking.length > 0) {
    // Merge remaining blocking into one candidate (≤1 question later).
    const mergedFields = [...input.blocking]
    return {
      field: mergedFields[0]!,
      mergedFields,
      reason: 'absent_from_known_slots',
      detail: `single_clarification_candidate_for_goal:${input.goal}`,
    }
  }

  // Ambiguity on a confirmed field that is not in blocking (advise path).
  for (const field of input.ambiguousFields) {
    if (BOOKING_ONLY_SET.has(field)) continue
    return {
      field,
      mergedFields: [field],
      reason: 'ambiguous_reference',
      detail: 'resolve_ambiguous_reference',
    }
  }
  for (const field of input.conflictingFields) {
    if (BOOKING_ONLY_SET.has(field)) continue
    return {
      field,
      mergedFields: [field],
      reason: 'conflicting_confidence',
      detail: 'resolve_conflicting_field',
    }
  }

  return null
}

export class MissingInformationPlanner {
  readonly version = MISSING_INFORMATION_PLANNER_VERSION

  plan(input: MissingInformationPlannerInput): MissingInformationResult {
    return classifyMissing(input)
  }
}

export function createMissingInformationPlanner(): MissingInformationPlanner {
  return new MissingInformationPlanner()
}

export function planMissingInformation(
  input: MissingInformationPlannerInput,
): MissingInformationResult {
  return classifyMissing(input)
}
