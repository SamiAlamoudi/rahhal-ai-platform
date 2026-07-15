import { averageConfidence, scoreOfferConfidence } from './confidence'
import { dedupeOffers } from './dedupe'
import { mergeCompatibleOffers } from './merge'
import { rankOffers } from './ranking'
import type {
  AggregationEngine,
  AggregationQuery,
  AggregationResult,
  NormalizedOffer,
  ProviderAdapter,
  ProviderFetchResult,
  ProviderRegistry,
} from './types'

export interface CreateAggregationEngineOptions {
  registry: ProviderRegistry
  /** Per-provider timeout in ms */
  providerTimeoutMs?: number
}

export function createAggregationEngine(
  options: CreateAggregationEngineOptions,
): AggregationEngine {
  const providerTimeoutMs = options.providerTimeoutMs ?? 1200

  return {
    async aggregate(query: AggregationQuery): Promise<AggregationResult> {
      const started = Date.now()
      const adapters = options.registry.forDomain(query.domain)
      const metadataByProvider = new Map(
        options.registry.list().map((meta) => [meta.id, meta]),
      )

      if (adapters.length === 0) {
        return {
          domain: query.domain,
          items: [],
          providerResults: [],
          averageConfidence: 0,
          meta: {
            durationMs: Date.now() - started,
            providersQueried: 0,
            providersSucceeded: 0,
            duplicatesRemoved: 0,
          },
        }
      }

      const settled = await Promise.all(
        adapters.map((adapter) => fetchWithTimeout(adapter, query, providerTimeoutMs)),
      )

      const providerResults = settled.map((result) => ({
        providerId: result.providerId,
        status: result.status,
        count: result.items.length,
        error: result.error ?? null,
        durationMs: result.durationMs,
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
          providersQueried: adapters.length,
          providersSucceeded: settled.filter((r) => r.status === 'ok').length,
          duplicatesRemoved: deduped.duplicatesRemoved,
        },
      }
    },
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
    const message = e instanceof Error ? e.message : String(e ?? 'provider_error')
    const isTimeout = message === 'provider_timeout' || message.includes('timeout')
    return {
      providerId: adapter.metadata.id,
      status: isTimeout ? 'timeout' : 'error',
      items: [],
      error: message,
      durationMs: Date.now() - started,
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
