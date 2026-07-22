/**
 * Sprint 90 — provider health probing helpers.
 */

import type { ProviderHealthResult, TravelProvider } from './types'
import { classifyProviderFailure } from './ProviderErrors'

export interface HealthProbeOptions {
  timeoutMs?: number
}

export async function probeProviderHealth(
  provider: TravelProvider,
  options: HealthProbeOptions = {},
): Promise<ProviderHealthResult> {
  const timeoutMs = options.timeoutMs ?? provider.limits().timeoutMs
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const started = performance.now()
  try {
    const result = await provider.health(controller.signal)
    clearTimeout(timer)
    return {
      ...result,
      latencyMs: result.latencyMs || Math.round(performance.now() - started),
      checkedAt: result.checkedAt || new Date().toISOString(),
    }
  } catch (err) {
    clearTimeout(timer)
    const classified = classifyProviderFailure(provider.id, err)
    return {
      providerId: provider.id,
      ok: false,
      mode: provider.mode,
      latencyMs: Math.round(performance.now() - started),
      detail: `${classified.code}: ${classified.message}`,
      checkedAt: new Date().toISOString(),
    }
  }
}

export async function probeAllProviders(
  providers: TravelProvider[],
  options?: HealthProbeOptions,
): Promise<ProviderHealthResult[]> {
  return Promise.all(providers.map((p) => probeProviderHealth(p, options)))
}

export function summarizeHealth(results: ProviderHealthResult[]): {
  total: number
  healthy: number
  unhealthy: number
  availability: number
} {
  const total = results.length
  const healthy = results.filter((r) => r.ok).length
  return {
    total,
    healthy,
    unhealthy: total - healthy,
    availability: total === 0 ? 0 : healthy / total,
  }
}
