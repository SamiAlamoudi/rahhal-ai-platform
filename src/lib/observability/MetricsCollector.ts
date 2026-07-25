/**
 * Sprint 15 — MetricsCollector (central latency / rates / feature usage).
 */

import { isObservabilityPlatformEnabled } from './feature'
import type { LatencyStats, MetricSample, MetricsSnapshot } from './types'

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx] ?? 0
}

export class MetricsCollector {
  private readonly enabledOverride: boolean | undefined
  private readonly samples: MetricSample[] = []
  private readonly latencies: number[] = []
  private requestTimestamps: number[] = []
  private providerFailures = 0
  private providerTimeouts = 0
  private conversationStarted = 0
  private conversationCompleted = 0
  private cacheHits = 0
  private cacheMisses = 0
  private featureFlagUsage: Record<string, number> = {}
  private static readonly MAX_SAMPLES = 2000
  private static readonly MAX_LATENCIES = 2000

  constructor(options?: { enabled?: boolean }) {
    this.enabledOverride = options?.enabled
  }

  isEnabled(): boolean {
    return isObservabilityPlatformEnabled({ enabled: this.enabledOverride })
  }

  private pushSample(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.isEnabled()) return
    this.samples.push({ name, value, at: new Date().toISOString(), tags })
    if (this.samples.length > MetricsCollector.MAX_SAMPLES) {
      this.samples.splice(0, this.samples.length - MetricsCollector.MAX_SAMPLES)
    }
  }

  recordRequest(latencyMs: number): void {
    if (!this.isEnabled()) return
    const now = Date.now()
    this.requestTimestamps.push(now)
    // keep ~60s window for rps
    const cutoff = now - 60_000
    this.requestTimestamps = this.requestTimestamps.filter((t) => t >= cutoff)
    this.latencies.push(latencyMs)
    if (this.latencies.length > MetricsCollector.MAX_LATENCIES) {
      this.latencies.splice(0, this.latencies.length - MetricsCollector.MAX_LATENCIES)
    }
    this.pushSample('request.latency_ms', latencyMs)
  }

  recordProviderFailure(provider?: string): void {
    if (!this.isEnabled()) return
    this.providerFailures += 1
    this.pushSample('provider.failure', 1, provider ? { provider } : undefined)
  }

  recordProviderTimeout(provider?: string): void {
    if (!this.isEnabled()) return
    this.providerTimeouts += 1
    this.pushSample('provider.timeout', 1, provider ? { provider } : undefined)
  }

  recordConversationStart(): void {
    if (!this.isEnabled()) return
    this.conversationStarted += 1
    this.pushSample('conversation.started', 1)
  }

  recordConversationComplete(): void {
    if (!this.isEnabled()) return
    this.conversationCompleted += 1
    this.pushSample('conversation.completed', 1)
  }

  recordCacheHit(): void {
    if (!this.isEnabled()) return
    this.cacheHits += 1
    this.pushSample('cache.hit', 1)
  }

  recordCacheMiss(): void {
    if (!this.isEnabled()) return
    this.cacheMisses += 1
    this.pushSample('cache.miss', 1)
  }

  recordFeatureFlagUsage(flagId: string): void {
    if (!this.isEnabled()) return
    this.featureFlagUsage[flagId] = (this.featureFlagUsage[flagId] ?? 0) + 1
    this.pushSample('feature_flag.usage', 1, { flag: flagId })
  }

  latencyStats(): LatencyStats {
    const sorted = [...this.latencies].sort((a, b) => a - b)
    const count = sorted.length
    const sum = sorted.reduce((a, b) => a + b, 0)
    return {
      count,
      averageMs: count ? sum / count : 0,
      p95Ms: percentile(sorted, 95),
      p99Ms: percentile(sorted, 99),
      minMs: count ? sorted[0]! : 0,
      maxMs: count ? sorted[count - 1]! : 0,
    }
  }

  snapshot(): MetricsSnapshot {
    const lat = this.latencyStats()
    const cacheTotal = this.cacheHits + this.cacheMisses
    const convStarted = this.conversationStarted
    const windowSec = 60
    return {
      requestsPerSec: this.requestTimestamps.length / windowSec,
      averageLatencyMs: lat.averageMs,
      p95LatencyMs: lat.p95Ms,
      p99LatencyMs: lat.p99Ms,
      providerFailureCount: this.providerFailures,
      providerTimeoutCount: this.providerTimeouts,
      conversationStarted: convStarted,
      conversationCompleted: this.conversationCompleted,
      conversationCompletionRate: convStarted ? this.conversationCompleted / convStarted : 0,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRatio: cacheTotal ? this.cacheHits / cacheTotal : 0,
      featureFlagUsage: { ...this.featureFlagUsage },
      requestCount: lat.count,
    }
  }

  listSamples(): MetricSample[] {
    return [...this.samples]
  }

  reset(): void {
    this.samples.length = 0
    this.latencies.length = 0
    this.requestTimestamps = []
    this.providerFailures = 0
    this.providerTimeouts = 0
    this.conversationStarted = 0
    this.conversationCompleted = 0
    this.cacheHits = 0
    this.cacheMisses = 0
    this.featureFlagUsage = {}
  }
}

let shared: MetricsCollector | null = null

export function getMetricsCollector(options?: { enabled?: boolean }): MetricsCollector {
  if (options) return new MetricsCollector(options)
  if (!shared) shared = new MetricsCollector()
  return shared
}

export function resetMetricsCollectorForTests(): void {
  shared?.reset()
  shared = null
}

export function createMetricsCollector(options?: { enabled?: boolean }): MetricsCollector {
  return new MetricsCollector(options)
}
