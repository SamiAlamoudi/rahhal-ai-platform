/**
 * Priority-chain executor with automatic failover.
 *
 * On timeout / authentication / quota / unavailable / empty / error:
 * → automatically try the next provider in the configured order.
 */

import type {
  ChainSearchResult,
  MultiProviderAdapter,
  ProviderAttemptRecord,
  TravelDomain,
} from './types'
import { shouldFailover } from './classifyError'
import { getMultiProviderRegistry } from './registry'
import { getProviderHealthMonitor } from './healthMonitor'

export interface ExecuteChainOptions {
  domain: TravelDomain
  req: unknown
  /** Optional override chain (tests). */
  adapters?: MultiProviderAdapter[]
}

export async function executeProviderChain<T>(
  options: ExecuteChainOptions,
): Promise<ChainSearchResult<T>> {
  const registry = getMultiProviderRegistry()
  const monitor = getProviderHealthMonitor()
  const adapters = options.adapters ?? registry.getChain(options.domain)
  const attempts: ProviderAttemptRecord[] = []
  let fallbackCount = 0
  /** Failures from providers that were actually attempted (configured). */
  let hardFailoverCount = 0
  const started = Date.now()

  for (let i = 0; i < adapters.length; i++) {
    const adapter = adapters[i]
    const at = new Date().toISOString()
    const hasNext = i < adapters.length - 1

    if (!adapter.mocked && !adapter.isConfigured() && adapter.prepared) {
      const attempt: ProviderAttemptRecord = {
        providerId: adapter.id,
        domain: options.domain,
        success: false,
        latencyMs: 0,
        reason: 'not_configured',
        errorCode: 'PROVIDER_NOT_CONFIGURED',
        at,
      }
      attempts.push(attempt)
      monitor.recordAttempt(attempt)
      fallbackCount += 1
      if (hasNext) continue
      break
    }

    try {
      const result = await adapter.search(options.domain, options.req)
      const hasData = result.success
        && result.data != null
        && (!Array.isArray(result.data) || result.data.length > 0)

      if (hasData) {
        const attempt: ProviderAttemptRecord = {
          providerId: adapter.id,
          domain: options.domain,
          success: true,
          latencyMs: result.latencyMs,
          reason: null,
          errorCode: null,
          at,
        }
        attempts.push(attempt)
        monitor.recordAttempt(attempt, result.quotaStatus)

        // "fallback" only when a configured live provider failed before mock/next success.
        const source: ChainSearchResult<T>['source'] = adapter.mocked
          ? (hardFailoverCount > 0 ? 'fallback' : 'mock')
          : 'real'

        return {
          success: true,
          data: result.data as T,
          providerId: adapter.id,
          providerName: adapter.displayName,
          source,
          latencyMs: Date.now() - started,
          attempts,
          fallbackCount,
          error: null,
        }
      }

      const reason = result.reason ?? (result.success ? 'empty' : 'error')
      const attempt: ProviderAttemptRecord = {
        providerId: adapter.id,
        domain: options.domain,
        success: false,
        latencyMs: result.latencyMs,
        reason,
        errorCode: result.errorCode ?? reason,
        at,
      }
      attempts.push(attempt)
      monitor.recordAttempt(attempt, result.quotaStatus)
      fallbackCount += 1
      if (reason !== 'not_configured') hardFailoverCount += 1
      if (shouldFailover(reason) && hasNext) continue
      break
    } catch {
      const attempt: ProviderAttemptRecord = {
        providerId: adapter.id,
        domain: options.domain,
        success: false,
        latencyMs: 0,
        reason: 'error',
        errorCode: 'EXCEPTION',
        at,
      }
      attempts.push(attempt)
      monitor.recordAttempt(attempt)
      fallbackCount += 1
      hardFailoverCount += 1
      if (hasNext) continue
      break
    }
  }

  monitor.recordDomainFallback(options.domain)
  const last = attempts[attempts.length - 1]
  return {
    success: false,
    data: null,
    providerId: last?.providerId ?? 'mock',
    providerName: 'none',
    source: 'fallback',
    latencyMs: Date.now() - started,
    attempts,
    fallbackCount,
    error: last?.errorCode ?? 'ALL_PROVIDERS_FAILED',
  }
}
