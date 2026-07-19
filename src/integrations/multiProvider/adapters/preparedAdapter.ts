/**
 * Prepared (stub) adapters for suppliers that are wired into the registry
 * but not yet live-credentialed. They fail closed with `not_configured` /
 * `unavailable` so the chain automatically advances.
 */

import type {
  FailoverReason,
  MultiProviderAdapter,
  MultiProviderId,
  TravelDomain,
} from '../types'

export function createPreparedAdapter(options: {
  id: MultiProviderId
  displayName: string
  domains: TravelDomain[]
  reason?: FailoverReason
  errorMessage?: string
}): MultiProviderAdapter {
  const reason = options.reason ?? 'not_configured'
  return {
    id: options.id,
    displayName: options.displayName,
    domains: options.domains,
    mocked: false,
    prepared: true,

    isConfigured(): boolean {
      return false
    },

    async search(domain: TravelDomain) {
      const start = Date.now()
      if (!options.domains.includes(domain)) {
        return {
          success: false,
          data: null,
          latencyMs: Date.now() - start,
          reason: 'unavailable' as const,
          errorCode: 'DOMAIN_UNSUPPORTED',
          errorMessage: `${options.displayName} does not support ${domain}`,
        }
      }
      return {
        success: false,
        data: null,
        latencyMs: Date.now() - start,
        reason,
        errorCode: 'PROVIDER_NOT_CONFIGURED',
        errorMessage: options.errorMessage
          ?? `${options.displayName} credentials are not configured — prepared for production wiring`,
        quotaStatus: 'unknown' as const,
      }
    },
  }
}
