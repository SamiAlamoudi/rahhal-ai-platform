/**
 * Provider Health Monitor — Sprint 56
 *
 * Tracks latency, uptime, quota, failures, and response quality.
 * Automatically disables unhealthy providers.
 */

import type { LiveProviderHealth, LiveProviderId } from './types'

export type HealthMonitorOptions = {
  windowSize?: number
  failureThreshold?: number
  latencyThresholdMs?: number
  minQualityScore?: number
  minQuotaRatio?: number
  now?: () => number
}

type Sample = {
  ok: boolean
  latencyMs: number
  quality: number
  at: number
  error?: string | null
}

const DEFAULTS = {
  windowSize: 40,
  failureThreshold: 0.45,
  latencyThresholdMs: 8_000,
  minQualityScore: 0.35,
  minQuotaRatio: 0.05,
  now: () => Date.now(),
}

export class ProviderHealthMonitor {
  private readonly options: typeof DEFAULTS
  private readonly samples = new Map<LiveProviderId, Sample[]>()
  private readonly disabled = new Map<LiveProviderId, { reason: string; until?: number }>()
  private readonly quota = new Map<LiveProviderId, { remaining: number; limit: number }>()

  constructor(options: HealthMonitorOptions = {}) {
    this.options = {
      ...DEFAULTS,
      ...options,
      now: options.now ?? DEFAULTS.now,
    }
  }

  recordSuccess(providerId: LiveProviderId, latencyMs: number, quality = 0.8): void {
    this.push(providerId, {
      ok: true,
      latencyMs,
      quality,
      at: this.options.now(),
      error: null,
    })
  }

  recordFailure(
    providerId: LiveProviderId,
    latencyMs: number,
    error?: string | null,
    quality = 0,
  ): void {
    this.push(providerId, {
      ok: false,
      latencyMs,
      quality,
      at: this.options.now(),
      error: error ?? 'provider_failure',
    })
    this.recomputeDisable(providerId)
  }

  setQuota(providerId: LiveProviderId, remaining: number, limit: number): void {
    this.quota.set(providerId, { remaining, limit })
    this.recomputeDisable(providerId)
  }

  disable(providerId: LiveProviderId, reason: string, untilMs?: number): void {
    this.disabled.set(providerId, {
      reason,
      until: untilMs != null ? this.options.now() + untilMs : undefined,
    })
  }

  enable(providerId: LiveProviderId): void {
    this.disabled.delete(providerId)
  }

  isAvailable(providerId: LiveProviderId): boolean {
    const d = this.disabled.get(providerId)
    if (!d) return true
    if (d.until != null && this.options.now() >= d.until) {
      this.disabled.delete(providerId)
      return true
    }
    return false
  }

  snapshot(providerId: LiveProviderId): LiveProviderHealth {
    const samples = this.samples.get(providerId) ?? []
    const total = samples.length
    const failures = samples.filter((s) => !s.ok).length
    const successes = total - failures
    const avgLatency =
      total === 0 ? 0 : samples.reduce((sum, s) => sum + s.latencyMs, 0) / total
    const quality =
      total === 0 ? 1 : samples.reduce((sum, s) => sum + s.quality, 0) / total
    const q = this.quota.get(providerId)
    const available = this.isAvailable(providerId)
    const disabled = this.disabled.get(providerId)
    const lastError = [...samples].reverse().find((s) => s.error)?.error ?? null
    // Approximate uptime ratio from success rate when samples exist.
    const uptimeRatio = total === 0 ? (available ? 1 : 0) : successes / total

    return {
      providerId,
      healthy: available && (total < 5 || failures / total < this.options.failureThreshold),
      disabled: !available,
      latencyMsAvg: Math.round(avgLatency),
      uptimeRatio,
      failureCount: failures,
      successCount: successes,
      quotaRemaining: q?.remaining ?? null,
      qualityScore: quality,
      lastError: available ? lastError : (disabled?.reason ?? lastError),
      updatedAt: new Date(this.options.now()).toISOString(),
    }
  }

  snapshots(ids: LiveProviderId[]): LiveProviderHealth[] {
    return ids.map((id) => this.snapshot(id))
  }

  private push(providerId: LiveProviderId, sample: Sample): void {
    const list = this.samples.get(providerId) ?? []
    list.push(sample)
    while (list.length > this.options.windowSize) list.shift()
    this.samples.set(providerId, list)
    this.recomputeDisable(providerId)
  }

  private recomputeDisable(providerId: LiveProviderId): void {
    const samples = this.samples.get(providerId) ?? []
    if (samples.length < 5) return
    const health = this.snapshot(providerId)

    if (health.failureCount / samples.length >= this.options.failureThreshold) {
      this.disable(providerId, 'high_failure_rate', 60_000)
      return
    }
    if (health.latencyMsAvg >= this.options.latencyThresholdMs) {
      this.disable(providerId, 'high_latency', 30_000)
      return
    }
    if (health.qualityScore < this.options.minQualityScore) {
      this.disable(providerId, 'low_quality', 45_000)
      return
    }
    const q = this.quota.get(providerId)
    if (q && q.limit > 0 && q.remaining / q.limit < this.options.minQuotaRatio) {
      this.disable(providerId, 'quota_exhausted', 120_000)
    }
  }
}
