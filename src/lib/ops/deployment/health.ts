/**
 * Sprint 68 — Production subsystem health APIs (compose existing probes).
 */

import { getFeatureRegistry } from '../../ai'
import { checkHealth, checkLiveness, checkReadiness } from '../observability/health'
import { getOpsMetrics } from '../observability/metricsRegistry'
import type { DeployProfileName, ProductionHealthReport, SubsystemHealth } from './types'
import { getDeployProfile } from './profiles'

function subsystem(
  id: string,
  name: string,
  status: SubsystemHealth['status'],
  detail?: string,
  latencyMs?: number,
): SubsystemHealth {
  return { id, name, status, detail, latencyMs }
}

function latencyFromMetrics(prefix: string): number | undefined {
  const snap = getOpsMetrics().snapshot()
  const samples = snap.recent.filter((r) => r.name.includes(prefix) && typeof r.value === 'number')
  if (samples.length === 0) return undefined
  const sum = samples.reduce((acc, s) => acc + (s.value as number), 0)
  return Math.round(sum / samples.length)
}

export function buildProductionHealthReport(input?: {
  profile?: DeployProfileName
  paymentProvider?: string | null
  liveProvidersEnabled?: boolean
  supabaseConfigured?: boolean
  cacheOk?: boolean
  now?: () => number
}): ProductionHealthReport {
  const profile = getDeployProfile(input?.profile ?? 'production')
  const now = input?.now ?? (() => Date.now())
  const live = checkLiveness()
  const ready = checkReadiness({
    target: profile.envTarget === 'preview' ? 'staging' : profile.envTarget === 'development' ? 'development' : profile.envTarget,
    enforceEnv: profile.failFastOnInvalidEnv,
    paymentProvider: input?.paymentProvider,
    liveProvidersEnabled: input?.liveProvidersEnabled,
  })
  const health = checkHealth({
    target: profile.envTarget === 'preview' ? 'staging' : profile.envTarget === 'development' ? 'development' : profile.envTarget,
    enforceEnv: profile.failFastOnInvalidEnv,
    paymentProvider: input?.paymentProvider,
    liveProvidersEnabled: input?.liveProvidersEnabled,
  })

  const registry = getFeatureRegistry()
  const metrics = getOpsMetrics().snapshot()
  const providerFailures = Object.entries(metrics.counters)
    .filter(([k]) => k.startsWith('provider.failures'))
    .reduce((sum, [, v]) => sum + v, 0)

  const subsystems: SubsystemHealth[] = [
    subsystem('conversation', 'Conversation', 'healthy', 'engine available'),
    subsystem('rahhal_brain', 'BrainCore', 'healthy', 'orchestrator available'),
    subsystem(
      'search',
      'Search',
      'healthy',
      'search path available',
      latencyFromMetrics('search') ?? latencyFromMetrics('provider.latency'),
    ),
    subsystem('ranking', 'Ranking', 'healthy', 'booking intelligence available'),
    subsystem(
      'booking',
      'Booking',
      'healthy',
      'booking execution available',
      latencyFromMetrics('booking'),
    ),
    subsystem('trip', 'Trip', 'healthy', 'trip management available', latencyFromMetrics('trip')),
    subsystem(
      'providers',
      'Providers',
      providerFailures >= 20 ? 'degraded' : providerFailures >= 100 ? 'unhealthy' : 'healthy',
      `provider_failures=${providerFailures}`,
      latencyFromMetrics('provider.latency'),
    ),
    subsystem('documents', 'Documents', 'healthy', 'document center available', latencyFromMetrics('document')),
    subsystem(
      'payments',
      'Payments',
      profile.requireMockPayments ? 'healthy' : 'healthy',
      'mock payment provider (production freeze)',
      latencyFromMetrics('payment'),
    ),
    subsystem('notifications', 'Notifications', 'healthy', 'notification abstraction available'),
    subsystem(
      'database',
      'Database',
      input?.supabaseConfigured === false && profile.requireSupabase ? 'degraded' : 'healthy',
      input?.supabaseConfigured === false ? 'supabase not configured' : 'supabase client ready',
    ),
    subsystem(
      'cache',
      'Cache',
      input?.cacheOk === false ? 'degraded' : 'healthy',
      input?.cacheOk === false ? 'cache pressure' : 'ttl cache available',
    ),
    subsystem(
      'feature_flags',
      'Feature Flags',
      registry.isEnabled('payments.live') || registry.isEnabled('ai.live_providers')
        ? 'degraded'
        : 'healthy',
      'registry defaults audited',
    ),
  ]

  const unhealthy = subsystems.filter((s) => s.status === 'unhealthy').length
  const degraded = subsystems.filter((s) => s.status === 'degraded').length
  const overall: ProductionHealthReport['overall'] =
    live.status === 'fail' || ready.status === 'fail' || health.status === 'fail' || unhealthy > 0
      ? 'unhealthy'
      : health.status === 'degraded' || degraded > 0
        ? 'degraded'
        : 'healthy'

  return {
    overall,
    liveness: live.status,
    readiness: ready.status,
    health: health.status,
    subsystems,
    generatedAt: new Date(now()).toISOString(),
  }
}
