/**
 * Sprint 69 — Live provider monitoring (composes ops metrics + beta matrix).
 */

import {
  buildBetaProviderMatrix,
  getBetaEnvironmentProfile,
  resolveBetaEnvironment,
} from '../beta'
import { getOpsMetrics } from '../observability/metricsRegistry'
import type { OpsEnvironment, ProviderMonitorMetrics, ProviderStatusReport } from './types'

function counterSum(includes: string): number {
  const snap = getOpsMetrics().snapshot()
  return Object.entries(snap.counters)
    .filter(([k]) => k.includes(includes))
    .reduce((sum, [, v]) => sum + v, 0)
}

function avgProviderLatency(): number {
  const snap = getOpsMetrics().snapshot()
  const samples = snap.recent.filter((r) => String(r.name).includes('provider.latency'))
  if (samples.length === 0) return 0
  return Math.round(samples.reduce((a, s) => a + s.value, 0) / samples.length)
}

export function collectProviderMonitorMetrics(
  environment: OpsEnvironment = 'beta',
): ProviderMonitorMetrics[] {
  const profile = getBetaEnvironmentProfile(resolveBetaEnvironment(environment as 'beta'))
  const matrix = buildBetaProviderMatrix(profile)
  const failures = counterSum('provider.failures')
  const retries = counterSum('ops.retries')
  const timeouts = counterSum('ops.timeouts')
  const latencyMs = avgProviderLatency()

  // Ensure future slot is represented for ops dashboards.
  const hasFuture = matrix.some((s) => String(s.providerId).includes('future'))
  const slots = hasFuture
    ? matrix
    : [
        ...matrix,
        {
          providerId: 'future',
          featureFlag: null,
          configured: false,
          flagEnabled: false,
          envEnabled: false,
          secretsPresent: false,
          mode: 'unavailable' as const,
          notes: 'Future provider registration slot',
        },
      ]

  return slots.map((slot) => {
    const id = String(slot.providerId)
    const isMock = id === 'mock' || slot.mode === 'simulated'
    const providerFailures = isMock ? 0 : failures
    const successApprox = Math.max(1, 20 - providerFailures)
    const total = successApprox + providerFailures
    const successRate = successApprox / total
    const failureRate = providerFailures / total
    const availability =
      slot.mode === 'unavailable' && id !== 'mock'
        ? 0
        : Math.max(0, Math.min(1, 1 - failureRate))

    let status: ProviderMonitorMetrics['status'] = 'idle'
    if (slot.mode === 'live') {
      status = failureRate >= 0.5 ? 'unhealthy' : failureRate >= 0.2 ? 'degraded' : 'healthy'
    } else if (slot.mode === 'simulated' || id === 'mock') {
      status = 'healthy'
    } else if (id === 'future') {
      status = 'idle'
    } else {
      status = 'idle'
    }

    return {
      providerId: id,
      availability,
      latencyMs: isMock ? latencyMs : latencyMs,
      successRate,
      failureRate,
      timeouts: isMock ? 0 : timeouts,
      retries: isMock ? 0 : retries,
      status,
    }
  })
}

export function buildProviderStatusReport(
  environment: OpsEnvironment = 'beta',
): ProviderStatusReport {
  const providers = collectProviderMonitorMetrics(environment)
  const unhealthy = providers.filter((p) => p.status === 'unhealthy').length
  const degraded = providers.filter((p) => p.status === 'degraded').length
  return {
    providers,
    overall: unhealthy > 0 ? 'unhealthy' : degraded > 0 ? 'degraded' : 'healthy',
    generatedAt: new Date().toISOString(),
  }
}
