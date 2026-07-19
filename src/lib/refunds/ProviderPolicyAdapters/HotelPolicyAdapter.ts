import { basePolicy, bool, num, str } from './base'
import type { NormalizedRefundPolicy, ProviderPolicyAdapter } from '../types'

/** Normalizes hotel cancellation policies (reuses freeCancellation/deadline shapes). */
export class HotelPolicyAdapter implements ProviderPolicyAdapter {
  readonly serviceKind = 'hotel' as const
  readonly providerId: string

  constructor(providerId = 'hotel_generic') {
    this.providerId = providerId
  }

  normalize(raw: Record<string, unknown>, currency: string): NormalizedRefundPolicy {
    const freeCancellation = bool(raw, 'freeCancellation', false)
    const nonRefundable = bool(raw, 'nonRefundable', !freeCancellation && !bool(raw, 'refundable', false))
    const firstNightPenalty = bool(raw, 'firstNightPenalty', false)
    const payAtHotel = bool(raw, 'payAtHotel', false)
    const prepaid = bool(raw, 'prepaid', !payAtHotel)
    const deadline = str(raw, 'deadline', str(raw, 'cancellationDeadline'))
    const penaltyAmount = num(raw, 'penaltyAmount', firstNightPenalty ? num(raw, 'nightly', 0) : 0)

    let refundPercent = 100
    let refundability: NormalizedRefundPolicy['refundability'] = 'free_cancellation'
    if (nonRefundable) {
      refundPercent = 0
      refundability = 'non_refundable'
    } else if (freeCancellation) {
      refundPercent = 100
      refundability = 'free_cancellation'
    } else if (deadline) {
      refundPercent = num(raw, 'refundPercent', 100)
      refundability = 'deadline_based'
    } else {
      refundPercent = num(raw, 'refundPercent', 50)
      refundability = 'partially_refundable'
    }

    return basePolicy({
      serviceKind: 'hotel',
      providerId: str(raw, 'providerId', this.providerId) ?? this.providerId,
      sourcePolicyId: str(raw, 'ratePlanId', 'hotel-policy') ?? 'hotel-policy',
      currency: str(raw, 'currency', currency) ?? currency,
      refundability,
      refundable: !nonRefundable,
      refundPercent,
      penaltyAmount,
      taxesRefundable: num(raw, 'taxesRefundable', 0),
      taxesNonRefundable: num(raw, 'taxesNonRefundable', 0),
      providerFee: num(raw, 'providerFee', 0),
      cancellationDeadline: deadline,
      refundTimelineBusinessDaysMin: num(raw, 'refundDaysMin', 3),
      refundTimelineBusinessDaysMax: num(raw, 'refundDaysMax', 7),
      specialConditions: [
        str(raw, 'summary', '') ?? '',
        ...(payAtHotel ? ['Pay-at-hotel rate'] : []),
        ...(prepaid ? ['Prepaid booking'] : []),
      ].filter(Boolean),
      providerNotes: Array.isArray(raw.notes) ? (raw.notes as string[]) : [],
      attributes: {
        freeCancellation,
        firstNightPenalty,
        payAtHotel,
        prepaid,
        earlyDeparturePenalty: bool(raw, 'earlyDeparturePenalty', true),
        lateCancellationPenalty: bool(raw, 'lateCancellationPenalty', true),
        noShowPenalty: bool(raw, 'noShowPenalty', true),
      },
    })
  }
}
