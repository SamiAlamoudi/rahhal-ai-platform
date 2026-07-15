/**
 * Health / readiness / liveness probes for staging & production.
 * Pure library — callable from SPA ops routes, Edge Functions, or tests.
 */

import { getOpsMetrics } from './metricsRegistry'
import { validateEnvironment, type EnvironmentValidationResult } from '../security/envValidation'

export type ProbeStatus = 'ok' | 'degraded' | 'fail'

export interface ProbeResult {
  status: ProbeStatus
  probe: 'liveness' | 'readiness' | 'health'
  ts: string
  checks: Record<string, { ok: boolean; detail?: string }>
  metrics?: Record<string, number>
  environment?: EnvironmentValidationResult['summary']
}

export interface HealthProbeOptions {
  /** When true, readiness fails if env is invalid for the target. */
  enforceEnv?: boolean
  target?: 'development' | 'staging' | 'production'
  paymentProvider?: string | null
  liveProvidersEnabled?: boolean
}

/** Process is alive (cheap). */
export function checkLiveness(): ProbeResult {
  return {
    status: 'ok',
    probe: 'liveness',
    ts: new Date().toISOString(),
    checks: {
      process: { ok: true, detail: 'up' },
    },
  }
}

/** Ready to serve traffic (config + safe payment default). */
export function checkReadiness(options: HealthProbeOptions = {}): ProbeResult {
  const target = options.target ?? 'staging'
  const env = validateEnvironment({
    target,
    paymentProvider: options.paymentProvider,
    liveProvidersEnabled: options.liveProvidersEnabled,
  })
  const paymentOk = (options.paymentProvider ?? env.resolved.paymentProvider) === 'mock'
    || target === 'development'

  const checks: ProbeResult['checks'] = {
    environment: {
      ok: options.enforceEnv === false ? true : env.ok,
      detail: env.ok ? 'valid' : env.errors.join('; '),
    },
    payment_provider_safe: {
      ok: paymentOk,
      detail: paymentOk ? 'mock' : 'live_payment_blocked',
    },
  }

  const failed = Object.values(checks).some((c) => !c.ok)
  return {
    status: failed ? 'fail' : 'ok',
    probe: 'readiness',
    ts: new Date().toISOString(),
    checks,
    environment: env.summary,
  }
}

/** Aggregated health (ready + recent failure pressure). */
export function checkHealth(options: HealthProbeOptions = {}): ProbeResult {
  const ready = checkReadiness(options)
  const snap = getOpsMetrics().snapshot()
  const providerFailures = Object.entries(snap.counters)
    .filter(([k]) => k.startsWith('provider.failures'))
    .reduce((sum, [, v]) => sum + v, 0)

  const checks = {
    ...ready.checks,
    liveness: { ok: true as boolean, detail: 'up' },
    failure_pressure: {
      ok: providerFailures < 100,
      detail: `provider_failures=${providerFailures}`,
    },
  }
  const hardFail = ready.status === 'fail'
  const degraded = !hardFail && providerFailures >= 20
  return {
    status: hardFail ? 'fail' : degraded ? 'degraded' : 'ok',
    probe: 'health',
    ts: new Date().toISOString(),
    checks,
    metrics: {
      providerFailures,
      samples: snap.recent.length,
    },
    environment: ready.environment,
  }
}
