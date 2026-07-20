/**
 * Live Provider Metrics — Sprint 56
 *
 * Measures API latency, provider failures, cache hit ratio,
 * search duration, ranking duration, and booking readiness.
 */

import type { LiveProviderMetricsSnapshot } from './types'

export class LiveProviderMetrics {
  private apiLatencyMs: Record<string, number> = {}
  private providerFailures: Record<string, number> = {}
  private cacheHits = 0
  private cacheMisses = 0
  private searchDurationMs = 0
  private rankingDurationMs = 0
  private bookingReadinessTrue = 0
  private bookingReadinessFalse = 0
  private requests = 0
  private latencyCounts: Record<string, number> = {}

  recordApiCall(providerId: string, latencyMs: number, ok: boolean): void {
    this.requests += 1
    const prev = this.apiLatencyMs[providerId] ?? 0
    const count = this.latencyCounts[providerId] ?? 0
    this.apiLatencyMs[providerId] = (prev * count + latencyMs) / (count + 1)
    this.latencyCounts[providerId] = count + 1
    if (!ok) {
      this.providerFailures[providerId] = (this.providerFailures[providerId] ?? 0) + 1
    }
  }

  recordCache(hit: boolean): void {
    if (hit) this.cacheHits += 1
    else this.cacheMisses += 1
  }

  recordSearchDuration(ms: number): void {
    this.searchDurationMs += ms
  }

  recordRankingDuration(ms: number): void {
    this.rankingDurationMs += ms
  }

  recordBookingReadiness(ready: boolean): void {
    if (ready) this.bookingReadinessTrue += 1
    else this.bookingReadinessFalse += 1
  }

  snapshot(): LiveProviderMetricsSnapshot {
    const cacheTotal = this.cacheHits + this.cacheMisses
    return {
      apiLatencyMs: { ...this.apiLatencyMs },
      providerFailures: { ...this.providerFailures },
      cacheHitRatio: cacheTotal === 0 ? 0 : this.cacheHits / cacheTotal,
      searchDurationMs: this.searchDurationMs,
      rankingDurationMs: this.rankingDurationMs,
      bookingReadinessTrue: this.bookingReadinessTrue,
      bookingReadinessFalse: this.bookingReadinessFalse,
      requests: this.requests,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
    }
  }

  reset(): void {
    this.apiLatencyMs = {}
    this.providerFailures = {}
    this.cacheHits = 0
    this.cacheMisses = 0
    this.searchDurationMs = 0
    this.rankingDurationMs = 0
    this.bookingReadinessTrue = 0
    this.bookingReadinessFalse = 0
    this.requests = 0
    this.latencyCounts = {}
  }
}
