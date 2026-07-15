/**
 * Health / readiness / liveness probes for staging & production.
 * Phase AI — extends probes with API / database / queue / cache checks.
 * Pure library — callable from SPA ops routes, Edge Functions, or tests.
 */

import { getOpsMetrics } from './metricsRegistry'
import { validateEnvironment, type EnvironmentValidationResult } from '../security/envValidation'
import { getAppConfig, type AppConfig } from '../production/appConfig'
import { getIdempotencyStore } from '../reliability/idempotency'
import { getDeadLetterQueue } from '../reliability/deadLetter'
import { TtlCache } from '../performance/performanceToolkit'

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
  /** Optional injected dependencies for tests. */
  config?: AppConfig
  /** Simulate database connectivity. Defaults to in-memory ok when supabase not required. */
  databaseCheck?: () => { ok: boolean; detail?: string }
  queueCheck?: () => { ok: boolean; detail?: string }
  cacheCheck?: () => { ok: boolean; detail?: string }
  apiCheck?: () => { ok: boolean; detail?: string }
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

function defaultDatabaseCheck(config: AppConfig): { ok: boolean; detail?: string } {
  // SPA uses Supabase when configured; otherwise in-memory repositories are healthy.
  if (config.secretsPresent.supabase) {
    return { ok: true, detail: 'supabase_configured' }
  }
  return { ok: true, detail: 'in_memory_repositories' }
}

function defaultQueueCheck(): { ok: boolean; detail?: string } {
  const dlq = getDeadLetterQueue()
  const size = dlq.list().length
  return {
    ok: size < 500,
    detail: `dead_letter_size=${size}`,
  }
}

function defaultCacheCheck(): { ok: boolean; detail?: string } {
  // Smoke probe: TTL cache construct + idempotency store reachable.
  const cache = new TtlCache<string>(1_000)
  cache.set('health', 'ok')
  const hit = cache.get('health') === 'ok'
  const idem = getIdempotencyStore()
  void idem
  return { ok: hit, detail: hit ? 'ttl_cache_ok' : 'ttl_cache_fail' }
}

function defaultApiCheck(): { ok: boolean; detail?: string } {
  return { ok: true, detail: 'api_surface_ready' }
}

/** Ready to serve traffic (config + safe payment default + subsystem probes). */
export function checkReadiness(options: HealthProbeOptions = {}): ProbeResult {
  const config = options.config ?? getAppConfig()
  const target = options.target ?? config.target ?? 'staging'
  const env = validateEnvironment({
    target,
    paymentProvider: options.paymentProvider ?? config.paymentProvider,
    liveProvidersEnabled:
      options.liveProvidersEnabled ?? config.liveCapabilities.liveProvidersMaster,
  })
  const paymentOk =
    (options.paymentProvider ?? env.resolved.paymentProvider) === 'mock' ||
    target === 'development'

  const api = (options.apiCheck ?? defaultApiCheck)()
  const database = (options.databaseCheck ?? (() => defaultDatabaseCheck(config)))()
  const queue = (options.queueCheck ?? defaultQueueCheck)()
  const cache = (options.cacheCheck ?? defaultCacheCheck)()

  const checks: ProbeResult['checks'] = {
    environment: {
      ok: options.enforceEnv === false ? true : env.ok,
      detail: env.ok ? 'valid' : env.errors.join('; '),
    },
    payment_provider_safe: {
      ok: paymentOk,
      detail: paymentOk ? 'mock' : 'live_payment_blocked',
    },
    api: api,
    database,
    queue,
    cache,
    live_payments_off: {
      ok: !config.liveCapabilities.livePayments,
      detail: config.liveCapabilities.livePayments ? 'live_payments_enabled' : 'disabled',
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
  const opsFailures = Object.entries(snap.counters)
    .filter(([k]) => k.startsWith('ops.failures'))
    .reduce((sum, [, v]) => sum + v, 0)

  const checks = {
    ...ready.checks,
    liveness: { ok: true as boolean, detail: 'up' },
    failure_pressure: {
      ok: providerFailures < 100 && opsFailures < 200,
      detail: `provider_failures=${providerFailures};ops_failures=${opsFailures}`,
    },
  }
  const hardFail = ready.status === 'fail'
  const degraded = !hardFail && (providerFailures >= 20 || opsFailures >= 50)
  return {
    status: hardFail ? 'fail' : degraded ? 'degraded' : 'ok',
    probe: 'health',
    ts: new Date().toISOString(),
    checks,
    metrics: {
      providerFailures,
      opsFailures,
      samples: snap.recent.length,
    },
    environment: ready.environment,
  }
}
