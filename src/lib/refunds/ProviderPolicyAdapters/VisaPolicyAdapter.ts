import { basePolicy, str } from './base'
import type { NormalizedRefundPolicy, ProviderPolicyAdapter } from '../types'

/** Future-ready visa cancellation framework (informational quotes only). */
export class VisaPolicyAdapter implements ProviderPolicyAdapter {
  readonly serviceKind = 'visa' as const
  readonly providerId: string

  constructor(providerId = 'visa_framework') {
    this.providerId = providerId
  }

  normalize(raw: Record<string, unknown>, currency: string): NormalizedRefundPolicy {
    return basePolicy({
      serviceKind: 'visa',
      providerId: str(raw, 'providerId', this.providerId) ?? this.providerId,
      sourcePolicyId: str(raw, 'policyId', 'visa-framework') ?? 'visa-framework',
      currency,
      refundability: 'framework_only',
      refundable: false,
      refundPercent: 0,
      refundTimelineBusinessDaysMin: 10,
      refundTimelineBusinessDaysMax: 20,
      specialConditions: [
        'Visa refund framework only — final rules depend on consulate/provider',
      ],
      providerNotes: Array.isArray(raw.notes) ? (raw.notes as string[]) : [],
      attributes: { frameworkOnly: true },
    })
  }
}
