/**
 * Sprint 36 — shared helpers for provider policy adapters.
 */

import type {
  NormalizedRefundPolicy,
  PolicyServiceKind,
  Refundability,
} from '../types'

export function emptyAttributes(): NormalizedRefundPolicy['attributes'] {
  return {
    noShowPenalty: false,
    changeFeeApplicable: false,
    sameDayCancellation: false,
    airlineInitiatedFullRefund: true,
    freeCancellation: false,
    firstNightPenalty: false,
    payAtHotel: false,
    prepaid: false,
    earlyDeparturePenalty: false,
    lateCancellationPenalty: false,
    pickupDeadlineHours: null,
    insuranceRefundable: false,
    depositRefundable: true,
    fuelPolicyNote: null,
    oneWayFeeNonRefundable: false,
    weatherCancellationFullRefund: false,
    frameworkOnly: false,
  }
}

export function basePolicy(input: {
  serviceKind: PolicyServiceKind
  providerId: string
  sourcePolicyId: string
  currency: string
  refundability: Refundability
  refundable: boolean
  refundPercent: number
  penaltyAmount?: number
  taxesRefundable?: number
  taxesNonRefundable?: number
  providerFee?: number
  platformFee?: number
  cancellationDeadline?: string | null
  refundTimelineBusinessDaysMin?: number
  refundTimelineBusinessDaysMax?: number
  specialConditions?: string[]
  providerNotes?: string[]
  attributes?: Partial<NormalizedRefundPolicy['attributes']>
}): NormalizedRefundPolicy {
  return {
    serviceKind: input.serviceKind,
    refundability: input.refundability,
    refundable: input.refundable,
    refundPercent: input.refundPercent,
    penaltyAmount: input.penaltyAmount ?? 0,
    penaltyCurrency: input.currency,
    taxesRefundable: input.taxesRefundable ?? 0,
    taxesNonRefundable: input.taxesNonRefundable ?? 0,
    providerFee: input.providerFee ?? 0,
    platformFee: input.platformFee ?? 0,
    cancellationDeadline: input.cancellationDeadline ?? null,
    refundTimelineBusinessDaysMin: input.refundTimelineBusinessDaysMin ?? 5,
    refundTimelineBusinessDaysMax: input.refundTimelineBusinessDaysMax ?? 7,
    specialConditions: input.specialConditions ?? [],
    providerNotes: input.providerNotes ?? [],
    attributes: { ...emptyAttributes(), ...input.attributes },
    providerId: input.providerId,
    sourcePolicyId: input.sourcePolicyId,
  }
}

export function num(raw: Record<string, unknown>, key: string, fallback = 0): number {
  const v = raw[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

export function str(raw: Record<string, unknown>, key: string, fallback: string | null = null): string | null {
  const v = raw[key]
  return typeof v === 'string' ? v : fallback
}

export function bool(raw: Record<string, unknown>, key: string, fallback = false): boolean {
  const v = raw[key]
  return typeof v === 'boolean' ? v : fallback
}
