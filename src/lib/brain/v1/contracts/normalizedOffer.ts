/**
 * Sprint 88 Task 2 — NormalizedOffer contract (interfaces only).
 * Aligns with Architecture ADD §13.3 offer normalization checklist.
 * No provider calls; no ranking execution.
 */

export type NormalizedOfferKind =
  | 'flight'
  | 'hotel'
  | 'car'
  | 'activity'
  | 'package'
  | 'other'

export type FareFamilyInfo = {
  cabin: string | null
  brandedFare: string | null
  attributes: string[]
}

export type BaggageInfo = {
  /** included | paid | unknown */
  status: 'included' | 'paid' | 'unknown'
  detail: string | null
}

export type CancellationPolicyInfo = {
  /** refundable | partial | non_refundable | unknown */
  status: 'refundable' | 'partial' | 'non_refundable' | 'unknown'
  detail: string | null
}

export type OfferMoney = {
  amount: number | null
  currency: string
  /** Original amount/currency before conversion when known. */
  originalAmount?: number | null
  originalCurrency?: string | null
  taxesAndFees?: number | null
  /** true when taxes/fees breakdown is unavailable */
  taxesAndFeesUnknown?: boolean
}

export type OfferProvenance = {
  providerId: string
  requestId: string | null
  fetchedAt: string
  confidence: number | null
}

/**
 * Cross-provider normalized offer shape for DomainIntelligence + ranking.
 * Implementations land in Sprint 90+; this module is types + pure helpers only.
 */
export type NormalizedOffer = {
  id: string
  kind: NormalizedOfferKind
  title: string
  money: OfferMoney
  durationMinutes: number | null
  stops: number | null
  scheduleSummary: string | null
  baggage: BaggageInfo
  fareFamily: FareFamilyInfo
  cancellation: CancellationPolicyInfo
  hotelRating: number | null
  hotelLocationSummary: string | null
  airline: string | null
  /** ISO timestamp used for stale-result detection */
  fetchedAt: string
  staleAfterMs: number | null
  provenance: OfferProvenance
  /** Compare-group key for cross-provider dedupe */
  dedupeGroupId: string | null
}

export const DEFAULT_OFFER_STALE_AFTER_MS = 15 * 60 * 1000

export function emptyBaggageInfo(): BaggageInfo {
  return { status: 'unknown', detail: null }
}

export function emptyFareFamilyInfo(): FareFamilyInfo {
  return { cabin: null, brandedFare: null, attributes: [] }
}

export function emptyCancellationPolicyInfo(): CancellationPolicyInfo {
  return { status: 'unknown', detail: null }
}

/** Pure factory for tests / future mappers — does not fetch providers. */
export function createNormalizedOfferSkeleton(
  partial: Pick<NormalizedOffer, 'id' | 'kind' | 'title' | 'money'> &
    Partial<NormalizedOffer>,
): NormalizedOffer {
  const fetchedAt = partial.fetchedAt ?? new Date(0).toISOString()
  return {
    id: partial.id,
    kind: partial.kind,
    title: partial.title,
    money: {
      ...partial.money,
      taxesAndFeesUnknown: partial.money.taxesAndFeesUnknown ?? true,
    },
    durationMinutes: partial.durationMinutes ?? null,
    stops: partial.stops ?? null,
    scheduleSummary: partial.scheduleSummary ?? null,
    baggage: partial.baggage ?? emptyBaggageInfo(),
    fareFamily: partial.fareFamily ?? emptyFareFamilyInfo(),
    cancellation: partial.cancellation ?? emptyCancellationPolicyInfo(),
    hotelRating: partial.hotelRating ?? null,
    hotelLocationSummary: partial.hotelLocationSummary ?? null,
    airline: partial.airline ?? null,
    fetchedAt,
    staleAfterMs: partial.staleAfterMs ?? DEFAULT_OFFER_STALE_AFTER_MS,
    provenance: partial.provenance ?? {
      providerId: 'unknown',
      requestId: null,
      fetchedAt,
      confidence: null,
    },
    dedupeGroupId: partial.dedupeGroupId ?? null,
  }
}

export function isNormalizedOfferStale(
  offer: NormalizedOffer,
  nowMs: number = Date.now(),
): boolean {
  if (offer.staleAfterMs == null) return false
  const fetched = Date.parse(offer.fetchedAt)
  if (Number.isNaN(fetched)) return true
  return nowMs - fetched > offer.staleAfterMs
}
