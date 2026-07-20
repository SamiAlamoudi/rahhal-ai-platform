import { basePolicy, bool, num, str } from './base'
import type { NormalizedRefundPolicy, ProviderPolicyAdapter } from '../types'

export class CarRentalPolicyAdapter implements ProviderPolicyAdapter {
  readonly serviceKind = 'car_rental' as const
  readonly providerId: string

  constructor(providerId = 'car_generic') {
    this.providerId = providerId
  }

  normalize(raw: Record<string, unknown>, currency: string): NormalizedRefundPolicy {
    const freeCancellation = bool(raw, 'freeCancellation', true)
    const pickupDeadlineHours = num(raw, 'pickupDeadlineHours', 24)
    const refundPercent = freeCancellation
      ? 100
      : num(raw, 'refundPercent', 80)

    return basePolicy({
      serviceKind: 'car_rental',
      providerId: str(raw, 'providerId', this.providerId) ?? this.providerId,
      sourcePolicyId: str(raw, 'policyId', 'car-policy') ?? 'car-policy',
      currency,
      refundability: freeCancellation ? 'free_cancellation' : 'partially_refundable',
      refundable: refundPercent > 0,
      refundPercent,
      penaltyAmount: num(raw, 'penaltyAmount', 0),
      providerFee: num(raw, 'providerFee', 0),
      cancellationDeadline: str(raw, 'cancellationDeadline'),
      refundTimelineBusinessDaysMin: num(raw, 'refundDaysMin', 5),
      refundTimelineBusinessDaysMax: num(raw, 'refundDaysMax', 10),
      specialConditions: [
        `Free cancellation until ${pickupDeadlineHours}h before pickup`,
        str(raw, 'fuelPolicy', 'Fuel: same-to-same') ?? 'Fuel: same-to-same',
      ],
      providerNotes: Array.isArray(raw.notes) ? (raw.notes as string[]) : [],
      attributes: {
        freeCancellation,
        pickupDeadlineHours,
        noShowPenalty: bool(raw, 'noShowPenalty', true),
        insuranceRefundable: bool(raw, 'insuranceRefundable', false),
        depositRefundable: bool(raw, 'depositRefundable', true),
        fuelPolicyNote: str(raw, 'fuelPolicy', 'same-to-same'),
        oneWayFeeNonRefundable: bool(raw, 'oneWayFeeNonRefundable', true),
        lateCancellationPenalty: bool(raw, 'lateReturnPenalty', false),
      },
    })
  }
}
