/**
 * Phase AJ — provider enablement metrics (bridges OpsMetricsRegistry).
 */

import { getOpsMetrics, type OpsMetricName } from '../../../ops/observability/metricsRegistry'

function incr(name: OpsMetricName, tags: Record<string, string>): void {
  getOpsMetrics().incr(name, tags)
}

function observe(name: OpsMetricName, value: number, tags: Record<string, string>): void {
  getOpsMetrics().observe(name, value, tags)
}

export function recordProviderSelection(tags: {
  providerId: string
  capability: string
  outcome: string
}): void {
  incr('ops.idempotency_hits', { domain: 'provider_selection', ...tags })
  // Prefer dedicated naming via observe duration 0 as event count bridge
  observe('provider.latency_ms', 0, { event: 'selection', ...tags })
}

export function recordMockFallback(tags: {
  providerId: string
  capability: string
  reason: string
}): void {
  incr('provider.fallback', { providerId: tags.providerId, capability: tags.capability, reason: tags.reason })
}

export function recordReadinessFailure(providerId: string, reason: string): void {
  incr('provider.failures', { providerId, reason, stage: 'readiness' })
}

export function recordConfigurationFailure(providerId: string, reason: string): void {
  incr('provider.failures', { providerId, reason, stage: 'configuration' })
}

export function recordSandboxProbe(providerId: string, ok: boolean, durationMs: number): void {
  observe('provider.latency_ms', durationMs, {
    providerId,
    event: 'sandbox_probe',
    ok: String(ok),
  })
  if (!ok) incr('provider.failures', { providerId, stage: 'sandbox_probe' })
}

export function recordProviderError(providerId: string, code: string): void {
  incr('provider.failures', { providerId, code })
}

export function recordProviderRetry(providerId: string): void {
  incr('ops.retries', { domain: 'provider', providerId })
}

export function recordProviderRateLimit(providerId: string): void {
  incr('ops.rate_limited', { domain: 'provider', providerId })
}

export function recordCircuitOpen(providerId: string): void {
  incr('provider.circuit_open', { providerId })
}
