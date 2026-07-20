/**
 * Sprint 36 — PolicyNormalizer
 * Routes raw provider policies through service adapters into NormalizedRefundPolicy.
 */

import type { ProviderPolicyAdapter } from './types'
import type { BookedServiceLine, NormalizedRefundPolicy, PolicyServiceKind } from './types'
import {
  createDefaultPolicyAdapters,
  selectAdapter,
} from './ProviderPolicyAdapters'

export class PolicyNormalizer {
  private readonly adapters: ProviderPolicyAdapter[]

  constructor(adapters?: ProviderPolicyAdapter[]) {
    this.adapters = adapters ?? createDefaultPolicyAdapters()
  }

  normalizeLine(line: BookedServiceLine): NormalizedRefundPolicy {
    const adapter = selectAdapter(this.adapters, line.serviceKind, line.providerId)
    return adapter.normalize(line.rawPolicy, line.currency)
  }

  normalizeAll(lines: BookedServiceLine[]): NormalizedRefundPolicy[] {
    return lines.map((line) => this.normalizeLine(line))
  }

  listAdapters(): ProviderPolicyAdapter[] {
    return [...this.adapters]
  }

  supportedKinds(): PolicyServiceKind[] {
    return [...new Set(this.adapters.map((a) => a.serviceKind))]
  }
}

export function createPolicyNormalizer(
  adapters?: ProviderPolicyAdapter[],
): PolicyNormalizer {
  return new PolicyNormalizer(adapters)
}
