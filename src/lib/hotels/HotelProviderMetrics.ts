/**
 * Sprint 30 — Hotel provider metrics (requests, retries, cache, failover).
 */

import type { HotelProviderId, HotelProviderMetricsSnapshot } from './types'

type MetricField =
  | 'requests'
  | 'successes'
  | 'failures'
  | 'timeouts'
  | 'rateLimited'
  | 'retries'
  | 'cacheHits'
  | 'cacheMisses'
  | 'fallbacks'

export class HotelProviderMetrics {
  private readonly byProvider = new Map<HotelProviderId, HotelProviderMetricsSnapshot>()

  get(providerId: HotelProviderId): HotelProviderMetricsSnapshot {
    return this.byProvider.get(providerId) ?? emptyMetrics(providerId)
  }

  list(): HotelProviderMetricsSnapshot[] {
    return [...this.byProvider.values()].map((m) => ({ ...m }))
  }

  increment(providerId: HotelProviderId, field: MetricField, by = 1): void {
    const current = this.get(providerId)
    const next = { ...current, [field]: current[field] + by }
    this.byProvider.set(providerId, next)
  }

  recordLatency(providerId: HotelProviderId, latencyMs: number): void {
    const current = this.get(providerId)
    const totalLatencyMs = current.totalLatencyMs + Math.max(0, latencyMs)
    const requests = Math.max(1, current.requests)
    this.byProvider.set(providerId, {
      ...current,
      totalLatencyMs,
      avgLatencyMs: Math.round((totalLatencyMs / requests) * 100) / 100,
    })
  }

  reset(providerId?: HotelProviderId): void {
    if (providerId) {
      this.byProvider.delete(providerId)
      return
    }
    this.byProvider.clear()
  }
}

function emptyMetrics(providerId: HotelProviderId): HotelProviderMetricsSnapshot {
  return {
    providerId,
    requests: 0,
    successes: 0,
    failures: 0,
    timeouts: 0,
    rateLimited: 0,
    retries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    fallbacks: 0,
    totalLatencyMs: 0,
    avgLatencyMs: 0,
  }
}

let sharedMetrics: HotelProviderMetrics | null = null

export function getHotelProviderMetrics(): HotelProviderMetrics {
  if (!sharedMetrics) sharedMetrics = new HotelProviderMetrics()
  return sharedMetrics
}

export function resetHotelProviderMetrics(): void {
  sharedMetrics?.reset()
  sharedMetrics = null
}
