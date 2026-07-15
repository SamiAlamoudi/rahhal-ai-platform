import { averageConfidence, scoreOfferConfidence } from './confidence'
import { dedupeOffers } from './dedupe'
import { normalizeProviderError, statusFromErrorCode } from './errors'
import { mergeCompatibleOffers } from './merge'
import { rankOffers } from './ranking'
import { DEFAULT_RETRY_POLICY, withRetry } from './retry'
import { selectNextFallback } from './selection'
import type {
  AggregationEngine,
  AggregationQuery,
  AggregationResult,
  NormalizedOffer,
  ProviderAdapter,
  ProviderFetchResult,
  ProviderRegistry,
  ProviderSelectionStrategy,
  RateLimitPolicy,
  RetryPolicy,
} from './types'

export interface CreateAggregationEngineOptions {
  registry: ProviderRegistry
  /** Per-provider timeout in ms */
  providerTimeoutMs?: number
  selectionStrategy?: ProviderSelectionStrategy
  retryPolicy?: RetryPolicy
  rateLimitPolicy?: RateLimitPolicy
}

const DEFAULT_RATE_LIMIT: RateLimitPolicy = {
  defaultPerMinute: 60,
  coolDownMs: 2_000,
}

export function createAggregationEngine(
  options: CreateAggregationEngineOptions,
): AggregationEngine {
  const providerTimeoutMs = options.providerTimeoutMs ?? 1200
  const selectionStrategy = options.selectionStrategy ?? 'parallel'
  const retryPolicy = options.retryPolicy ?? DEFAULT_RETRY_POLICY
  const rateLimitPolicy = options.rateLimitPolicy ?? DEFAULT_RATE_LIMIT

  return {
    async aggregate(query: AggregationQuery): Promise<AggregationResult> {
      const started = Date.now()
      const adapters = options.registry.select({
        domain: query.domain,
        strategy: selectionStrategy,
        includeFutureSlots: false,
        excludeUnhealthy: true,
      })
      const metadataByProvider = new Map(
        options.registry.list().map((meta) => [String(meta.id), meta]),
      )

      if (adapters.length === 0) {
        return emptyResult(query.domain, started, selectionStrategy)
      }

      let settled: ProviderFetchResult[] = []
      let retries = 0
      let fallbacksUsed = 0

      if (selectionStrategy === 'priority_fallback') {
        const tried = new Set<string>()
        let next = selectNextFallback(adapters, tried)
        while (next) {
          tried.add(String(next.metadata.id))
          const { result, retryCount } = await fetchWithRetry(
            next,
            query,
            providerTimeoutMs,
            retryPolicy,
            rateLimitPolicy,
          )
          retries += retryCount
          options.registry.recordOutcome(result.providerId, result)
          settled.push(result)
          if (result.status === 'ok' && result.items.length > 0) break
          const following = selectNextFallback(adapters, tried)
          if (following) fallbacksUsed += 1
          next = following
        }
      } else {
        settled = await Promise.all(
          adapters.map(async (adapter) => {
            const { result, retryCount } = await fetchWithRetry(
              adapter,
              query,
              providerTimeoutMs,
              retryPolicy,
              rateLimitPolicy,
            )
            retries += retryCount
            options.registry.recordOutcome(result.providerId, result)
            return result
          }),
        )
      }

      const providerResults = settled.map((result) => ({
        providerId: result.providerId,
        status: result.status,
        count: result.items.length,
        error: result.error ?? null,
        errorCode: result.errorCode ?? null,
        durationMs: result.durationMs,
        attempt: result.attempt,
      }))

      const flattened: NormalizedOffer[] = []
      for (const result of settled) {
        if (result.status !== 'ok') continue
        const meta = metadataByProvider.get(result.providerId)
        for (const item of result.items) {
          const confidence = scoreOfferConfidence(item, meta ?? {
            id: result.providerId,
            displayName: result.providerId,
            domains: [query.domain],
            priority: 1,
            reliability: 0.5,
            mocked: true,
          })
          flattened.push({
            ...item,
            confidence,
            rankScore: 0,
          })
        }
      }

      const deduped = dedupeOffers(flattened)
      const ranked = rankOffers(deduped.items, metadataByProvider)
      const merged = mergeCompatibleOffers(query.domain, ranked)

      return {
        domain: query.domain,
        items: merged,
        providerResults,
        averageConfidence: averageConfidence(merged),
        meta: {
          durationMs: Date.now() - started,
          providersQueried: settled.length,
          providersSucceeded: settled.filter((r) => r.status === 'ok').length,
          duplicatesRemoved: deduped.duplicatesRemoved,
          selectionStrategy,
          retries,
          fallbacksUsed,
        },
      }
    },
  }
}

async function fetchWithRetry(
  adapter: ProviderAdapter,
  query: AggregationQuery,
  timeoutMs: number,
  retryPolicy: RetryPolicy,
  rateLimitPolicy: RateLimitPolicy,
): Promise<{ result: ProviderFetchResult; retryCount: number }> {
  try {
    const { value, attempts } = await withRetry({
      policy: retryPolicy,
      signal: query.signal,
      shouldRetry: (error) => normalizeProviderError(error).retryable,
      run: async (attempt) => {
        const result = await fetchWithTimeout(adapter, query, timeoutMs)
        if (result.status === 'ok' || result.status === 'skipped') {
          return { ...result, attempt }
        }
        if (result.status === 'rate_limited') {
          const wait = result.retryAfterMs ?? rateLimitPolicy.coolDownMs
          const err = Object.assign(new Error(result.error || 'rate_limited'), {
            code: 'rate_limited',
            message: result.error || 'rate_limited',
            retryable: true,
            rateLimited: true,
            retryAfterMs: wait,
          })
          throw err
        }
        if (result.status === 'timeout' || result.status === 'error') {
          const normalized = normalizeProviderError(result.error || result.errorCode || 'upstream_error')
          if (!normalized.retryable) {
            return { ...result, attempt }
          }
          throw Object.assign(new Error(normalized.message), normalized)
        }
        return { ...result, attempt }
      },
    })
    return { result: value, retryCount: Math.max(0, attempts - 1) }
  } catch (error) {
    const normalized = normalizeProviderError(error)
    return {
      result: {
        providerId: String(adapter.metadata.id),
        status: statusFromErrorCode(normalized.code),
        items: [],
        error: normalized.message,
        errorCode: normalized.code,
        durationMs: 0,
        attempt: retryPolicy.maxAttempts,
        retryAfterMs: normalized.retryAfterMs,
      },
      retryCount: Math.max(0, retryPolicy.maxAttempts - 1),
    }
  }
}

async function fetchWithTimeout(
  adapter: ProviderAdapter,
  query: AggregationQuery,
  timeoutMs: number,
): Promise<ProviderFetchResult> {
  const started = Date.now()
  try {
    const result = await withTimeout(adapter.fetch(query), timeoutMs, query.signal)
    return {
      ...result,
      durationMs: result.durationMs || Date.now() - started,
    }
  } catch (e) {
    const normalized = normalizeProviderError(e)
    return {
      providerId: String(adapter.metadata.id),
      status: statusFromErrorCode(normalized.code),
      items: [],
      error: normalized.message,
      errorCode: normalized.code,
      durationMs: Date.now() - started,
      retryAfterMs: normalized.retryAfterMs,
    }
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  if (timeoutMs <= 0) return promise
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error('provider_timeout'))
    }, timeoutMs)

    const onAbort = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error('aborted'))
    }

    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    promise.then(
      (value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (err) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        reject(err)
      },
    )
  })
}

function emptyResult(
  domain: AggregationQuery['domain'],
  started: number,
  selectionStrategy: ProviderSelectionStrategy,
): AggregationResult {
  return {
    domain,
    items: [],
    providerResults: [],
    averageConfidence: 0,
    meta: {
      durationMs: Date.now() - started,
      providersQueried: 0,
      providersSucceeded: 0,
      duplicatesRemoved: 0,
      selectionStrategy,
      retries: 0,
      fallbacksUsed: 0,
    },
  }
}
