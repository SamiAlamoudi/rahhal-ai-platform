/**
 * Sprint 26 — provider monitoring (latency, availability, errors, quality).
 */

import type { ProviderHealthStatus } from './config'

export interface ProviderMonitorSample {
  providerId: string
  domain: string
  ok: boolean
  latencyMs: number
  offerCount: number
  at: string
  error?: string | null
}

export interface ProviderMonitorSnapshot {
  providerId: string
  domain: string
  samples: number
  successCount: number
  errorCount: number
  errorRate: number
  availability: number
  avgLatencyMs: number
  p95LatencyMs: number
  avgOfferCount: number
  responseQuality: number
  health: ProviderHealthStatus
  lastError: string | null
  lastAt: string | null
}

const MAX_SAMPLES = 50
const samplesByProvider = new Map<string, ProviderMonitorSample[]>()

function keyOf(providerId: string, domain: string): string {
  return `${providerId}::${domain}`
}

export function recordProviderSample(sample: ProviderMonitorSample): void {
  const key = keyOf(sample.providerId, sample.domain)
  const list = samplesByProvider.get(key) ?? []
  list.push(sample)
  while (list.length > MAX_SAMPLES) list.shift()
  samplesByProvider.set(key, list)
}

export function getProviderMonitorSnapshot(
  providerId: string,
  domain: string,
): ProviderMonitorSnapshot {
  const list = samplesByProvider.get(keyOf(providerId, domain)) ?? []
  if (list.length === 0) {
    return {
      providerId,
      domain,
      samples: 0,
      successCount: 0,
      errorCount: 0,
      errorRate: 0,
      availability: 1,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      avgOfferCount: 0,
      responseQuality: 0.5,
      health: 'unknown',
      lastError: null,
      lastAt: null,
    }
  }

  const successCount = list.filter((s) => s.ok).length
  const errorCount = list.length - successCount
  const latencies = list.map((s) => s.latencyMs).sort((a, b) => a - b)
  const avgLatencyMs =
    latencies.reduce((a, b) => a + b, 0) / Math.max(1, latencies.length)
  const p95LatencyMs = latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] ?? 0
  const avgOfferCount =
    list.reduce((a, s) => a + s.offerCount, 0) / Math.max(1, list.length)
  const errorRate = errorCount / list.length
  const availability = successCount / list.length
  const responseQuality = clamp01(
    availability * 0.5 +
      clamp01(1 - avgLatencyMs / 3000) * 0.25 +
      clamp01(avgOfferCount / 3) * 0.25,
  )

  let health: ProviderHealthStatus = 'healthy'
  if (availability < 0.4 || errorRate > 0.6) health = 'unavailable'
  else if (availability < 0.85 || avgLatencyMs > 1500) health = 'degraded'

  const last = list[list.length - 1]

  return {
    providerId,
    domain,
    samples: list.length,
    successCount,
    errorCount,
    errorRate: round4(errorRate),
    availability: round4(availability),
    avgLatencyMs: Math.round(avgLatencyMs),
    p95LatencyMs: Math.round(p95LatencyMs),
    avgOfferCount: round4(avgOfferCount),
    responseQuality: round4(responseQuality),
    health,
    lastError: last?.ok ? null : (last?.error ?? null),
    lastAt: last?.at ?? null,
  }
}

export function listProviderMonitorSnapshots(): ProviderMonitorSnapshot[] {
  const out: ProviderMonitorSnapshot[] = []
  for (const key of samplesByProvider.keys()) {
    const [providerId, domain] = key.split('::')
    out.push(getProviderMonitorSnapshot(providerId!, domain!))
  }
  return out
}

export function resetProviderMonitoring(): void {
  samplesByProvider.clear()
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
