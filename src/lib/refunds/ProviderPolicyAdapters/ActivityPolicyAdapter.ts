import { basePolicy, bool, num, str } from './base'
import type { NormalizedRefundPolicy, ProviderPolicyAdapter } from '../types'

export class ActivityPolicyAdapter implements ProviderPolicyAdapter {
  readonly serviceKind = 'activity' as const
  readonly providerId: string

  constructor(providerId = 'activity_generic') {
    this.providerId = providerId
  }

  normalize(raw: Record<string, unknown>, currency: string): NormalizedRefundPolicy {
    const refundPercent = num(raw, 'refundPercent', num(raw, 'percentageRefund', 80))
    const weatherFull = bool(raw, 'weatherCancellationFullRefund', true)

    return basePolicy({
      serviceKind: 'activity',
      providerId: str(raw, 'providerId', this.providerId) ?? this.providerId,
      sourcePolicyId: str(raw, 'policyId', 'activity-policy') ?? 'activity-policy',
      currency,
      refundability:
        refundPercent >= 100
          ? 'fully_refundable'
          : refundPercent > 0
            ? 'partially_refundable'
            : 'non_refundable',
      refundable: refundPercent > 0,
      refundPercent,
      penaltyAmount: num(raw, 'penaltyAmount', 0),
      cancellationDeadline: str(raw, 'cancellationDeadline'),
      refundTimelineBusinessDaysMin: num(raw, 'refundDaysMin', 3),
      refundTimelineBusinessDaysMax: num(raw, 'refundDaysMax', 7),
      specialConditions: [
        `Time window: ${str(raw, 'timeWindowHours', '24') ?? '24'}h before start`,
        ...(weatherFull ? ['Weather cancellation: full refund'] : []),
      ],
      providerNotes: Array.isArray(raw.notes) ? (raw.notes as string[]) : [],
      attributes: {
        weatherCancellationFullRefund: weatherFull,
      },
    })
  }
}
