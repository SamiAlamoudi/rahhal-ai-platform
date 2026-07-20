/**
 * Sprint 53 — live intelligence observability.
 */

export interface LiveTelemetrySample {
  domain: string
  providerId: string
  latencyMs: number
  ok: boolean
  cacheHit: boolean
  degraded: boolean
  at: string
}

const samples: LiveTelemetrySample[] = []
const MAX = 500

export function recordLiveSample(sample: LiveTelemetrySample): void {
  samples.push(sample)
  if (samples.length > MAX) samples.shift()
}

export function getLiveTelemetryDashboard(): {
  samples: number
  avgLatencyMs: number
  failureRate: number
  cacheHitRate: number
  degradedRate: number
  byProvider: Array<{ providerId: string; calls: number; failures: number; avgLatencyMs: number }>
} {
  if (samples.length === 0) {
    return {
      samples: 0,
      avgLatencyMs: 0,
      failureRate: 0,
      cacheHitRate: 0,
      degradedRate: 0,
      byProvider: [],
    }
  }
  const avgLatencyMs = samples.reduce((s, row) => s + row.latencyMs, 0) / samples.length
  const failureRate = samples.filter((s) => !s.ok).length / samples.length
  const cacheHitRate = samples.filter((s) => s.cacheHit).length / samples.length
  const degradedRate = samples.filter((s) => s.degraded).length / samples.length

  const map = new Map<string, { calls: number; failures: number; latency: number }>()
  for (const sample of samples) {
    const row = map.get(sample.providerId) ?? { calls: 0, failures: 0, latency: 0 }
    row.calls += 1
    row.latency += sample.latencyMs
    if (!sample.ok) row.failures += 1
    map.set(sample.providerId, row)
  }

  return {
    samples: samples.length,
    avgLatencyMs,
    failureRate,
    cacheHitRate,
    degradedRate,
    byProvider: [...map.entries()].map(([providerId, row]) => ({
      providerId,
      calls: row.calls,
      failures: row.failures,
      avgLatencyMs: row.latency / row.calls,
    })),
  }
}

export function resetLiveTelemetry(): void {
  samples.length = 0
}
