/**
 * Phase AJ / AK — optional sandbox probe (explicit opt-in only).
 * Default path never performs network I/O.
 * Phase AK wires Amadeus-only read-only sandbox probing when opted in.
 */

import { getLogger } from '../../../ops/logging/structuredLogger'
import { getCorrelationId } from '../../../ops/logging/correlation'
import { createAmadeusSandboxProbeFn } from './amadeusSandboxProbe'
import { PRIMARY_SANDBOX_PROVIDER_ID } from './exclusivity'
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
  /**
   * When true (default), only Amadeus is probed in Phase AK.
   * Other providers remain config-only.
   */
  amadeusOnly?: boolean
}

export interface SandboxProbeResult {
  attempted: boolean
  results: Array<ProviderReadinessResult & { probeOk?: boolean; probeReason?: string }>
  refusedReason?: string
}

/**
 * Run optional sandbox probes. Without probeEnabled, returns config readiness only.
 * Never creates reservations/bookings; Amadeus probe is search/token read-only.
 */
export async function runSandboxProbes(
  providerIds: string[],
  options: SandboxProbeOptions,
): Promise<SandboxProbeResult> {
  const logger = getLogger()
  const amadeusOnly = options.amadeusOnly !== false
  const scopedIds = amadeusOnly
    ? providerIds.filter((id) => id === PRIMARY_SANDBOX_PROVIDER_ID)
    : providerIds

  const readiness = scopedIds
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
    options.probeFn
    ?? createAmadeusSandboxProbeFn({ env: options.env })

  const results: SandboxProbeResult['results'] = []
  for (const row of readiness) {
    // Phase AK: allow probing when configured in sandbox even if the live flag is OFF,
    // so operators can validate secrets before flipping enablement. Still no bookings.
    const mayProbe = row.configured && (row.enabled || row.environment === 'sandbox')
    if (!mayProbe) {
      results.push({ ...row, probeOk: false, probeReason: 'skipped_not_configured' })
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
