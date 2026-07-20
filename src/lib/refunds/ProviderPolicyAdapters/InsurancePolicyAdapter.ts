import { basePolicy, str } from './base'
import type { NormalizedRefundPolicy, ProviderPolicyAdapter } from '../types'

/** Future-ready travel insurance cancellation framework. */
export class InsurancePolicyAdapter implements ProviderPolicyAdapter {
  readonly serviceKind = 'insurance' as const
  readonly providerId: string

  constructor(providerId = 'insurance_framework') {
    this.providerId = providerId
  }

  normalize(raw: Record<string, unknown>, currency: string): NormalizedRefundPolicy {
    return basePolicy({
      serviceKind: 'insurance',
      providerId: str(raw, 'providerId', this.providerId) ?? this.providerId,
      sourcePolicyId: str(raw, 'policyId', 'insurance-framework') ?? 'insurance-framework',
      currency,
      refundability: 'framework_only',
      refundable: false,
      refundPercent: 0,
      refundTimelineBusinessDaysMin: 7,
      refundTimelineBusinessDaysMax: 14,
      specialConditions: [
        'Insurance refund framework only — cooling-off and claim rules vary by product',
      ],
      providerNotes: Array.isArray(raw.notes) ? (raw.notes as string[]) : [],
      attributes: { frameworkOnly: true },
    })
  }
}
