/**
 * Decorate a ProviderAdapter with Phase W rate limiting + circuit breaker gates.
 */

import type { AggregationQuery, ProviderAdapter, ProviderFetchResult } from '../types'
import type { CircuitBreaker } from './circuitBreaker'
import type { ProviderRateLimiter } from './rateLimiter'
import type { ProviderMetrics } from './metrics'
import type { ProviderSelectionLog } from './selectionLog'
import {
  isLiveProviderFlagEnabled,
  liveFlagKeyForProviderId,
  type ProviderFeatureFlags,
} from './featureFlags'

export interface WrapLiveAdapterOptions {
  flags: ProviderFeatureFlags
  circuitBreaker: CircuitBreaker
  rateLimiter: ProviderRateLimiter
  metrics: ProviderMetrics
  selectionLog: ProviderSelectionLog
}

export function wrapAdapterForLiveIntegration(
  adapter: ProviderAdapter,
  options: WrapLiveAdapterOptions,
): ProviderAdapter {
  const providerId = String(adapter.metadata.id)
  const flagKey = liveFlagKeyForProviderId(providerId)

  const isAvailable = (): boolean => {
    if (!adapter.isAvailable()) return false
    if (flagKey && !adapter.metadata.mocked) {
      return isLiveProviderFlagEnabled(options.flags, flagKey)
    }
    if (
      adapter.metadata.mocked
      && !options.flags.mockFallbackEnabled
      && ['amadeus_mock', 'booking_com_mock', 'google_maps_mock', 'openweather_mock'].includes(providerId)
    ) {
      return false
    }
    return true
  }

  return {
    ...adapter,
    isAvailable,
    getCapabilities() {
      const caps = adapter.getCapabilities()
      return {
        ...caps,
        features: [
          ...caps.features,
          'phase_w_live_integration',
          ...(flagKey && isLiveProviderFlagEnabled(options.flags, flagKey)
            ? ['live_flag_on']
            : ['live_flag_off']),
        ],
      }
    },
    async fetch(query: AggregationQuery): Promise<ProviderFetchResult> {
      if (!isAvailable()) {
        options.selectionLog.append({
          level: 'info',
          domain: query.domain,
          event: 'provider.skipped_unavailable',
          message: `Provider ${providerId} skipped (flag/config)`,
          providerId,
          strategy: query.selectionStrategy ?? null,
          metadata: {},
        })
        return {
          providerId,
          status: 'skipped',
          items: [],
          error: 'Provider unavailable (feature flag or configuration)',
          errorCode: 'not_configured',
          durationMs: 0,
        }
      }

      if (!options.circuitBreaker.allow(providerId)) {
        options.metrics.recordRequest(providerId, { status: 'error' })
        options.selectionLog.append({
          level: 'warn',
          domain: query.domain,
          event: 'provider.circuit_open',
          message: `Circuit open for ${providerId}`,
          providerId,
          strategy: query.selectionStrategy ?? null,
          metadata: { circuit: options.circuitBreaker.snapshot(providerId) },
        })
        return {
          providerId,
          status: 'error',
          items: [],
          error: 'circuit_open',
          errorCode: 'unavailable',
          durationMs: 0,
        }
      }

      const declaredLimit = adapter.getCapabilities().rateLimitPerMinute
      const decision = options.rateLimiter.allow(providerId, declaredLimit)
      if (!decision.allowed) {
        options.metrics.recordRequest(providerId, {
          status: 'rate_limited',
          durationMs: 0,
        })
        options.selectionLog.append({
          level: 'warn',
          domain: query.domain,
          event: 'provider.rate_limited',
          message: `Rate limited ${providerId}`,
          providerId,
          strategy: query.selectionStrategy ?? null,
          metadata: { retryAfterMs: decision.retryAfterMs },
        })
        return {
          providerId,
          status: 'rate_limited',
          items: [],
          error: 'rate_limited',
          errorCode: 'rate_limited',
          durationMs: 0,
          retryAfterMs: decision.retryAfterMs,
        }
      }

      options.selectionLog.append({
        level: 'info',
        domain: query.domain,
        event: 'provider.selected',
        message: `Selected ${providerId} for ${query.domain}`,
        providerId,
        strategy: query.selectionStrategy ?? null,
        metadata: {
          mocked: adapter.metadata.mocked,
          priority: adapter.metadata.priority,
        },
      })

      const result = await adapter.fetch(query)
      const metricStatus =
        result.status === 'ok' || result.status === 'skipped' || result.status === 'timeout' || result.status === 'rate_limited'
          ? result.status
          : 'error'
      options.metrics.recordRequest(providerId, {
        status: metricStatus,
        durationMs: result.durationMs,
        retries: Math.max(0, (result.attempt ?? 1) - 1),
      })

      if (result.status === 'ok') {
        options.circuitBreaker.recordSuccess(providerId)
      } else if (result.status !== 'skipped') {
        options.circuitBreaker.recordFailure(providerId)
        options.selectionLog.append({
          level: 'warn',
          domain: query.domain,
          event: 'provider.failed',
          message: result.error || `${providerId} failed`,
          providerId,
          strategy: query.selectionStrategy ?? null,
          metadata: { status: result.status, errorCode: result.errorCode },
        })
      }

      return result
    },
  }
}
