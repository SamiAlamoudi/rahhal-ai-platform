import { basePolicy, bool, num, str } from './base'
import type { NormalizedRefundPolicy, ProviderPolicyAdapter } from '../types'

/** Normalizes airline / GDS fare cancellation rules. */
export class FlightPolicyAdapter implements ProviderPolicyAdapter {
  readonly serviceKind = 'flight' as const
  readonly providerId: string

  constructor(providerId = 'flight_generic') {
    this.providerId = providerId
  }

  normalize(raw: Record<string, unknown>, currency: string): NormalizedRefundPolicy {
    const refundable = bool(raw, 'refundable', bool(raw, 'fullyRefundable', false))
    const partially = bool(raw, 'partiallyRefundable', false)
    const nonRefundable = bool(raw, 'nonRefundable', !refundable && !partially)
    const refundPercent = num(
      raw,
      'refundPercent',
      refundable ? 100 : partially ? num(raw, 'partialRefundPercent', 70) : 0,
    )
    const penalty = num(raw, 'airlinePenalty', num(raw, 'penaltyAmount', 0))
    const taxesRefundable = num(raw, 'airportTaxesRefundable', num(raw, 'taxesRefundable', 0))
    const taxesNonRefundable = num(raw, 'taxesNonRefundable', 0)
    const serviceFee = num(raw, 'serviceFee', num(raw, 'providerFee', 0))

    let refundability: NormalizedRefundPolicy['refundability'] = 'non_refundable'
    if (refundable && refundPercent >= 100) refundability = 'fully_refundable'
    else if (partially || (refundPercent > 0 && refundPercent < 100)) {
      refundability = 'partially_refundable'
    }

    return basePolicy({
      serviceKind: 'flight',
      providerId: str(raw, 'providerId', this.providerId) ?? this.providerId,
      sourcePolicyId: str(raw, 'fareRuleId', 'flight-policy') ?? 'flight-policy',
      currency,
      refundability,
      refundable: !nonRefundable && refundPercent > 0,
      refundPercent,
      penaltyAmount: penalty,
      taxesRefundable,
      taxesNonRefundable,
      providerFee: serviceFee,
      cancellationDeadline: str(raw, 'cancellationDeadline'),
      refundTimelineBusinessDaysMin: num(raw, 'refundDaysMin', 5),
      refundTimelineBusinessDaysMax: num(raw, 'refundDaysMax', 10),
      specialConditions: [
        ...(Array.isArray(raw.fareRules) ? (raw.fareRules as string[]) : []),
        ...(bool(raw, 'sameDayCancellation', false) ? ['Same-day cancellation rules apply'] : []),
      ],
      providerNotes: Array.isArray(raw.notes) ? (raw.notes as string[]) : [],
      attributes: {
        noShowPenalty: bool(raw, 'noShowPenalty', true),
        changeFeeApplicable: bool(raw, 'changeFeeApplicable', true),
        sameDayCancellation: bool(raw, 'sameDayCancellation', false),
        airlineInitiatedFullRefund: bool(raw, 'airlineInitiatedFullRefund', true),
      },
    })
  }
}
