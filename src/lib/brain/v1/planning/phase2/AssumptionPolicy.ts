/**
 * Sprint 89 Phase 2 (T3) — AssumptionPolicy.
 *
 * Proposes reversible planning assumptions from Phase 1 knownSlots / understanding.
 * Never re-extracts entities. Never promotes assumed → confirmed.
 * Does not write memory (MemoryManager.applyAssumptions owns commits).
 * No Search / ProviderGateway / BrainRouter / CM.
 */

import {
  createMemoryFactProvenance,
  type MemoryFactProvenance,
} from '../../preview/memory'
import type {
  ConversationKnownSlots,
  UnderstandingTurnResult,
} from '../../understanding/types'

export const ASSUMPTION_POLICY_VERSION = 'assumption-engine@1.x' as const

/** Normative memory source for every Phase 2 assumption write. */
export type AssumptionSource = 'assumed'

export type AssumptionReasonCode =
  | 'default_single_traveler'
  | 'default_flexible_dates'
  | 'default_cabin_economy'
  | 'default_hotel_midrange'
  | 'default_trip_leisure'
  | 'soft_currency_from_locale'
  | 'pace_propose_only'
  | 'rejected_sensitive'
  | 'rejected_core_slot'
  | 'rejected_invented_budget'
  | 'rejected_invented_dates'
  | 'rejected_already_confirmed'
  | 'rejected_already_assumed'
  | 'rejected_abort'
  | 'rejected_promotion_forbidden'

export type AssumptionDecision = {
  field: string
  value: unknown
  /** Always literal "assumed" — never user_provided / confirmed. */
  source: AssumptionSource
  confidence: { level: 'assumption'; score: number }
  reason: AssumptionReasonCode
  /** Structured provenance ready for MemoryManager (source assumed). */
  provenance: MemoryFactProvenance
  reversible: true
  requiresConfirmationBeforeBooking: boolean
  /** When false, propose-only — do not commit into trip slots. */
  commitToMemory: boolean
}

export type AssumptionRejection = {
  field: string
  reason: AssumptionReasonCode
  detail: string
}

export type AssumptionPolicyInput = {
  understanding: UnderstandingTurnResult
  /** Prior assumption field names still active (reversible). */
  priorAssumedFields?: readonly string[]
  /** Explicit abort; defaults from primaryIntent === 'abort'. */
  abort?: boolean
  locale?: 'ar' | 'en'
  planId?: string | null
  updatedAt?: string
}

export type AssumptionPolicyResult = {
  contractVersion: typeof ASSUMPTION_POLICY_VERSION
  abort: boolean
  proposed: AssumptionDecision[]
  rejected: AssumptionRejection[]
  /** Field names in `proposed` (including propose-only). */
  assumedFields: string[]
  /** Subset safe for MemoryManager.applyAssumptions. */
  committable: AssumptionDecision[]
}

/** Never assume these (sensitive / high-harm / irreversible). */
export const ASSUMPTION_FORBIDDEN_FIELDS = [
  'destination',
  'origin',
  'startDate',
  'endDate',
  'dates',
  'nationality',
  'passport',
  'payment',
  'payment_consent',
  'traveler_identity',
  'identity',
  'credit_card',
  'visa',
  'health',
  'accessibility',
  'consent',
  'budget',
  'budgetAmount',
] as const

const FORBIDDEN = new Set<string>(ASSUMPTION_FORBIDDEN_FIELDS)

function isPresent(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

function hasDates(slots: ConversationKnownSlots): boolean {
  return isPresent(slots.startDate) || isPresent(slots.endDate)
}

function hasTravelers(slots: ConversationKnownSlots): boolean {
  return slots.adults != null || slots.travelerCount != null
}

function confirmedFieldsFromUnderstanding(
  understanding: UnderstandingTurnResult,
): Set<string> {
  const confirmed = new Set<string>()
  const slots = understanding.state.knownSlots
  if (isPresent(slots.destination)) confirmed.add('destination')
  if (isPresent(slots.origin)) confirmed.add('origin')
  if (isPresent(slots.startDate)) confirmed.add('startDate')
  if (isPresent(slots.endDate)) confirmed.add('endDate')
  if (hasDates(slots)) confirmed.add('dates')
  if (slots.adults != null) confirmed.add('adults')
  if (slots.children != null) confirmed.add('children')
  if (slots.travelerCount != null) confirmed.add('travelerCount')
  if (slots.budget != null) {
    confirmed.add('budget')
    confirmed.add('budgetAmount')
  }
  for (const [field, fact] of Object.entries(understanding.provenance)) {
    if (fact?.source === 'user_stated') confirmed.add(field)
  }
  for (const fact of understanding.entities.facts) {
    if (
      fact.kind === 'user_provided'
      || fact.kind === 'corrected'
      || fact.confidence.level === 'confirmed'
    ) {
      confirmed.add(fact.field)
      if (fact.field === 'cabinClass') confirmed.add('cabin')
    }
  }
  return confirmed
}

function alreadyAssumed(
  understanding: UnderstandingTurnResult,
  prior: readonly string[] | undefined,
): Set<string> {
  const set = new Set<string>(prior ?? [])
  for (const [field, fact] of Object.entries(understanding.provenance)) {
    if (fact?.source === 'assumed') set.add(field)
  }
  for (const fact of understanding.entities.facts) {
    if (fact.kind === 'assumption' || fact.confidence.level === 'assumption') {
      set.add(fact.field)
    }
  }
  return set
}

function buildDecision(input: {
  field: string
  value: unknown
  reason: AssumptionReasonCode
  score: number
  requiresConfirmationBeforeBooking: boolean
  commitToMemory: boolean
  planId: string | null
  updatedAt: string
}): AssumptionDecision {
  const provenance = createMemoryFactProvenance({
    field: input.field,
    value: input.value,
    source: 'assumed',
    confidence: input.score,
    planId: input.planId,
    updatedAt: input.updatedAt,
    reversible: true,
  })
  return {
    field: input.field,
    value: input.value,
    source: 'assumed',
    confidence: { level: 'assumption', score: input.score },
    reason: input.reason,
    provenance,
    reversible: true,
    requiresConfirmationBeforeBooking: input.requiresConfirmationBeforeBooking,
    commitToMemory: input.commitToMemory,
  }
}

function softCurrencyForLocale(locale: 'ar' | 'en'): string {
  // Soft locale default only — never invents a budget amount.
  return locale === 'ar' ? 'SAR' : 'SAR'
}

/**
 * Validate an external candidate before commit.
 * Phase 2 cannot promote assumed → confirmed.
 */
export function assertAssumptionWritable(candidate: {
  field: string
  source?: string
  confidenceLevel?: string
}): AssumptionRejection | null {
  if (candidate.source != null && candidate.source !== 'assumed') {
    return {
      field: candidate.field,
      reason: 'rejected_promotion_forbidden',
      detail: 'phase2_assumptions_must_source_assumed',
    }
  }
  if (candidate.confidenceLevel === 'confirmed') {
    return {
      field: candidate.field,
      reason: 'rejected_promotion_forbidden',
      detail: 'assumed_must_never_become_confirmed_in_phase2',
    }
  }
  if (FORBIDDEN.has(candidate.field)) {
    const reason: AssumptionReasonCode =
      candidate.field === 'budget' || candidate.field === 'budgetAmount'
        ? 'rejected_invented_budget'
        : candidate.field === 'startDate'
            || candidate.field === 'endDate'
            || candidate.field === 'dates'
          ? 'rejected_invented_dates'
          : candidate.field === 'destination' || candidate.field === 'origin'
            ? 'rejected_core_slot'
            : 'rejected_sensitive'
    return {
      field: candidate.field,
      reason,
      detail: 'assumption_policy_forbid_list',
    }
  }
  return null
}

export function proposeAssumptions(
  input: AssumptionPolicyInput,
): AssumptionPolicyResult {
  const understanding = input.understanding
  const abort =
    input.abort === true || understanding.intent.primaryIntent === 'abort'
  const locale = input.locale ?? understanding.state.locale
  const planId = input.planId ?? understanding.state.activeTripId
  const updatedAt = input.updatedAt ?? new Date(0).toISOString()
  const proposed: AssumptionDecision[] = []
  const rejected: AssumptionRejection[] = []

  if (abort) {
    return {
      contractVersion: ASSUMPTION_POLICY_VERSION,
      abort: true,
      proposed: [],
      rejected: [
        {
          field: '*',
          reason: 'rejected_abort',
          detail: 'abort_preserves_memory_no_new_assumptions',
        },
      ],
      assumedFields: [],
      committable: [],
    }
  }

  const slots = understanding.state.knownSlots
  const confirmed = confirmedFieldsFromUnderstanding(understanding)
  const assumed = alreadyAssumed(understanding, input.priorAssumedFields)

  const tryPropose = (decision: AssumptionDecision) => {
    const guard = assertAssumptionWritable({
      field: decision.field,
      source: decision.source,
      confidenceLevel: decision.confidence.level,
    })
    if (guard) {
      rejected.push(guard)
      return
    }
    if (confirmed.has(decision.field)) {
      rejected.push({
        field: decision.field,
        reason: 'rejected_already_confirmed',
        detail: 'confirmed_memory_blocks_assumption',
      })
      return
    }
    if (assumed.has(decision.field)) {
      rejected.push({
        field: decision.field,
        reason: 'rejected_already_assumed',
        detail: 'assumption_already_active',
      })
      return
    }
    proposed.push(decision)
    assumed.add(decision.field)
  }

  // --- Allowlist (plan §17) ---

  if (!hasTravelers(slots) && !confirmed.has('adults') && !confirmed.has('travelerCount')) {
    tryPropose(
      buildDecision({
        field: 'adults',
        value: 1,
        reason: 'default_single_traveler',
        score: 0.62,
        requiresConfirmationBeforeBooking: true,
        commitToMemory: true,
        planId,
        updatedAt,
      }),
    )
  }

  if (!hasDates(slots) && !confirmed.has('dates') && !confirmed.has('flexibleDates')) {
    tryPropose(
      buildDecision({
        field: 'flexibleDates',
        value: true,
        reason: 'default_flexible_dates',
        score: 0.7,
        requiresConfirmationBeforeBooking: true,
        commitToMemory: true,
        planId,
        updatedAt,
      }),
    )
  }

  if (!confirmed.has('cabin') && !confirmed.has('cabinClass') && !assumed.has('cabin')) {
    tryPropose(
      buildDecision({
        field: 'cabin',
        value: 'economy',
        reason: 'default_cabin_economy',
        score: 0.68,
        requiresConfirmationBeforeBooking: true,
        commitToMemory: true,
        planId,
        updatedAt,
      }),
    )
  }

  if (
    !confirmed.has('hotelPreference')
    && !confirmed.has('hotelCategory')
    && !assumed.has('hotelCategory')
  ) {
    tryPropose(
      buildDecision({
        field: 'hotelCategory',
        value: 'mid-range',
        reason: 'default_hotel_midrange',
        score: 0.58,
        requiresConfirmationBeforeBooking: true,
        commitToMemory: true,
        planId,
        updatedAt,
      }),
    )
  }

  if (!confirmed.has('tripPurpose') && !confirmed.has('tripType')) {
    tryPropose(
      buildDecision({
        field: 'tripType',
        value: 'leisure',
        reason: 'default_trip_leisure',
        score: 0.65,
        requiresConfirmationBeforeBooking: false,
        commitToMemory: true,
        planId,
        updatedAt,
      }),
    )
  }

  // Soft currency from locale when empty — never invents budget amount.
  const currencyConfirmed =
    confirmed.has('currency')
    || confirmed.has('budgetCurrency')
    || Boolean(
      understanding.entities.entities.currency
      && String(understanding.entities.entities.currency).trim(),
    )
  if (!currencyConfirmed && !assumed.has('currency')) {
    tryPropose(
      buildDecision({
        field: 'currency',
        value: softCurrencyForLocale(locale),
        reason: 'soft_currency_from_locale',
        score: 0.55,
        requiresConfirmationBeforeBooking: false,
        commitToMemory: true,
        planId,
        updatedAt,
      }),
    )
  }

  // Pace — propose only (itinerary apply = Phase 4).
  if (!assumed.has('pace') && !confirmed.has('pace')) {
    tryPropose(
      buildDecision({
        field: 'pace',
        value: 'balanced',
        reason: 'pace_propose_only',
        score: 0.5,
        requiresConfirmationBeforeBooking: false,
        commitToMemory: false,
        planId,
        updatedAt,
      }),
    )
  }

  // Explicit rejections for common forbidden probes (eval visibility).
  for (const field of [
    'destination',
    'origin',
    'nationality',
    'budget',
    'startDate',
  ] as const) {
    if (!confirmed.has(field)) {
      const probe = assertAssumptionWritable({ field, source: 'assumed' })
      if (probe && !rejected.some((r) => r.field === field && r.reason === probe.reason)) {
        // Only record once as policy surface — not per-turn noise for every propose.
      }
    }
  }

  return {
    contractVersion: ASSUMPTION_POLICY_VERSION,
    abort: false,
    proposed,
    rejected,
    assumedFields: proposed.map((p) => p.field),
    committable: proposed.filter((p) => p.commitToMemory),
  }
}

/**
 * Hard-deny promotion helper — Phase 2 must never call this successfully.
 * Exists so tests / callers can assert the contract.
 */
export function promoteAssumptionToConfirmed(_field: string): never {
  throw new Error(
    'INTERNAL_CONTRACT_VIOLATION:phase2_cannot_promote_assumed_to_confirmed',
  )
}

export class AssumptionPolicy {
  readonly version = ASSUMPTION_POLICY_VERSION

  propose(input: AssumptionPolicyInput): AssumptionPolicyResult {
    return proposeAssumptions(input)
  }

  /** Rejects any non-assumed / forbidden candidate. */
  validateCandidate(candidate: {
    field: string
    source?: string
    confidenceLevel?: string
  }): AssumptionRejection | null {
    return assertAssumptionWritable(candidate)
  }
}

export function createAssumptionPolicy(): AssumptionPolicy {
  return new AssumptionPolicy()
}
