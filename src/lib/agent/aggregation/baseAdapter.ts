import { buildProviderCapabilities } from './capabilities'
import { normalizeProviderError, statusFromErrorCode } from './errors'
import type {
  AggregatableDomain,
  AggregationQuery,
  ProviderAdapter,
  ProviderCapabilities,
  ProviderFetchResult,
  ProviderHealthSnapshot,
  ProviderMetadata,
} from './types'

export interface CreateProviderAdapterOptions {
  metadata: ProviderMetadata
  capabilities?: Partial<ProviderCapabilities>
  isAvailable?: () => boolean
  fetch: (query: AggregationQuery) => Promise<ProviderFetchResult>
}

const UNKNOWN_HEALTH = (providerId: string): ProviderHealthSnapshot => ({
  providerId,
  status: 'unknown',
  consecutiveFailures: 0,
  consecutiveSuccesses: 0,
  totalRequests: 0,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastErrorCode: null,
  rateLimitedUntil: null,
})

/**
 * Build a ProviderAdapter that satisfies the common interface
 * (capabilities, health, availability, domain support, fetch).
 * Health counters are updated by the Provider Registry / Aggregation Engine.
 */
export function createProviderAdapter(options: CreateProviderAdapterOptions): ProviderAdapter {
  const capabilities = buildProviderCapabilities(options.metadata, options.capabilities)
  const providerId = String(options.metadata.id)

  return {
    metadata: options.metadata,
    isAvailable: options.isAvailable ?? (() => !options.metadata.futureSlot),
    supports(domain: AggregatableDomain) {
      return options.metadata.domains.includes(domain)
    },
    getCapabilities() {
      return capabilities
    },
    getHealth() {
      return UNKNOWN_HEALTH(providerId)
    },
    async fetch(query) {
      const started = Date.now()
      try {
        if (!options.metadata.domains.includes(query.domain)) {
          return {
            providerId,
            status: 'skipped',
            items: [],
            error: 'unsupported_domain',
            errorCode: 'unsupported_domain',
            durationMs: Date.now() - started,
          }
        }
        if (!(options.isAvailable ?? (() => !options.metadata.futureSlot))()) {
          return {
            providerId,
            status: 'skipped',
            items: [],
            error: 'not_configured',
            errorCode: 'not_configured',
            durationMs: Date.now() - started,
          }
        }
        const result = await options.fetch(query)
        return {
          ...result,
          providerId: result.providerId || providerId,
          durationMs: result.durationMs || Date.now() - started,
          errorCode: result.errorCode
            ?? (result.status === 'ok' ? null : normalizeProviderError(result.error).code),
        }
      } catch (error) {
        const normalized = normalizeProviderError(error)
        return {
          providerId,
          status: statusFromErrorCode(normalized.code),
          items: [],
          error: normalized.message,
          errorCode: normalized.code,
          durationMs: Date.now() - started,
          retryAfterMs: normalized.retryAfterMs,
        }
      }
    },
  }
}
