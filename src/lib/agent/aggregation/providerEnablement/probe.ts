/**
 * Phase AJ — optional sandbox probe (explicit opt-in only).
 * Default path never performs network I/O.
 */

import { getLogger } from '../../../ops/logging/structuredLogger'
import { getCorrelationId } from '../../../ops/logging/correlation'
import { recordSandboxProbe } from './metrics'
import { checkLiveProviderReadiness } from './readiness'
import { readEnvValue } from './secrets'
import type { ProviderReadinessResult } from './types'

export interface SandboxProbeOptions {
  env?: Record<string, string | undefined>
  /** Must be true to attempt any network probe. */
  probeEnabled: boolean
  /** Required to probe production endpoints. */
  confirmProduction?: boolean
  /** Injected probe implementation for tests. */
  probeFn?: (providerId: string) => Promise<{ ok: boolean; reason: string }>
}

export interface SandboxProbeResult {
  attempted: boolean
  results: Array<ProviderReadinessResult & { probeOk?: boolean; probeReason?: string }>
  refusedReason?: string
}

/**
 * Run optional sandbox probes. Without probeEnabled, returns config readiness only.
 * Never creates reservations/bookings; callers must only use read-only search probes.
 */
export async function runSandboxProbes(
  providerIds: string[],
  options: SandboxProbeOptions,
): Promise<SandboxProbeResult> {
  const logger = getLogger()
  const readiness = providerIds
    .map((id) => checkLiveProviderReadiness(id, { env: options.env }))
    .filter((r): r is ProviderReadinessResult => Boolean(r))

  if (!options.probeEnabled) {
    return { attempted: false, results: readiness }
  }

  // Refuse production endpoints without explicit confirmation.
  for (const row of readiness) {
    if (row.environment === 'production' && options.confirmProduction !== true) {
      return {
        attempted: false,
        results: readiness,
        refusedReason: 'production_probe_requires_CONFIRM_PRODUCTION_PROBE',
      }
    }
  }

  const probeFn =
    options.probeFn ??
    (async () => ({
      ok: false,
      reason: 'default_probe_disabled_no_network',
    }))

  const results: SandboxProbeResult['results'] = []
  for (const row of readiness) {
    if (!row.configured || !row.enabled) {
      results.push({ ...row, probeOk: false, probeReason: 'skipped_not_enabled' })
      continue
    }
    const started = Date.now()
    try {
      const probe = await probeFn(row.provider)
      recordSandboxProbe(row.provider, probe.ok, Date.now() - started)
      logger.info('provider_enablement', 'sandbox_probe', 'probe_complete', {
        correlationId: getCorrelationId(),
        providerId: row.provider,
        capability: row.capability,
        environment: row.environment,
        ok: probe.ok,
        reason: probe.reason,
      })
      results.push({ ...row, probeOk: probe.ok, probeReason: probe.reason })
    } catch (error) {
      recordSandboxProbe(row.provider, false, Date.now() - started)
      results.push({
        ...row,
        probeOk: false,
        probeReason: error instanceof Error ? error.message : 'probe_error',
      })
    }
  }

  return { attempted: true, results }
}

export function isSandboxProbeEnvEnabled(env?: Record<string, string | undefined>): boolean {
  const value = (
    readEnvValue('PROVIDER_SANDBOX_PROBE', env) ??
    readEnvValue('VITE_PROVIDER_SANDBOX_PROBE', env) ??
    'false'
  ).toLowerCase()
  return ['1', 'true', 'yes', 'on'].includes(value)
}

export function isProductionProbeConfirmed(env?: Record<string, string | undefined>): boolean {
  const value = (readEnvValue('CONFIRM_PRODUCTION_PROBE', env) ?? 'false').toLowerCase()
  return ['1', 'true', 'yes', 'on'].includes(value)
}
