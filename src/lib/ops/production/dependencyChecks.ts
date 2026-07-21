/**
 * Sprint 65 — Dependency / provider availability checks for readiness.
 */

import { checkHealth, checkLiveness, checkReadiness, type HealthProbeOptions, type ProbeResult } from '../observability/health'
import { getOpsMetrics } from '../observability/metricsRegistry'
import type { ProductionCheckResult } from './types'

export interface DependencyCheckInput extends HealthProbeOptions {
  /** Declared provider ids expected in registry (availability metadata only). */
  providers?: Array<{ id: string; available: boolean; degraded?: boolean }>
  supabaseConfigured?: boolean
}

export interface DependencyCheckReport {
  liveness: ProbeResult
  readiness: ProbeResult
  health: ProbeResult
  dependencies: ProductionCheckResult[]
  ok: boolean
}

export function runDependencyChecks(input: DependencyCheckInput = {}): DependencyCheckReport {
  const liveness = checkLiveness()
  const readiness = checkReadiness(input)
  const health = checkHealth(input)
  const dependencies: ProductionCheckResult[] = []

  dependencies.push({
    id: 'dep.liveness',
    area: 'Reliability',
    status: liveness.status === 'ok' ? 'pass' : 'fail',
    summary: 'Process liveness',
  })
  dependencies.push({
    id: 'dep.readiness',
    area: 'Reliability',
    status: readiness.status === 'ok' ? 'pass' : 'fail',
    summary: 'Readiness (env + payment safety)',
    details: readiness.checks,
  })
  dependencies.push({
    id: 'dep.health',
    area: 'Reliability',
    status:
      health.status === 'ok' ? 'pass' : health.status === 'degraded' ? 'warn' : 'fail',
    summary: `Aggregated health: ${health.status}`,
    details: health.checks,
  })

  if (typeof input.supabaseConfigured === 'boolean') {
    dependencies.push({
      id: 'dep.supabase',
      area: 'Dependencies',
      status: input.supabaseConfigured ? 'pass' : 'fail',
      summary: input.supabaseConfigured
        ? 'Supabase URL/anon configured'
        : 'Supabase env missing',
    })
  }

  for (const p of input.providers ?? []) {
    dependencies.push({
      id: `dep.provider.${p.id}`,
      area: 'Providers',
      status: !p.available ? 'warn' : p.degraded ? 'warn' : 'pass',
      summary: p.available
        ? (p.degraded ? `${p.id} degraded` : `${p.id} available`)
        : `${p.id} unavailable — fallback expected`,
      details: { available: p.available, degraded: p.degraded ?? false },
    })
  }

  const snap = getOpsMetrics().snapshot()
  dependencies.push({
    id: 'dep.metrics',
    area: 'Observability',
    status: 'pass',
    summary: 'Ops metrics registry reachable',
    details: { sampleCount: snap.recent.length },
  })

  const ok = !dependencies.some((d) => d.status === 'fail')
  return { liveness, readiness, health, dependencies, ok }
}
